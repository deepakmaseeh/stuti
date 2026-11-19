import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'public/', '.wrangler/', '.lighthouseci/', '*_files/', '**/*.tmp.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      // `any` is allowed only at validated JSON boundaries (spec §20 rule 6)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
