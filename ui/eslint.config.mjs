import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "generated/**",
      "coverage/**",
      "dist/**",
      "smartContracts/artifacts/**",
      "smartContracts/cache/**",
      "smartContracts/coverage/**",
      "smartContracts/typechain-types/**",
      "smartContracts/tests/**",
    ],
  },
  {
    files: ["smartContracts/sync-data.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
