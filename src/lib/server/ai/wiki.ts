import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';
import { getSystemPreference } from '$lib/server/db/preferences';

/**
 * Server-only Markdown wiki reader — Phase 2 of plans/AI_TOOL_ARCHITECTURE_PLAN.md.
 *
 * Design notes:
 * - Scans and parses the current Markdown files on every authorized search so
 *   wiki edits are visible on the next search without a restart, cache, or
 *   watcher (plan §10). Appropriate for the current ~40-page wiki.
 * - Supports the Node runtime used by local dev, Docker, and Portainer. On
 *   Cloudflare Workers/Pages (no node:fs) the feature reports unsupported
 *   (plan §8 "Runtime support boundary").
 * - Markdown is untrusted reference data; it is returned as plain text and
 *   must never be treated as instructions (enforced via the system prompt).
 */

// --- Limits (plan §9 filesystem safeguards) ---

const MAX_WIKI_FILES = 500;
const MAX_FILE_BYTES = 256 * 1024; // 256 KiB per file
const MAX_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MiB per scan
const MAX_DEPTH = 8;
const SECTION_CONTENT_CAP = 4_000;
const COMBINED_CONTENT_CAP = 14_000; // plan §5.3: initially ~12,000-16,000 chars

export class WikiUnavailableError extends Error {}

// --- Types ---

export interface WikiFrontmatter {
	title: string | null;
	tags: string[];
	updated: string | null;
	confidence: string | null;
}

export interface WikiSectionResult {
	/** Stable citation ID: "<relative path>#<heading slug>" (never absolute). */
	citation_id: string;
	title: string;
	relative_path: string;
	heading: string | null;
	updated: string | null;
	confidence: string | null;
	content: string;
}

export interface WikiSearchOutcome {
	sections: WikiSectionResult[];
	diagnostics: {
		filesScanned: number;
		filesSkipped: number;
		bytesRead: number;
	};
}

export interface WikiStatus {
	/** Node runtime with filesystem access (false in the Cloudflare build). */
	supported: boolean;
	/** wiki_enabled preference. */
	enabled: boolean;
	/** WIKI_PATH deployment variable set. */
	configured: boolean;
	/** Configured root is a readable directory. */
	readable: boolean;
	pageCount: number | null;
	scannedAt: string | null;
	/** Sanitized validation error — safe to show admins, never a stack trace. */
	error: string | null;
}

interface WikiSection {
	heading: string | null;
	content: string;
}

interface WikiPageRecord {
	relativePath: string;
	frontmatter: WikiFrontmatter;
	/** File mtime (ISO date) — fallback for `updated` when frontmatter omits it. */
	modifiedAt: string | null;
	sections: WikiSection[];
}

// --- Environment helpers ---

export function isWikiRuntimeSupported(): boolean {
	return typeof process !== 'undefined' && !!process.versions?.node;
}

function getWikiRoot(): string | null {
	// process.env is read at call time (not a module-init snapshot) so tests
	// and rotating deployment secrets behave; the feature is Node-only anyway.
	if (!isWikiRuntimeSupported()) return null;
	const root = process.env.WIKI_PATH?.trim();
	return root ? root : null;
}

export async function isWikiEnabled(supabase: SupabaseClient<Database>): Promise<boolean> {
	const { data } = await getSystemPreference(supabase, 'wiki_enabled');
	return data?.value === 'true';
}

// --- Frontmatter & section parsing ---

