import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "package-lock.json"],
  },

  // Base for every JS/JSX file (app + scripts + configs).
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs["recommended-latest"].rules,
      // JSX component references count as usage (otherwise `<Foo/>` after
      // `import Foo` reads as "unused" to the core rule).
      "react/jsx-uses-vars": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // The service worker runs in worker scope, not window scope.
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },

  // CLI scripts are supposed to print.
  {
    files: ["scripts/**", "*.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },

  // Vite React Refresh: components-only modules (warn — content/data modules
  // legitimately export non-components).
  {
    files: ["src/**/*.{jsx,tsx}"],
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
