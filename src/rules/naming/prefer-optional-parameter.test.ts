import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/naming/prefer-optional-parameter";

describe("prefer-optional-parameter", () => {
	ts.run("prefer-optional-parameter", rule, {
		invalid: [
			{
				code: "function getOpeningTurns(scenario: ScenarioId | undefined): ReadonlyArray<ShownTurn> {}",
				output: "function getOpeningTurns(scenario?: ScenarioId): ReadonlyArray<ShownTurn> {}",
				errors: [{ messageId: "preferOptionalParameter" }],
				documentation: { id: "fail", title: "Undefined in a parameter union" },
			},
			{
				code: "const getOpeningTurns = (scenario: ScenarioId | undefined) => scenario;",
				output: "const getOpeningTurns = (scenario?: ScenarioId) => scenario;",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "const getOpeningTurns = (scenario: ScenarioId | undefined): ScenarioId | undefined => scenario;",
				output: "const getOpeningTurns = (scenario?: ScenarioId): ScenarioId | undefined => scenario;",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function pick(value: undefined | string): string | undefined { return value; }",
				output: "function pick(value?: string): string | undefined { return value; }",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function format(value: string | undefined | number): void {}",
				output: "function format(value?: string | number): void {}",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function format(value: string | undefined | undefined): void {}",
				output: "function format(value?: string): void {}",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "class Turns { get(scenario: ScenarioId | undefined): void {} }",
				output: "class Turns { get(scenario?: ScenarioId): void {} }",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "interface Api { get(scenario: ScenarioId | undefined): void; }",
				output: "interface Api { get(scenario?: ScenarioId): void; }",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "type Handler = (scenario: ScenarioId | undefined) => void;",
				output: "type Handler = (scenario?: ScenarioId) => void;",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "interface Api { (scenario: ScenarioId | undefined): void; }",
				output: "interface Api { (scenario?: ScenarioId): void; }",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "interface Api { new (scenario: ScenarioId | undefined): object; }",
				output: "interface Api { new (scenario?: ScenarioId): object; }",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "type Constructor = new (scenario: ScenarioId | undefined) => object;",
				output: "type Constructor = new (scenario?: ScenarioId) => object;",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "declare function getOpeningTurns(scenario: ScenarioId | undefined): void;",
				output: "declare function getOpeningTurns(scenario?: ScenarioId): void;",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "class Turns { constructor(private scenario: ScenarioId | undefined) {} }",
				output: "class Turns { constructor(private scenario?: ScenarioId) {} }",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function getOpeningTurns(scenario: ScenarioId | undefined, limit?: number): void {}",
				output: "function getOpeningTurns(scenario?: ScenarioId, limit?: number): void {}",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function getOpeningTurns(scenario: ScenarioId | undefined, limit = 10): void {}",
				output: "function getOpeningTurns(scenario?: ScenarioId, limit = 10): void {}",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function getOpeningTurns(scenario: ScenarioId | undefined, ...rest: number[]): void {}",
				output: "function getOpeningTurns(scenario?: ScenarioId, ...rest: number[]): void {}",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "interface Api { get({ id }: ScenarioOptions | undefined): void; }",
				output: "interface Api { get({ id }?: ScenarioOptions): void; }",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "declare function getOpeningTurns({ id }: ScenarioOptions | undefined): void;",
				output: "declare function getOpeningTurns({ id }?: ScenarioOptions): void;",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function getOpeningTurns(scenario: (ScenarioId | undefined)): void {}",
				output: "function getOpeningTurns(scenario?: ScenarioId): void {}",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "function getOpeningTurns(scenario: ScenarioId /* keep */ | undefined): void {}",
				output: null,
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "const turns = { scenario(value: ScenarioId | undefined) {} };",
				output: "const turns = { scenario(value?: ScenarioId) {} };",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
			{
				code: "const getOpeningTurns = function (scenario: ScenarioId | undefined) {};",
				output: "const getOpeningTurns = function (scenario?: ScenarioId) {};",
				errors: [{ messageId: "preferOptionalParameter" }],
			},
		],
		valid: [
			{
				code: "function getOpeningTurns(scenario?: ScenarioId): ReadonlyArray<ShownTurn> {}",
				documentation: { id: "pass", title: "Optional parameter syntax" },
			},
			"function getOptionalStringArrayProperty(value: null | undefined | UnknownRecord, propertyName: string): void {}",
			"function getOpeningTurns({ id }: ScenarioOptions | undefined): void {}",
			"const getOpeningTurns = ({ id }: ScenarioOptions | undefined) => id;",
			"const getOpeningTurns = function ({ id }: ScenarioOptions | undefined) { return id; };",
			"function getOpeningTurns([first]: ReadonlyArray<string> | undefined): void {}",
			"function getOpeningTurns(scenario: ScenarioId | undefined, count: number): void {}",
			"function getOpeningTurns(scenario: ScenarioId | undefined, count): void {}",
			"class Turns { set scenario(value: ScenarioId | undefined) {} }",
			"declare class Turns { set scenario(value: ScenarioId | undefined); }",
			"abstract class Turns { abstract set scenario(value: ScenarioId | undefined); }",
			"interface Turns { set scenario(value: ScenarioId | undefined); }",
			"const turns = { set scenario(value: ScenarioId | undefined) {} };",
			{
				code: [
					"function getOpeningTurns(",
					"\tscenario: ScenarioId | undefined,",
					"\tfallback: ScenarioId,",
					"): void {}",
				].join("\n"),
			},
			"function getOpeningTurns(scenario?: ScenarioId | undefined): void {}",
			"function getOpeningTurns(scenario: ScenarioId): void {}",
			"function getOpeningTurns(scenario: undefined): void {}",
			"function getOpeningTurns(scenario: undefined | undefined): void {}",
			"function getOpeningTurns(): string | undefined { return undefined; }",
			"function getOpeningTurns(callback: (scenario: ScenarioId) => void): void {}",
			"function getOpeningTurns(scenario: ScenarioId | undefined = {}): void {}",
			"function getOpeningTurns(...scenarios: (ScenarioId | undefined)[]): void {}",
			"function getOpeningTurns(this: Turns | undefined, scenario: ScenarioId): void {}",
			"type MaybeScenario = ScenarioId | undefined;",
			"interface Options { scenario: ScenarioId | undefined }",
		],
	});
});
