import js from '@eslint/js';
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import tsParser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Real linting, wired into `npm run lint` (it used to be a second copy of
 * `tsc --noEmit`, which meant the ~8 `eslint-disable-next-line react-hooks/*`
 * suppressions in the codebase were silencing a linter that never ran — and
 * those suppressions sit exactly where the dependency-array bugs live).
 *
 * Only rules that catch real defects here are enabled; formatting is left to
 * the editor so this file stays reviewable.
 */
export default [
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'coverage/**', 'src/app/fonts/**'],
  },
  js.configs.recommended,
  // Uses Firebase's authoritative ANTLR grammar, so Rules syntax is checked
  // even on developer machines where the Java-backed emulator is unavailable.
  firebaseRulesPlugin.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', '*.mjs'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'error',
      // tsc owns identifier/typedef checking; no-undef false-positives on
      // DOM lib types (React, CanvasImageSource, MediaTrack*) in .ts files.
      'no-undef': 'off',
      // Unused symbols and impossible comparisons are tsc's job (noUnusedLocals
      // + strict); re-reporting them here only mutes the signal that matters.
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
