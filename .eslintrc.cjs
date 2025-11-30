/**
 * This is intended to be a basic starting point for linting in your app.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  globals: {
    Deno: "readonly",
  },
  ignorePatterns: ["!**/.server", "!**/.client", "deno-tests/**", "server/**"],

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
        "import/resolver": {
          typescript: {},
        },
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
      ],
    },

    // Node
    {
      files: [".eslintrc.js"],
      env: {
        node: true,
      },
    },

    // Deno
    {
      files: ["server/**/*.ts", "server/**/*.tsx", "deno-tests/**/*.ts"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",
      env: {
        browser: false,
        node: false,
      },
      globals: {
        Deno: "readonly",
      },
      parserOptions: {
        // Deno uses URL imports and modern ES modules
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.deno.json",
      },
      settings: {
        "import/resolver": {
          typescript: {
            project: "./tsconfig.deno.json",
          },
        },
      },
      rules: {
        // Allow Deno-style URL imports
        "import/no-unresolved": "off",
        "@typescript-eslint/no-namespace": "off",
        // Deno uses top-level await
        "@typescript-eslint/no-floating-promises": "off",
      },
    },
  ],
};
