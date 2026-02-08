import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
// import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    // plugins: {
    //   "unused-imports": unusedImports,
    // },
    rules: {
      "@typescript-eslint/no-explicit-any": "error", // <--  warning width any
      "react-hooks/exhaustive-deps": "off", // Disable exhaustive deps check
      // "unused-imports/no-unused-imports": "error", // import no using
      // "unused-imports/no-unused-vars": [
      //   "warn",
      //   {
      //     vars: "all",
      //     varsIgnorePattern: "^_",
      //     args: "after-used",
      //     argsIgnorePattern: "^_",
      //   },
      // ], //variable no using
    },
  },
];

export default eslintConfig;
