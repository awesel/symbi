module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "seed_emulator.js", // Ignore seed file
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    "max-len": [
      "error",
      {
        code: 140,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreComments: true,
      },
    ],
    "object-curly-spacing": ["error", "always"], // Enforce spacing in object literals, auto-fixed earlier
    "arrow-parens": ["error", "always"], // Enforce parentheses around arrow function arguments, auto-fixed earlier
    "comma-dangle": ["error", "always-multiline"], // Enforce trailing commas in multiline, auto-fixed earlier
  },
  overrides: [
    {
      files: ["*.test.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "warn", // Allow 'any' in test files with a warning
        "max-len": [
          "warn",
          {
            code: 140,
            ignoreUrls: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
            ignoreComments: true,
          },
        ], // Be even more lenient with line length in tests
      },
    },
  ],
};
