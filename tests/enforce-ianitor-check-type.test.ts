import { describe } from "vitest";
import rule from "$oxc-rules/enforce-ianitor-check-type";

import { ts } from "./rule-testers";

describe("enforce-ianitor-check-type", () => {
	// @ts-expect-error RuleTester types are stricter than the runtime shape.
	ts.run("enforce-ianitor-check-type", rule, {
		invalid: [
			{
				code: `
const isUser = Ianitor.strictInterface({
	name: Ianitor.string,
	age: Ianitor.number,
	profile: Ianitor.interface({
		email: Ianitor.string,
		settings: Ianitor.record(Ianitor.string, Ianitor.unknown),
	}),
});
`,
				errors: [{ messageId: "missingIanitorCheckType" }],
			},
			{
				code: `
const isMaybeName = Ianitor.optional(Ianitor.string);
const isFlag = Ianitor.boolean();
const isUnion = Ianitor.union(Ianitor.string, Ianitor.number);
const isRecord = Ianitor.record(Ianitor.string, Ianitor.number);
const isCustom = Ianitor.literal("ready");
`,
				errors: [
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "missingIanitorCheckType" },
				],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;

type ComplexAlias = {
	id: string;
	values: Array<number>;
	metadata: {
		label: string;
		flag: boolean;
	};
};
`,
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;

interface ComplexService extends BaseService {
	config: {
		mode: string;
		values: Array<number>;
	};
}
`,
				errors: [{ messageId: "complexInterfaceNeedsCheck" }],
				options: [{ interfacePenalty: 1 }],
			},
			{
				code: `
const marker: Ianitor.Check<string> = Ianitor.string;

type ConditionalValidator<T> = T extends string ? string[] : number[];
type FunctionValidator = (value: string[]) => number[];
type MappedValidator<T extends string> = { [Key in T]: number[] };
type IntersectionValidator = { name: string } & { age: number };

interface MethodValidator {
	getName(value: string[]): number[];
}
`,
				errors: [
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "missingIanitorCheckType" },
					{ messageId: "complexInterfaceNeedsCheck" },
				],
				options: [{ baseThreshold: 1, interfacePenalty: 1 }],
			},
		],
		valid: [
			{ code: "type Simple = string;" },
			{ code: "type BasicObject = { id: string; name: string };" },
			{
				code: `
type SearchTuple<T extends Instance> =
	| [instance: T, exception: undefined]
	| [instance: undefined, exception: string];

interface ChainableGetter<U extends Instance> {
	(name: string, shouldExit: true, findFirstChild?: FindFirstChild): LuaTuple<SearchTuple<U>>;
	(name: string, shouldExit?: boolean, findFirstChild?: FindFirstChild): ChainableGetter<U>;
	readonly _brand?: unknown;
}
`,
				options: [{ baseThreshold: 1, interfacePenalty: 1 }],
			},
			{ code: "const validator: Ianitor.Check<User> = Ianitor.interface({ name: Ianitor.string });" },
			{
				code: "const validator = Ianitor.strictInterface({ name: Ianitor.string });",
				options: [{ baseThreshold: 20 }],
			},
			{
				code: `
const isSpinOptions = Ianitor.strictInterface({
	maxAttempts: Ianitor.optional(Ianitor.number),
	random: Ianitor.optional(Ianitor.Random),
});
type SpinOptions = Ianitor.Static<typeof isSpinOptions>;
`,
			},
			{
				code: `
const isSpinOptions = Ianitor.strictInterface({
	maxAttempts: Ianitor.optional(Ianitor.number),
	random: Ianitor.optional(Ianitor.Random),
});
type SpinOptions = Readonly<Ianitor.Static<typeof isSpinOptions>>;
`,
			},
		],
	});
});
