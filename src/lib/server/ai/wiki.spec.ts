import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	parseFrontmatter,
	splitSections,
	isWithinRoot,
	searchWikiFiles,
	getWikiStatus
} from './wiki';

// ---------------------------------------------------------------------------
// Temp-wiki fixture helpers (real fs, per plan §10 the reader scans per call)
// ---------------------------------------------------------------------------

let wikiRoot: string;

async function writeWiki(relativePath: string, content: string) {
	const full = path.join(wikiRoot, relativePath);
	await mkdir(path.dirname(full), { recursive: true });
	await writeFile(full, content, 'utf8');
}

beforeEach(async () => {
	wikiRoot = await mkdtemp(path.join(tmpdir(), 'wiki-test-'));
});

afterEach(async () => {
	await rm(wikiRoot, { recursive: true, force: true });
	delete process.env.WIKI_PATH;
});

const APPEALS_PAGE = `---
title: Appeals
created: 2026-07-07
updated: 2026-07-13
type: process
tags: [denials, appeals]
sources: []
confidence: high
---

# Appeals

Deciding whether to appeal, send a corrected claim, or write off.

## Appeal Criteria

Appeal when the denial reason is incorrect and documented. Send a corrected
claim when the claim itself had an error.

## Attachments

Attach the EOB, medical records, and a completed appeal form.
`;

const STATEMENTS_PAGE = `---
title: Patient Statements
updated: 2026-06-01
tags:
  - billing
  - statements
confidence: medium
---

# Patient Statements

Statement cadence for patient responsibility.

## Statement Schedule

First statement at 30 days, second at 60, final at 90 days.
`;

// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
	it('parses scalar fields and inline lists', () => {
		const { frontmatter, body } = parseFrontmatter(APPEALS_PAGE);

		expect(frontmatter.title).toBe('Appeals');
		expect(frontmatter.tags).toEqual(['denials', 'appeals']);
		expect(frontmatter.updated).toBe('2026-07-13');
		expect(frontmatter.confidence).toBe('high');
		expect(body).toContain('# Appeals');
		expect(body).not.toContain('confidence:');
	});

	it('parses dash lists', () => {
		const { frontmatter } = parseFrontmatter(STATEMENTS_PAGE);

		expect(frontmatter.tags).toEqual(['billing', 'statements']);
	});

	it('strips surrounding quotes from values', () => {
		const { frontmatter } = parseFrontmatter('---\ntitle: "Quoted Title"\n---\n\n# X\n');
		expect(frontmatter.title).toBe('Quoted Title');
	});

	it('treats a document without a closing marker as having no frontmatter', () => {
		const raw = '---\ntitle: Broken\n# No closing marker\n';
		const { frontmatter, body } = parseFrontmatter(raw);

		expect(frontmatter.title).toBeNull();
		expect(body).toBe(raw);
	});

	it('returns empty metadata when there is no frontmatter', () => {
		const { frontmatter, body } = parseFrontmatter('# Just a heading\n\nBody text.\n');

		expect(frontmatter).toEqual({ title: null, tags: [], updated: null, confidence: null });
		expect(body).toContain('Just a heading');
	});
});

describe('splitSections', () => {
	it('splits into a preamble and heading-sized sections', () => {
		const sections = splitSections(
			'# Title\n\nIntro.\n\n## Part A\n\nAlpha.\n\n## Part B\n\nBeta.\n'
		);

		expect(sections.map((s) => s.heading)).toEqual(['Title', 'Part A', 'Part B']);
		expect(sections[1].content).toContain('Alpha.');
	});

	it('assigns preamble content a null heading', () => {
		const sections = splitSections('Some intro text without a heading.\n\n## Later\n\nMore.');

		expect(sections[0].heading).toBeNull();
		expect(sections[0].content).toContain('intro text');
	});

	it('drops empty sections', () => {
		const sections = splitSections('\n\n## Only\n\nContent.\n');
		expect(sections).toHaveLength(1);
	});
});

describe('isWithinRoot', () => {
	it('accepts files inside the root and rejects traversal outside it', () => {
		const root = path.resolve(wikiRoot);

		expect(isWithinRoot(root, path.join(root, 'a.md'))).toBe(true);
		expect(isWithinRoot(root, path.join(root, 'sub', 'b.md'))).toBe(true);
		expect(isWithinRoot(root, root)).toBe(true);
		expect(isWithinRoot(root, path.join(root, '..', 'outside.md'))).toBe(false);
		// Sibling directory sharing a path prefix must not count as inside.
		expect(isWithinRoot(root, `${root}-sibling/x.md`)).toBe(false);
	});
});

