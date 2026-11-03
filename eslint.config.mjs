import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
export default [
  { ignores: [".next/**", "node_modules/**", "package-lock.json"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