function unquote(value: string): string {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

/**
 * Minimal YAML-frontmatter reader for the wiki's metadata shape: scalar
 * `key: value` pairs, inline lists (`tags: [a, b]`), and dash lists. Unknown
 * keys are preserved in the raw map but ignored by ranking (plan §9).
 */
export function parseFrontmatter(raw: string): { frontmatter: WikiFrontmatter; body: string } {
	const empty: WikiFrontmatter = { title: null, tags: [], updated: null, confidence: null };
	const normalized = raw.replace(/\r\n/g, '\n');
	if (!normalized.startsWith('---\n')) return { frontmatter: empty, body: raw };

	const closing = normalized.indexOf('\n---', 4);
	if (closing === -1) return { frontmatter: empty, body: raw };

	const block = normalized.slice(4, closing);
	const body = normalized.slice(closing + 4).replace(/^\n+/, '');

	const fields = new Map<string, string | string[]>();
	let listKey: string | null = null;
	for (const line of block.split('\n')) {
		const dashItem = line.match(/^\s+-\s+(.*)$/);
		if (dashItem && listKey) {
			(fields.get(listKey) as string[]).push(unquote(dashItem[1]));
			continue;
		}
		const pair = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
		if (!pair) {
			listKey = null;
			continue;
		}
		const key = pair[1].toLowerCase();
		const value = pair[2];
		if (value === '') {
			fields.set(key, []);
			listKey = key;
		} else if (value.startsWith('[') && value.endsWith(']')) {
			const items = value
				.slice(1, -1)
				.split(',')
				.map(unquote)
				.filter((item) => item.length > 0);
			fields.set(key, items);
			listKey = null;
		} else {
			fields.set(key, unquote(value));
			listKey = null;
		}
	}

	const scalar = (key: string): string | null => {
		const value = fields.get(key);
		return typeof value === 'string' && value !== '' ? value : null;
	};
	const list = (key: string): string[] => {
		const value = fields.get(key);
		if (Array.isArray(value)) return value;
		return typeof value === 'string' && value !== '' ? [value] : [];
	};

	return {
		frontmatter: {
			title: scalar('title'),
			tags: [...list('tags'), ...list('aliases')],
			updated: scalar('updated'),
			confidence: scalar('confidence')
		},
		body
	};
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*$/;

/** Split Markdown body into heading-sized sections. Preamble → heading null. */
export function splitSections(body: string): WikiSection[] {
	const sections: WikiSection[] = [];
	let heading: string | null = null;
	let buffer: string[] = [];

	const flush = () => {
		const content = buffer.join('\n').trim();
		if (content !== '') sections.push({ heading, content });
	};

	for (const line of body.split('\n')) {
		const match = line.match(HEADING_RE);
		if (match) {
			flush();
			heading = match[2];
			buffer = [line];
		} else {
			buffer.push(line);
		}
	}
	flush();
	return sections;
}

function slugifyHeading(heading: string): string {
	const slug = heading
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'section';
}

// --- Filesystem safeguards ---

/**
 * True when `candidate` (both already canonicalized) stays inside `root`.
 * Case-insensitive on Windows drive paths.
 */
export function isWithinRoot(root: string, candidate: string): boolean {
	const normalize = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
	const relative = path.relative(normalize(root), normalize(candidate));
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

interface ScanOutcome {
	realRoot: string;
	files: string[];
	skipped: number;
	bytesTotal: number;
}

type FsPromises = typeof import('node:fs/promises');

async function enumerateWikiFiles(fs: FsPromises, root: string): Promise<ScanOutcome> {
	const realRoot = await fs.realpath(root);
	const files: string[] = [];
	let skipped = 0;
	let bytesTotal = 0;

	async function walk(dir: string, depth: number): Promise<void> {
		if (depth > MAX_DEPTH || files.length >= MAX_WIKI_FILES || bytesTotal >= MAX_TOTAL_BYTES) {
			return;
		}
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (files.length >= MAX_WIKI_FILES || bytesTotal >= MAX_TOTAL_BYTES) return;
			const full = path.join(dir, entry.name);
			try {
				if (entry.isSymbolicLink()) {
					// Skip links that resolve outside the configured root (plan §9).
					const real = await fs.realpath(full);
					if (!isWithinRoot(realRoot, real)) {
						skipped++;
						continue;
					}
					const stat = await fs.stat(real);
					if (stat.isDirectory()) await walk(real, depth + 1);
					else if (stat.isFile() && entry.name.toLowerCase().endsWith('.md')) {
						if (stat.size > MAX_FILE_BYTES) {
							skipped++;
							continue;
						}
						files.push(full);
						bytesTotal += stat.size;
					}
				} else if (entry.isDirectory()) {
					await walk(full, depth + 1);
				} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
					const stat = await fs.stat(full);
					if (stat.size > MAX_FILE_BYTES) {
						skipped++;
						continue;
					}
					files.push(full);
					bytesTotal += stat.size;
				}
			} catch (err) {
				// A single unreadable entry must not break all wiki search (plan §9).
				skipped++;
				console.warn('[ai/wiki] Skipping unreadable entry during scan:', err);
			}
		}
	}

	await walk(realRoot, 0);
	return { realRoot, files, skipped, bytesTotal };
}

function toRelativePath(root: string, file: string): string {
	return path.relative(root, file).split(path.sep).join('/');
}

async function readWikiPage(
	fs: FsPromises,
	realRoot: string,
	file: string
): Promise<WikiPageRecord | null> {
	// Canonicalize and re-verify containment immediately before reading.
	const realFile = await fs.realpath(file);
	if (!isWithinRoot(realRoot, realFile)) return null;

	const raw = await fs.readFile(realFile, 'utf8');
	const { frontmatter, body } = parseFrontmatter(raw);
	const stat = await fs.stat(realFile);
	return {
		relativePath: toRelativePath(realRoot, realFile),
		frontmatter,
		modifiedAt: stat.mtime.toISOString().slice(0, 10),
		sections: splitSections(body)
	};
}

// --- Lexical ranking (plan §11) ---

/** Normalize case/punctuation and keep short domain abbreviations (EOB, OA…). */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 2);
}

