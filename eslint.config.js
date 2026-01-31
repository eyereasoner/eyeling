// eslint.config.js
'use strict';

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  // Ignore generated / vendor / coverage output
  {
    ignores: ['node_modules/**', 'eyeling.js', 'coverage/**', 'dist/**', '*.min.js'],
  },

  // Base config: Node/CommonJS code
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        // CommonJS
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',

        // Node
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',

        // Modern Node global web-ish APIs
        URL: 'readonly',
        URLSearchParams: 'readonly',

        // Timers
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      // correctness
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],

      // noisy rules: keep as warnings for now
      'no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      'prefer-const': 'warn', // avoids hard failures where auto-fix can’t rewrite safely
      eqeqeq: 'off',
      'no-redeclare': 'off', // tools/n3gen.js currently triggers this

      // light style
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      indent: ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-infix-ops': 'error',
      'keyword-spacing': 'error',
      'eol-last': ['error', 'always'],

      'no-console': 'off',
    },
  },

  // Browser-ish file(s): deref uses DOM / XHR
  {
    files: ['lib/deref.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        location: 'readonly',
        XMLHttpRequest: 'readonly',
      },
    },
  },

  // Tests that use WebSocket (and may run in environments that provide it)
  {
    files: ['test/playground.test.js'],
    languageOptions: {
      globals: {
        WebSocket: 'readonly',
      },
    },
  },
];
