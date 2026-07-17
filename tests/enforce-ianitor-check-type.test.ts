import { describe } from "vitest";
import rule from "$oxc-rules/enforce-ianitor-check-type";

import { ts } from "./rule-testers";

describe("enforce-ianitor-check-type", () => {
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
				documentation: { id: "fail", title: "Ianitor schema without check type" },
				errors: [{ messageId: "missingIanitorCheckType" }],
			},
			{
				code: "const validator = Ianitor.array(Ianitor.string);",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: "const validator = Ianitor.instanceOf(Folder);",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: "const validator = Ianitor.boolean();",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: "const validator = Ianitor.union(Ianitor.string, Ianitor.number);",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: "const validator = Ianitor.map(Ianitor.string, Ianitor.number);",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: "const validator = Ianitor.custom((value): value is string => typeIs(value, 'string'));",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: "const validator = Ianitor.intersection(Ianitor.string, Ianitor.number);",
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.interface({
	name: Ianitor.string,
	flags: Ianitor.array(Ianitor.string),
});
`,
				errors: [{ messageId: "missingIanitorCheckType" }],
				options: [{ baseThreshold: 1 }],
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
			{
				code: "const validator: Ianitor.Check<User> = Ianitor.interface({ name: Ianitor.string });",
				documentation: { id: "pass", title: "explicit Ianitor check type" },
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
				options: [{ interfacePenalty: 1 }],
			},
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
			{
				code: `
const validator = Ianitor.string;
type ComplexResult<T> = T extends string
	? { value: T; nested: Array<{ id: number }> }
	: ReadonlyArray<{ fallback: boolean }>;
`,
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;
type ComplexMap<T extends string> = {
	[K in T]: { key: K; values: [number, string, boolean] };
};
`,
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;
type ComplexFunction = (input: { id: string; tags: string[] }) => Promise<{ ok: boolean }>;
`,
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;
interface ComplexService extends BaseService, Disposable {
	readonly run: (payload: { id: string; count: number }) => void;
}
`,
				options: [{ interfacePenalty: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;
const ignored = createValidator();
`,
			},
			{
				code: `
const validator = Ianitor["string"]();
`,
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;
type NotStatic = Ianitor.Check<typeof validator>;
`,
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;
type NotIanitorStatic = Validator.Static<typeof validator>;
`,
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;
type NotStaticMember = Ianitor.Check<typeof validator>;
`,
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;
type StaticWithoutQuery = Ianitor.Static<string>;
`,
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;
type UnqualifiedStatic = Static<typeof validator>;
`,
				options: [{ baseThreshold: 1 }],
			},
		],
	});
});

describe("enforce-ianitor-check-type - coverage locks", () => {
	ts.run("enforce-ianitor-check-type - coverage locks", rule, {
		invalid: [],
		valid: [
			{
				code: `
const validator: Ianitor.Check<string> = Ianitor.string();

interface ApiPayload extends BasePayload {
	result: [id: string, count: number];
}
`,
				options: [{ interfacePenalty: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;

type Label = string;
`,
				options: [{ baseThreshold: 2 }],
			},
			{
				code: `
const validator = Ianitor.string;

interface ComplexService extends BaseService, Disposable {
	readonly run: (payload: { id: string; tags: string[] }) => Promise<{ ok: boolean }>;
}
`,
				options: [{ interfacePenalty: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;

type ComplexRegistry<T extends string> = {
	[K in T]: { key: K; values: [number, string, boolean] };
};
`,
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;

type TupleWithOptionalAndRest = [id?: string, ...values: number[]];
`,
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;

interface CallableService {
	run();
}
`,
				options: [{ interfacePenalty: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;

type ValidatedEntity = Ianitor.Static<typeof validator> & {
	id: string;
	profile: {
		name: string;
		tags: Array<string>;
	};
};
`,
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;

type ReadonlyWithoutArguments = Readonly;
type QualifiedStatic = Ianitor.Static<typeof Validators.user>;
`,
				options: [{ baseThreshold: 1, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.interface(schema);
`,
				options: [{ baseThreshold: 1 }],
			},
			{
				code: `
const validator = Ianitor.string;

type PrimitiveCoverage =
	| any
	| never
	| unknown
	| bigint
	| boolean
	| null
	| number
	| string
	| symbol
	| undefined
	| void;
`,
				options: [{ baseThreshold: 100, performanceMode: false }],
			},
			{
				code: `
const validator = Ianitor.string;

type FlagMap<T extends string> = {
	[K in T];
};
`,
				options: [{ baseThreshold: 100, performanceMode: false }],
			},
		],
	});
});
