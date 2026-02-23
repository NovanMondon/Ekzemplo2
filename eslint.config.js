import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
	{
		ignores: ["dist/**", "node_modules/**", "src/generated/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.node,
			},
		},
		rules: {
			"no-undef": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					"argsIgnorePattern": "^_",
					"varsIgnorePattern": "^_",
					"caughtErrorsIgnorePattern": "^_"
				}
			]
		},
	},
];
