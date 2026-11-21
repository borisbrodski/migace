import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['**/node_modules/**', '**/out/**', '**/dist/**', '**/generated/**', 'website/**', '**/.astro/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            semi: ['error', 'always'],
        },
    },
    {
        files: ['**/*.mjs'],
        languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
    },
    {
        // Database-specific code is reached through interfaces that core/ defines.
        files: ['core/**'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [
                    { regex: '(^|/)databases(/|$)', message: 'core/ imports nothing from databases/.' },
                    { regex: '(^|/)migql/generators(/|$)', message: 'core/ imports nothing from migql/generators/.' },
                ],
            }],
        },
    },
);