function countOccurrences(haystack: string, token: string): number {
	let count = 0;
	let index = 0;
	while ((index = haystack.indexOf(token, index)) !== -1) {
		count++;
		index += token.length;
	}
	return count;
}

function scoreSection(
	page: WikiPageRecord,
	section: WikiSection,
	query: string,
	tokens: string[]
): number {
	const title = (page.frontmatter.title ?? '').toLowerCase();
	const heading = (section.heading ?? '').toLowerCase();
	const tags = page.frontmatter.tags.map((tag) => tag.toLowerCase());
	const body = section.content.toLowerCase();
	const normalizedQuery = query.trim().toLowerCase();

	let score = 0;
	if (title !== '' && title === normalizedQuery) score += 100; // exact title
	if (title !== '' && tokens.every((token) => title.includes(token))) score += 50;

	for (const token of tokens) {
		if (title.includes(token)) score += 12;
		if (heading.includes(token)) score += 10;
		if (tags.some((tag) => tag === token || tag.includes(token))) score += 8;
		score += Math.min(countOccurrences(body, token), 5) * 2;
	}

	// Metadata confidence/freshness are tie-breakers only — a section that
	// matched nothing must score 0 and be excluded from results.
	if (score === 0) return 0;

	if (page.frontmatter.confidence === 'high') score += 2;
	else if (page.frontmatter.confidence === 'medium') score += 1;

	const updatedRaw = page.frontmatter.updated ?? page.modifiedAt;
	if (updatedRaw) {
		const updated = new Date(`${updatedRaw}T00:00:00Z`).getTime();
		if (!Number.isNaN(updated) && Date.now() - updated < 180 * 24 * 60 * 60 * 1000) score += 1;
	}

	return score;
}

function truncateContent(content: string, cap: number): string {
	return content.length > cap ? `${content.slice(0, cap)}…[truncated]` : content;
}

/**
 * Full per-request wiki search: enumerate, read, parse, rank, return bounded
 * sections. Request-local data is discarded afterwards (plan §10).
 */
