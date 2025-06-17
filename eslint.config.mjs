import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import unicorn from "eslint-plugin-unicorn";

export default tseslint.config(
  {
    ignores: [
      ".esbuild",
      "node_modules",
      "pnpm-lock.yaml",
      ".wrangler",
      "worker-configuration.d.ts",
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      unicorn,
    },
  },
  {
    // Styling rules
    rules: {
      "spaced-comment": ["error", "always", { markers: ["/"] }],
      curly: "error",
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/consistent-type-definitions": "error",
      "unicorn/catch-error-name": "error",
    },
  },
  {
    // Relax strict rules
    rules: {
      "@typescript-eslint/no-explicit-any": ["off"],
    },
  },
  {
    rules: {
      // Strict rules
      eqeqeq: ["error", "smart"],
      "no-duplicate-imports": "error",
      // Ref: https://github.com/typescript-eslint/typescript-eslint/issues/3797
      "valid-typeof": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_.+", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/explicit-member-accessibility": "error",
      "@typescript-eslint/prefer-ts-expect-error": "error",
      "unicorn/no-useless-spread": "error",
      "unicorn/no-array-reduce": "error",
      "unicorn/no-array-for-each": "error",
    },
  },
  prettier,
);
