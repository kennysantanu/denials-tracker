import type { CustomThemeConfig } from '@skeletonlabs/tw-plugin';

export const defaultTheme: CustomThemeConfig = {
	name: 'default',
	properties: {
		// =~= Theme Properties =~=
		'--theme-font-family-base': `system-ui`,
		'--theme-font-family-heading': `system-ui`,
		'--theme-font-color-base': '0 0 0',
		'--theme-font-color-dark': '255 255 255',
		'--theme-rounded-base': '8px',
		'--theme-rounded-container': '8px',
		'--theme-border-base': '1px',
		// =~= Theme On-X Colors =~=
		'--on-primary': '255 255 255',
		'--on-secondary': 'var(--color-tertiary-500)',
		'--on-tertiary': '0 0 0',
		'--on-success': '0 0 0',
		'--on-warning': '0 0 0',
		'--on-error': '255 255 255',
		'--on-surface': '0 0 0',
		// =~= Theme Colors  =~=
		// primary | #00125F
		'--color-primary-50': '217 219 231', // #d9dbe7
		'--color-primary-100': '204 208 223', // #ccd0df
		'--color-primary-200': '191 196 215', // #bfc4d7
		'--color-primary-300': '153 160 191', // #99a0bf
		'--color-primary-400': '77 89 143', // #4d598f
		'--color-primary-500': '0 18 95', // #00125F
		'--color-primary-600': '0 16 86', // #001056
		'--color-primary-700': '0 14 71', // #000e47
		'--color-primary-800': '0 11 57', // #000b39
		'--color-primary-900': '0 9 47', // #00092f
		// secondary | #dee2ed
		'--color-secondary-50': '250 251 252', // #fafbfc
		'--color-secondary-100': '248 249 251', // #f8f9fb
		'--color-secondary-200': '247 248 251', // #f7f8fb
		'--color-secondary-300': '242 243 248', // #f2f3f8
		'--color-secondary-400': '232 235 242', // #e8ebf2
		'--color-secondary-500': '222 226 237', // #dee2ed
		'--color-secondary-600': '200 203 213', // #c8cbd5
		'--color-secondary-700': '167 170 178', // #a7aab2
		'--color-secondary-800': '133 136 142', // #85888e
		'--color-secondary-900': '109 111 116', // #6d6f74
		// tertiary | #1DCFFF
		'--color-tertiary-50': '217 222 242', // #d9def2
		'--color-tertiary-100': '204 211 238', // #ccd3ee
		'--color-tertiary-200': '191 200 234', // #bfc8ea
		'--color-tertiary-300': '153 166 221', // #99a6dd
		'--color-tertiary-400': '77 100 196', // #4d64c4
		'--color-tertiary-500': '0 33 171', // #0021AB
		'--color-tertiary-600': '0 30 154', // #001e9a
		'--color-tertiary-700': '0 25 128', // #001980
		'--color-tertiary-800': '0 20 103', // #001467
		'--color-tertiary-900': '0 16 84', // #001054
		// success | #7CFC00
		'--color-success-50': '235 255 217', // #ebffd9
		'--color-success-100': '229 254 204', // #e5fecc
		'--color-success-200': '222 254 191', // #defebf
		'--color-success-300': '203 254 153', // #cbfe99
		'--color-success-400': '163 253 77', // #a3fd4d
		'--color-success-500': '124 252 0', // #7CFC00
		'--color-success-600': '112 227 0', // #70e300
		'--color-success-700': '93 189 0', // #5dbd00
		'--color-success-800': '74 151 0', // #4a9700
		'--color-success-900': '61 123 0', // #3d7b00
		// warning | #FFD700
		'--color-warning-50': '255 249 217', // #fff9d9
		'--color-warning-100': '255 247 204', // #fff7cc
		'--color-warning-200': '255 245 191', // #fff5bf
		'--color-warning-300': '255 239 153', // #ffef99
		'--color-warning-400': '255 227 77', // #ffe34d
		'--color-warning-500': '255 215 0', // #FFD700
		'--color-warning-600': '230 194 0', // #e6c200
		'--color-warning-700': '191 161 0', // #bfa100
		'--color-warning-800': '153 129 0', // #998100
		'--color-warning-900': '125 105 0', // #7d6900
		// error | #b11031
		'--color-error-50': '243 219 224', // #f3dbe0
		'--color-error-100': '239 207 214', // #efcfd6
		'--color-error-200': '236 195 204', // #ecc3cc
		'--color-error-300': '224 159 173', // #e09fad
		'--color-error-400': '200 88 111', // #c8586f
		'--color-error-500': '177 16 49', // #b11031
		'--color-error-600': '159 14 44', // #9f0e2c
		'--color-error-700': '133 12 37', // #850c25
		'--color-error-800': '106 10 29', // #6a0a1d
		'--color-error-900': '87 8 24', // #570818
		// surface | #d9d9d9
		'--color-surface-50': '249 249 249', // #f9f9f9
		'--color-surface-100': '247 247 247', // #f7f7f7
		'--color-surface-200': '246 246 246', // #f6f6f6
		'--color-surface-300': '240 240 240', // #f0f0f0
		'--color-surface-400': '228 228 228', // #e4e4e4
		'--color-surface-500': '217 217 217', // #d9d9d9
		'--color-surface-600': '195 195 195', // #c3c3c3
		'--color-surface-700': '163 163 163', // #a3a3a3
		'--color-surface-800': '130 130 130', // #828282
		'--color-surface-900': '106 106 106' // #6a6a6a
	}
};
