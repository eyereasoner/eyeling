// eslint.config.js (CommonJS)
const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  setImmediate: "readonly",
  clearImmediate: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  exports: "readonly",
  module: "readonly",
  require: "readonly",
};

const mochaGlobals = {
  describe: "readonly",
  it: "readonly",
  before: "readonly",
  after: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
};

module.exports = [
  { ignores: ["eyeling.js"] },

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...nodeGlobals, ...mochaGlobals },
    },
    rules: {
      // keep the behavior that made lint pass
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];