export async function searchWikiFiles(
	root: string,
	query: string,
	limit: number
): Promise<WikiSearchOutcome> {
	const fs = await import('node:fs/promises');
	const { realRoot, files, skipped } = await enumerateWikiFiles(fs, root);

	const pages: WikiPageRecord[] = [];
	let filesSkipped = skipped;
	let bytesRead = 0;
	for (const file of files) {
		try {
			const page = await readWikiPage(fs, realRoot, file);
			if (page) {
				pages.push(page);
				bytesRead += Buffer.byteLength(page.sections.map((s) => s.content).join('\n'), 'utf8');
			} else {
				filesSkipped++;
			}
		} catch (err) {
			filesSkipped++;
			console.warn('[ai/wiki] Skipping unreadable or malformed page:', err);
		}
	}

	const tokens = tokenize(query);
	const ranked = pages
		.flatMap((page) =>
			page.sections.map((section) => ({
				page,
				section,
				score: scoreSection(page, section, query, tokens)
			}))
		)
		.filter((entry) => entry.score > 0)
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			const titleA = a.page.frontmatter.title ?? a.page.relativePath;
			const titleB = b.page.frontmatter.title ?? b.page.relativePath;
			return titleA.localeCompare(titleB) || a.page.relativePath.localeCompare(b.page.relativePath);
		});

	const sections: WikiSectionResult[] = [];
	let combinedChars = 0;
	for (const entry of ranked) {
		if (sections.length >= limit) break;
		const remaining = COMBINED_CONTENT_CAP - combinedChars;
		if (remaining < 200) break;
		const cap = Math.min(SECTION_CONTENT_CAP, remaining);
		const content = truncateContent(entry.section.content, cap);
		combinedChars += content.length;
		sections.push({
			citation_id: `${entry.page.relativePath}#${
				entry.section.heading ? slugifyHeading(entry.section.heading) : 'top'
			}`,
			title:
				entry.page.frontmatter.title ??
				path.basename(entry.page.relativePath).replace(/\.md$/i, ''),
			relative_path: entry.page.relativePath,
			heading: entry.section.heading,
			updated: entry.page.frontmatter.updated ?? entry.page.modifiedAt,
			confidence: entry.page.frontmatter.confidence,
			content
		});
	}

	return {
		sections,
		diagnostics: { filesScanned: pages.length, filesSkipped, bytesRead }
	};
}

// --- Public entry points used by the tool and the admin page ---

/**
 * Authorized wiki search. Re-checks enablement and configuration so a call
 * racing an admin toggle fails safely.
 */
export async function searchWiki(
	supabase: SupabaseClient<Database>,
	input: { query: string; limit: number }
): Promise<WikiSearchOutcome> {
	if (!isWikiRuntimeSupported()) {
		throw new WikiUnavailableError('wiki search is not supported on this runtime');
	}
	if (!(await isWikiEnabled(supabase))) {
		throw new WikiUnavailableError('wiki search is disabled');
	}
	const root = getWikiRoot();
	if (!root) {
		throw new WikiUnavailableError('wiki path is not configured');
	}
	try {
		return await searchWikiFiles(root, input.query, input.limit);
	} catch (err) {
		if (err instanceof WikiUnavailableError) throw err;
		console.error('[ai/wiki] Wiki search failed:', err);
		throw new WikiUnavailableError('wiki path is not readable');
	}
}

/**
 * Read-only health information for the admin page (plan §7): validates the
 * deployment path, scans eligible Markdown files, reports counts. Never
 * exposes stack traces.
 */
export async function getWikiStatus(supabase: SupabaseClient<Database>): Promise<WikiStatus> {
	const status: WikiStatus = {
		supported: isWikiRuntimeSupported(),
		enabled: false,
		configured: false,
		readable: false,
		pageCount: null,
		scannedAt: null,
		error: null
	};

	try {
		status.enabled = await isWikiEnabled(supabase);
	} catch (err) {
		console.error('[ai/wiki] Failed to read wiki_enabled preference:', err);
	}

	if (!status.supported) {
		status.error = 'Not supported on this runtime (Cloudflare build has no filesystem access).';
		return status;
	}

	const root = getWikiRoot();
	status.configured = root !== null;
	if (!root) {
		status.error = 'WIKI_PATH is not set.';
		return status;
	}

	try {
		const fs = await import('node:fs/promises');
		const { files } = await enumerateWikiFiles(fs, root);
		status.readable = true;
		status.pageCount = files.length;
		status.scannedAt = new Date().toISOString();
	} catch (err) {
		console.error('[ai/wiki] Wiki path validation failed:', err);
		status.error = 'Configured path is not a readable directory.';
	}
	return status;
}
