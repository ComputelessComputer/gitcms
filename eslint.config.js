import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".output", "dist", "node_modules", "src/routeTree.gen.ts", "pnpm-lock.yaml"],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Discourage useEffect at the call site (not the import — namespace
      // imports like `import * as React from "react"` would be false positives).
      // Prefer derived state, event handlers, React Query, or useMountEffect.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='useEffect']",
          message:
            "Avoid useEffect — prefer derived state, event handlers, React Query, or useMountEffect. If you really need it, add `// eslint-disable-next-line no-restricted-syntax` with a comment explaining why.",
        },
        {
          selector: "CallExpression[callee.object.name='React'][callee.property.name='useEffect']",
          message:
            "Avoid React.useEffect — prefer derived state, event handlers, React Query, or useMountEffect.",
        },
      ],
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Node-only build/bootstrap scripts. They run with `node scripts/*.mjs`
    // and use globals like `process` / `console` / Node async iteration —
    // none of which the default eslint env knows about.
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },
);
