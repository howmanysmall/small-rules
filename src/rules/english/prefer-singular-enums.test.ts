import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/english/prefer-singular-enums";

import type { RuleTestError } from "@small-rules/rule-harness/types";

function errorWithName(name: string): RuleTestError {
	return { message: `Enum name "${name}" should be singular.` };
}

describe("prefer-singular-enums", () => {
	ts.run("prefer-singular-enums", rule, {
		invalid: [
			// Regular plural -s
			{
				code: "enum SortOrders {MostRecent, LeastRecent, Newest, Oldest}",
				errors: [{ message: 'Enum name "SortOrders" should be singular.' }],
				documentation: { id: "fail", title: "Plural enum names" },
			},
			{ code: "enum Commands {Up, Down}", errors: [errorWithName("Commands")] },
			{ code: "enum Pages {Products, Orders}", errors: [errorWithName("Pages")] },

			// Programming-centric plurals
			{ code: "enum UserStatuses {}", errors: [errorWithName("UserStatuses")] },
			{ code: "enum Properties {}", errors: [errorWithName("Properties")] },
			{ code: "enum Categories {}", errors: [errorWithName("Categories")] },
			{ code: "enum Hooks {}", errors: [errorWithName("Hooks")] },
			{ code: "enum UserProps {}", errors: [errorWithName("UserProps")] },
			{ code: "enum Params {}", errors: [errorWithName("Params")] },
			{ code: "enum Options {}", errors: [errorWithName("Options")] },
			{ code: "enum Entries {}", errors: [errorWithName("Entries")] },
			{ code: "enum Keys {}", errors: [errorWithName("Keys")] },

			// Acronym plurals
			{ code: "enum IDs {}", errors: [errorWithName("IDs")] },
			{ code: "enum URLs {}", errors: [errorWithName("URLs")] },
			{ code: "enum APIs {}", errors: [errorWithName("APIs")] },
			{ code: "enum DTOs {}", errors: [errorWithName("DTOs")] },

			// Irregular plurals
			{ code: "enum Feet {Left, Right}", errors: [errorWithName("Feet")] },
			{ code: "enum People {}", errors: [errorWithName("People")] },
			{ code: "enum Children {}", errors: [errorWithName("Children")] },
			{ code: "enum Indices {}", errors: [errorWithName("Indices")] },
			{ code: "enum Matrices {}", errors: [errorWithName("Matrices")] },
			{ code: "enum Vertices {}", errors: [errorWithName("Vertices")] },
			{ code: "enum Axes {}", errors: [errorWithName("Axes")] },

			// Snake case / screaming snake case
			{ code: "enum USER_STATUSES {}", errors: [errorWithName("USER_STATUSES")] },

			// An all-caps word or a lowercase-s acronym is still a plural
			{ code: "enum USERS {}", errors: [errorWithName("USERS")] },
			{ code: "enum UserIDs {}", errors: [errorWithName("UserIDs")] },

			// A known short acronym with a trailing S is that acronym's plural
			{ code: "enum USER_IDS {}", errors: [errorWithName("USER_IDS")] },
			{ code: "enum UserIDS {}", errors: [errorWithName("UserIDS")] },
			{ code: "enum IDS {}", errors: [errorWithName("IDS")] },
		],
		valid: [
			{ code: "enum _ {Value}" },

			// Singular forms
			{ code: "enum SortOrder {MostRecent, LeastRecent, Newest, Oldest}" },
			{ code: "enum Command {Up, Down}" },
			{ code: "enum Page {Products, Orders}" },
			{
				code: "enum Status {}",
				documentation: { id: "pass", title: "Singular enum names" },
			},
			{ code: "enum UserStatus {}" },
			{ code: "enum ID {}" },
			{ code: "enum URL {}" },
			{ code: "enum API {}" },
			{ code: "enum Alias {}" },
			{ code: "enum Analysis {}" },
			{ code: "enum Class {}" },
			{ code: "enum Series {}" },
			{ code: "enum Species {}" },

			// An acronym or all-caps word that ends in S names one thing
			{ code: "enum OS {}" },
			{ code: "enum TargetOS {}" },
			{ code: "enum GPS {}" },
			{ code: "enum STATUS {}" },
			{ code: "enum ACCESS {}" },
		],
	});
});
