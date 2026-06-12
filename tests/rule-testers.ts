import parser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";

export const js = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
});

export const jsx = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module",
	},
});

export const ts = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

export const tsx = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		parserOptions: { ecmaFeatures: { jsx: true } },
		sourceType: "module",
	},
});
