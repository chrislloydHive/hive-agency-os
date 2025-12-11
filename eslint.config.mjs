import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import js from "@eslint/js";

const eslintConfig = [
  // Base JavaScript config
  js.configs.recommended,
  // TypeScript configs
  ...tseslint.configs.recommended,
  // Global ignores
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  // Next.js and React specific rules
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // TypeScript rules - warnings instead of errors
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      // General rules
      "no-unused-vars": "off", // Use TypeScript version instead
    },
  },
];

export default eslintConfig;