describe('searchWikiFiles', () => {
	it('finds nested Markdown, ranks title matches first, and cites stably', async () => {
		await writeWiki('denials/appeals.md', APPEALS_PAGE);
		await writeWiki('billing/statements.md', STATEMENTS_PAGE);

		const { sections, diagnostics } = await searchWikiFiles(wikiRoot, 'appeal criteria', 4);

		expect(diagnostics.filesScanned).toBe(2);
		expect(sections.length).toBeGreaterThan(0);

		const first = sections[0];
		expect(first.relative_path).toBe('denials/appeals.md');
		expect(first.title).toBe('Appeals');
		expect(first.citation_id).toMatch(/^denials\/appeals\.md#/);
		expect(first.confidence).toBe('high');
		expect(first.updated).toBe('2026-07-13');
		// Never leaks the host absolute path.
		expect(JSON.stringify(sections)).not.toContain(wikiRoot);
	});

	it('prefers heading matches over body-only matches', async () => {
		await writeWiki(
			'a.md',
			'---\ntitle: Mentions Only\n---\n\n# Other\n\nThe word cadence appears here in body text.\n'
		);
		await writeWiki(
			'b.md',
			'---\ntitle: Unrelated Title\n---\n\n# Cadence Schedule\n\nTiming details.\n'
		);

		const { sections } = await searchWikiFiles(wikiRoot, 'cadence', 4);

		expect(sections[0].relative_path).toBe('b.md');
	});

	it('matches tags and ignores non-Markdown files', async () => {
		await writeWiki('billing/statements.md', STATEMENTS_PAGE);
		await writeWiki('notes.txt', 'statements should never be found here');
		await writeWiki('image.md.png', 'not markdown');

		const { sections, diagnostics } = await searchWikiFiles(wikiRoot, 'statements', 4);

		expect(diagnostics.filesScanned).toBe(1);
		expect(sections.length).toBeGreaterThan(0);
		expect(sections[0].relative_path).toBe('billing/statements.md');
	});

	it('skips a malformed page without breaking the search', async () => {
		await writeWiki('good.md', APPEALS_PAGE);
		await writeWiki('bad.md', '---\nunclosed frontmatter\n# dangling');

		const { sections, diagnostics } = await searchWikiFiles(wikiRoot, 'appeal', 4);

		// The malformed file is still parsed (its body contains "appeal"? no) —
		// the point is that the good page is returned regardless.
		expect(diagnostics.filesScanned).toBeGreaterThanOrEqual(1);
		expect(sections.some((s) => s.relative_path === 'good.md')).toBe(true);
	});

	it('respects the section limit', async () => {
		await writeWiki('a.md', APPEALS_PAGE);
		await writeWiki('b.md', STATEMENTS_PAGE);

		const { sections } = await searchWikiFiles(wikiRoot, 'the', 2);

		expect(sections.length).toBeLessThanOrEqual(2);
	});

	it('caps the combined result size', async () => {
		const bigBody = 'appeal '.padEnd(200_000, 'x');
		await writeWiki('big.md', `---\ntitle: Big Appeal Page\n---\n\n# Appeal\n\n${bigBody}\n`);

		const { sections } = await searchWikiFiles(wikiRoot, 'appeal', 5);
		const combined = sections.reduce((sum, s) => sum + s.content.length, 0);

		expect(combined).toBeLessThanOrEqual(14_500);
		expect(sections[0].content).toContain('[truncated]');
	});

	it('returns no sections for an unmatched query', async () => {
		await writeWiki('a.md', APPEALS_PAGE);

		const { sections } = await searchWikiFiles(wikiRoot, 'zzzzqqqq', 4);
		expect(sections).toEqual([]);
	});

	it('rejects an unreadable root', async () => {
		await expect(
			searchWikiFiles(path.join(wikiRoot, 'does-not-exist'), 'appeal', 4)
		).rejects.toThrow();
	});

	it('skips symlinks that resolve outside the root', async () => {
		const outside = await mkdtemp(path.join(tmpdir(), 'wiki-outside-'));
		try {
			await writeFile(path.join(outside, 'secret.md'), 'top secret appeal notes', 'utf8');
			await writeWiki('good.md', APPEALS_PAGE);
			let linkCreated = true;
			try {
				await symlink(outside, path.join(wikiRoot, 'linked-outside'), 'junction');
			} catch {
				linkCreated = false; // e.g. Windows without privilege
			}
			if (!linkCreated) return;

			const { sections } = await searchWikiFiles(wikiRoot, 'secret', 4);

			expect(sections).toEqual([]);
		} finally {
			await rm(outside, { recursive: true, force: true });
		}
	});
});

describe('getWikiStatus', () => {
	function supabaseStub(wikiEnabled: string | null) {
		return {
			from: () => ({
				select: () => ({
					eq: () => ({
						single: () =>
							Promise.resolve({
								data: wikiEnabled === null ? null : { name: 'wiki_enabled', value: wikiEnabled },
								error: null
							})
					})
				})
			})
		} as never;
	}

	it('reports unconfigured when WIKI_PATH is unset', async () => {
		const status = await getWikiStatus(supabaseStub('false'));

		expect(status.supported).toBe(true);
		expect(status.enabled).toBe(false);
		expect(status.configured).toBe(false);
		expect(status.readable).toBe(false);
		expect(status.error).toBe('WIKI_PATH is not set.');
	});

	it('reports health and page count for a valid root', async () => {
		await writeWiki('a.md', APPEALS_PAGE);
		await writeWiki('nested/b.md', STATEMENTS_PAGE);
		process.env.WIKI_PATH = wikiRoot;

		const status = await getWikiStatus(supabaseStub('true'));

		expect(status.enabled).toBe(true);
		expect(status.configured).toBe(true);
		expect(status.readable).toBe(true);
		expect(status.pageCount).toBe(2);
		expect(status.scannedAt).toEqual(expect.any(String));
		expect(status.error).toBeNull();
	});

	it('reports a safe error for an unreadable path', async () => {
		process.env.WIKI_PATH = path.join(wikiRoot, 'missing');

		const status = await getWikiStatus(supabaseStub('true'));

		expect(status.readable).toBe(false);
		expect(status.error).toBe('Configured path is not a readable directory.');
		expect(JSON.stringify(status)).not.toContain('ENOENT');
	});
});
