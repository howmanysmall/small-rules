import { describe } from "vitest";
import rule from "$oxc-rules/prefer-pascal-case-enums";

import { ts } from "./rule-testers";

function errorWithName(name: string): { message: string } {
	return {
		message: `Enum '${name}' uses non-standard casing. TypeScript convention requires PascalCase for enum names and members to distinguish them from variables (camelCase) and constants (UPPER_CASE). Rename to PascalCase: capitalize first letter of each word, no underscores.`,
	};
}

describe("prefer-pascal-case-enums", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	ts.run("prefer-pascal-case-enums", rule, {
		invalid: [
			// All caps
			{ code: "enum SORTORDER {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("SORTORDER")] },
			// All lowercase
			{ code: "enum sortorder {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("sortorder")] },
			// Snake case
			{
				code: "enum sort_order {MostRecent, LeastRecent, Newest, Oldest}",
				errors: [errorWithName("sort_order")],
			},
			// CamelCase
			{ code: "enum sortOrder {MostRecent, LeastRecent, Newest, Oldest}", errors: [errorWithName("sortOrder")] },
			// Both name and member invalid
			{
				code: "enum sortOrder {mostRecent, LeastRecent, Newest, Oldest}",
				errors: [errorWithName("sortOrder"), errorWithName("mostRecent")],
			},
			// Valid name, invalid members
			{
				code: "enum SortOrder {MOSTRECENT, least_recent, Newest, Oldest}",
				errors: [errorWithName("MOSTRECENT"), errorWithName("least_recent")],
			},
			// String literal member (not starting with digit)
			{
				code: "enum Example {'foo' = 'bar', '1024x1024' = '1024x1024', Oldest}",
				errors: [errorWithName("foo")],
			},
		],
		valid: [
			// Proper PascalCase
			{ code: "enum SortOrder {MostRecent, LeastRecent, Newest, Oldest}" },

			// Single letter enum members (valid per Shopify rule)
			{ code: "enum Grade {A, B, C, D, E, F}" },
			{ code: "enum Axis {X, Y, Z}" },
			{ code: "enum Tier {S, A, B, C}" },

			// Acronym-style PascalCase (valid per change-case)
			{ code: "enum Space {CFrame, Vector3, UDim2}" },
			{ code: "enum Upgrade {UPlus, Standard}" },
			{ code: "enum Font {GothamSSm, SourceSans}" },

			// Single letter enum name
			{ code: "enum X {Foo, Bar}" },
		],
	});
});
