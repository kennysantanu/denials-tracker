import { describe, it, expect } from 'vitest';
import { passwordSchema } from './auth';

describe('passwordSchema', () => {
	it('accepts valid password', () => {
		const result = passwordSchema.safeParse('MyP@ssw0rd123!');
		expect(result.success).toBe(true);
	});

	it('rejects password shorter than 12 chars', () => {
		const result = passwordSchema.safeParse('Ab1!short');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe('Password must be at least 12 characters');
		}
	});

	it('rejects password without uppercase', () => {
		const result = passwordSchema.safeParse('myp@ssw0rd123!');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('uppercase'))).toBe(true);
		}
	});

	it('rejects password without lowercase', () => {
		const result = passwordSchema.safeParse('MYP@SSW0RD123!');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('lowercase'))).toBe(true);
		}
	});

	it('rejects password without number', () => {
		const result = passwordSchema.safeParse('MyP@sswordLong!');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('number'))).toBe(true);
		}
	});

	it('rejects password without special character', () => {
		const result = passwordSchema.safeParse('MyPassw0rd1234');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('special character'))).toBe(true);
		}
	});
});
