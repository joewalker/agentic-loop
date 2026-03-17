import eslintJs from '@eslint/js';
import pluginN from 'eslint-plugin-n';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Inspect this config using `npx @eslint/config-inspector@latest`
 */

/**
 * @import { Linter } from 'eslint'
 */

// #region TypeScript
/**
 * @type {ReadonlyArray<Linter.Config>}
 */
const typescriptConfig = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    // Rules that we might like to enfore at some point
    name: 'typescript-eslint/ignored/postponed',
    rules: {
      '@typescript-eslint/no-deprecated': ['off'],
    },
  },
  {
    // Bug in typescript-eslint 8.50.x - rule crashes on certain patterns
    // https://github.com/typescript-eslint/typescript-eslint/issues
    name: 'typescript-eslint/ignored/buggy',
    rules: {
      '@typescript-eslint/no-useless-default-assignment': ['off'],
    },
  },
  {
    // Rules that are worth adhering to
    name: 'typescript-eslint/custom',
    rules: {
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'generic',
          readonly: 'generic',
        },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': false,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/consistent-generic-constructors': [
        'error',
        'constructor',
      ],
      '@typescript-eslint/consistent-indexed-object-style': ['error'],
      '@typescript-eslint/consistent-type-exports': ['error'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false,
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/explicit-module-boundary-types': [
        'error',
        {
          allowArgumentsExplicitlyTypedAsAny: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      '@typescript-eslint/no-base-to-string': [
        'error',
        {
          ignoredTypeNames: ['Request', 'RegExp'],
        },
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: true },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-shadow': ['warn'],
      '@typescript-eslint/no-unsafe-member-access': ['error'],
      '@typescript-eslint/no-unsafe-return': ['error'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': ['error'],
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true } },
      ],
      '@typescript-eslint/prefer-optional-chain': ['error'],
      '@typescript-eslint/prefer-promise-reject-errors': ['error'],
      '@typescript-eslint/restrict-plus-operands': ['error'],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
    },
  },
  {
    // Rules that seem marginal so we're ignoring them
    name: 'typescript-eslint/ignored/marginal',
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['off'],
      '@typescript-eslint/no-confusing-void-expression': ['off'],
      '@typescript-eslint/no-dynamic-delete': ['off'],
      '@typescript-eslint/no-empty-function': ['off'],
      '@typescript-eslint/no-empty-interface': ['off'],
      '@typescript-eslint/no-explicit-any': ['off'],
      '@typescript-eslint/no-invalid-void-type': ['off'],
      '@typescript-eslint/no-unnecessary-condition': ['off'],
      '@typescript-eslint/non-nullable-type-assertion-style': ['off'],
      '@typescript-eslint/require-await': ['off'],
    },
  },
  {
    // Rules that we disable for JSX / TSX
    name: 'typescript-eslint/ignored/tsx',
    files: ['**/*.{jsx,tsx}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['off'],
      '@typescript-eslint/explicit-module-boundary-types': ['off'],
    },
  },
  {
    // Rules that we disable for tests
    name: 'typescript-eslint/ignored/tests',
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/await-thenable': ['off'],
      '@typescript-eslint/explicit-function-return-type': ['off'],
      '@typescript-eslint/no-unsafe-argument': ['off'],
      '@typescript-eslint/no-unsafe-assignment': ['off'],
      '@typescript-eslint/no-unsafe-call': ['off'],
      '@typescript-eslint/no-unsafe-member-access': ['off'],
      '@typescript-eslint/unbound-method': ['off'],
    },
  },
];

// #region Node
/**
 * Using 'eslint-plugin-n' (the maintained fork of eslint-plugin-node).
 * @type {ReadonlyArray<Linter.Config>}
 */
const nodeConfig = [
  pluginN.configs['flat/recommended-module'],
  {
    name: 'eslint-plugin-n/customize',
    rules: {
      'n/no-extraneous-import': ['off'],
      'n/no-missing-import': ['off'],
      'n/no-unpublished-import': ['off'],
      'n/no-unpublished-require': ['off'],
      'n/no-unsupported-features/es-builtins': ['off'],
      'n/no-unsupported-features/es-syntax': ['off'],
      'n/no-unsupported-features/node-builtins': ['off'],
    },
  },
];

// #region Combined Config
export default [
  {
    name: 'local-config/files/ignored',
    ignores: [
      'cache/**',
      'ignore/**',
      '**/dist/**',
      '.claude/worktrees/**',
      './eslint.config.mjs',
      './vitest.config.ts',
    ],
  },

  {
    name: 'local-config/files/included',
    files: ['**/*.{js,mjs,cjs,ts}'],
  },

  eslintJs.configs.recommended,
  ...typescriptConfig,
  ...nodeConfig,

  {
    name: 'local-config/language-options',
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    name: 'local-config/customize',
    rules: {
      'array-callback-return': ['error'],
      'no-console': [
        'error',
        {
          allow: [
            'warn',
            'error',
            'time',
            'timeEnd',
            'group',
            'groupCollapsed',
            'groupEnd',
          ],
        },
      ],
      'no-unused-vars': ['off', { vars: 'all', args: 'none' }], // See @typescript-eslint/no-unused-vars
      'no-template-curly-in-string': ['error'],
      'no-useless-escape': ['error'],
      'prefer-template': ['error'],
      'require-atomic-updates': ['error'],
    },
  },
];
