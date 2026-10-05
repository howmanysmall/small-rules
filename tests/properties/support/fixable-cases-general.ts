import { fc } from "@fast-check/vitest";

import { defineFixableCase } from "./fixable-case";
import {
	assignableArbitrary,
	blockArbitrary,
	capitalize,
	expressionArbitrary,
	frameArbitrary,
	identifierArbitrary,
	integerLiteralArbitrary,
	pascalIdentifierArbitrary,
	primaryArbitrary,
	scopeFrameArbitrary,
	stringLiteralArbitrary,
	wordArbitrary,
} from "./syntax";

import type { FixableCase } from "./fixable-case";

// Abbreviations with exactly one default replacement, which makes them
// fixable. `cur`/`curr` and `el`/`elem` share a replacement on purpose.
const fixableAbbreviationArbitrary = fc.constantFrom(
	"arr",
	"btn",
	"cb",
	"ctx",
	"cur",
	"curr",
	"el",
	"elem",
	"err",
	"evt",
	"idx",
	"len",
	"msg",
	"prev",
	"src",
	"temp",
);

// Names the fixer renames to, declared alongside the abbreviations so renames
// have to avoid them.
const replacementNameArbitrary = fc.constantFrom(
	"current",
	"current_",
	"element",
	"error",
	"error_",
	"index",
	"message",
);

const declaredNameArbitrary = fc.tuple(
	fc.oneof(fixableAbbreviationArbitrary, replacementNameArbitrary),
	expressionArbitrary,
);

const preventAbbreviations = defineFixableCase({
	frames: fc
		.tuple(fc.array(frameArbitrary, { size: "-1" }), scopeFrameArbitrary)
		.map(([outer, scope]) => outer.toSpliced(outer.length, 0, scope)),
	language: "ts",
	render: (declarations) => ({
		statements: declarations.flatMap(([name, value]) => [`let ${name} = ${value};`, `${name} = ${name};`]),
	}),
	rule: "prevent-abbreviations",
	trigger: fc.uniqueArray(declaredNameArbitrary, { minLength: 1, selector: ([name]) => name }),
});

const identityCallbackArbitrary = fc
	.tuple(identifierArbitrary, fc.constantFrom("arrow", "annotated", "block", "function"))
	.map(([parameter, form]) => {
		switch (form) {
			case "annotated":
				return `(${parameter}: number) => ${parameter}`;
			case "arrow":
				return `(${parameter}) => ${parameter}`;
			case "block":
				return `(${parameter}) => { return ${parameter}; }`;
			default:
				return `function (${parameter}) { return ${parameter}; }`;
		}
	});

const noIdentityMap = defineFixableCase({
	language: "ts",
	render: ({ callbacks, receiver }, id) => {
		const chain = callbacks.map((callback) => `.map(${callback})`).join("");
		return { statements: [`const mapped${id} = ${receiver}${chain};`] };
	},
	rule: "no-identity-map",
	trigger: fc.record({
		callbacks: fc.array(identityCallbackArbitrary, { minLength: 1 }),
		receiver: primaryArbitrary,
	}),
});

const noIncrementDecrement = defineFixableCase({
	language: "ts",
	options: [{ allowAutofix: true }],
	render: ({ operator, placement, prefix, target }, id) => {
		const update = prefix ? `${operator}${target}` : `${target}${operator}`;
		switch (placement) {
			case "expression":
				return { statements: [`consume${id}(${update});`] };
			case "for":
				return { statements: [`for (let index${id} = 0; index${id} < ${target}; ${update}) {}`] };
			default:
				return { statements: [`${update};`] };
		}
	},
	rule: "no-increment-decrement",
	trigger: fc.record({
		operator: fc.constantFrom("++", "--"),
		placement: fc.constantFrom("expression", "for", "statement"),
		prefix: fc.boolean(),
		target: assignableArbitrary,
	}),
});

const importedNameArbitrary = fc.record({ name: identifierArbitrary, used: fc.boolean() });

function renderImportClause(defaultName: string | undefined, namedImports: ReadonlyArray<string>): string {
	const clauses = defaultName === undefined ? [] : [defaultName];
	if (namedImports.length > 0) clauses.push(`{ ${namedImports.join(", ")} }`);
	return clauses.join(", ");
}

function renderUsage(name: string, typeOnly: boolean): string {
	return typeOnly ? `let value${name}: ${name};` : `${name}();`;
}

const namedImportsArbitrary = fc.uniqueArray(importedNameArbitrary, { selector: ({ name }) => name });

const valueImportArbitrary = fc.record({
	defaultImport: importedNameArbitrary,
	named: namedImportsArbitrary,
	source: wordArbitrary,
	typeOnly: fc.constant(false),
});

const typeImportArbitrary = fc.record({
	defaultImport: fc.constant(undefined),
	named: fc.uniqueArray(importedNameArbitrary, { minLength: 1, selector: ({ name }) => name }),
	source: wordArbitrary,
	typeOnly: fc.boolean(),
});

const noUnusedImports = defineFixableCase({
	language: "ts",
	render: ({ defaultImport, named, source, typeOnly }, id) => {
		const bindings = named.map(({ name, used }) => ({ name: `${name}${id}`, used }));
		const defaultName = defaultImport === undefined ? undefined : `${capitalize(defaultImport.name)}${id}`;
		const clause = renderImportClause(
			defaultName,
			bindings.map(({ name }) => name),
		);
		if (defaultName !== undefined) bindings.push({ name: defaultName, used: defaultImport?.used === true });

		return {
			module: [`${typeOnly ? "import type" : "import"} ${clause} from "./${source}${id}";`],
			statements: bindings.flatMap(({ name, used }) => (used ? [renderUsage(name, typeOnly)] : [])),
		};
	},
	rule: "no-unused-imports",
	// `import type` cannot combine a default and named bindings, so type-only
	// imports never have a default binding.
	trigger: fc.oneof(valueImportArbitrary, typeImportArbitrary),
});

const constantNameArbitrary = fc
	.uniqueArray(wordArbitrary, { minLength: 1 })
	.map((words) => words.join("_").toUpperCase());

const staticInitializerArbitrary = fc.oneof(
	integerLiteralArbitrary,
	stringLiteralArbitrary,
	fc
		.tuple(integerLiteralArbitrary, integerLiteralArbitrary)
		.map(([scale, offset]) => `new UDim(${scale}, ${offset})`),
	fc
		.tuple(integerLiteralArbitrary, integerLiteralArbitrary, integerLiteralArbitrary)
		.map(([red, green, blue]) => `Color3.fromRGB(${red}, ${green}, ${blue})`),
);

const noUselessConstants = defineFixableCase({
	language: "ts",
	render: ({ key, name, initializer, middle }, id) => ({
		module: [
			`const ${name}_${id} = ${initializer};`,
			...middle.map((value, index) => `const MIDDLE_${id}_${index} = ${value};`),
			`const STYLE_${id} = { ${capitalize(key)}: ${name}_${id} };`,
		],
	}),
	rule: "no-useless-constants",
	trigger: fc.record({
		key: wordArbitrary,
		name: constantNameArbitrary,
		initializer: staticInitializerArbitrary,
		middle: fc.array(integerLiteralArbitrary, { size: "-1" }),
	}),
});

const expectationArbitrary = fc
	.tuple(expressionArbitrary, fc.constantFrom("toBe", "toEqual", "toStrictEqual"), integerLiteralArbitrary)
	.map(([actual, matcher, expected]) => `expect(${actual}).${matcher}(${expected});`);

const preferExpectAssertions = defineFixableCase({
	filename: "case.test.ts",
	frames: fc.constant([]),
	language: "ts",
	render: ({ expectations, title, wrapInDescribe }) => {
		const test = `test(${JSON.stringify(title)}, () => {\nexpect.hasAssertions();\n${expectations.join("\n")}\n});`;
		return { statements: [wrapInDescribe ? `describe(${JSON.stringify(title)}, () => {\n${test}\n});` : test] };
	},
	rule: "prefer-expect-assertions",
	trigger: fc.record({
		expectations: fc.array(expectationArbitrary, { minLength: 1 }),
		title: wordArbitrary,
		wrapInDescribe: fc.boolean(),
	}),
});

const switchCaseArbitrary = fc.record({
	body: blockArbitrary,
	braced: fc.boolean(),
	breaks: fc.boolean(),
	test: fc.option(fc.oneof(integerLiteralArbitrary, stringLiteralArbitrary), { nil: undefined }),
});

const requireSwitchCaseBraces = defineFixableCase({
	language: "ts",
	render: ({ cases, discriminant }) => {
		const clauses = cases.map(({ body, braced, breaks, test }) => {
			const label = test === undefined ? "default:" : `case ${test}:`;
			const statements = breaks ? `${body}\nbreak;` : body;
			return braced ? `${label} {\n${statements}\n}` : `${label}\n${statements}`;
		});
		return { statements: [`switch (${discriminant}) {\n${clauses.join("\n")}\n}`] };
	},
	rule: "require-switch-case-braces",
	trigger: fc.record({
		cases: fc.uniqueArray(switchCaseArbitrary, { minLength: 1, selector: ({ test }) => test }),
		discriminant: expressionArbitrary,
	}),
});

const throwArbitrary = fc
	.tuple(
		fc.constantFrom("Error", "RangeError", "TypeError"),
		fc.option(stringLiteralArbitrary, { nil: undefined }),
		fc.constantFrom("block", "bare", "guarded", "nested"),
		expressionArbitrary,
	)
	.map(([errorClass, message, placement, test]) => {
		const statement = `throw new ${errorClass}(${message ?? ""});`;
		switch (placement) {
			case "bare":
				return statement;
			case "block":
				return `{\n${statement}\n}`;
			case "guarded":
				return `if (${test}) ${statement}`;
			default:
				return `if (${test}) {\n${statement}\n}`;
		}
	});

const requireThrowErrorCapture = defineFixableCase({
	language: "ts",
	render: ({ name, form, preexisting, throws }, id) => {
		const body = [...preexisting.map((local) => `const ${local} = ${JSON.stringify(local)};`), ...throws].join(
			"\n",
		);
		switch (form) {
			case "arrow":
				return { statements: [`const ${name}${id} = () => {\n${body}\n};`] };
			case "function":
				return { statements: [`function ${name}${id}() {\n${body}\n}`] };
			default:
				return { statements: [`class ${capitalize(name)}${id} {\n${name}() {\n${body}\n}\n}`] };
		}
	},
	rule: "require-throw-error-capture",
	trigger: fc.record({
		name: identifierArbitrary,
		form: fc.constantFrom("arrow", "function", "method"),
		preexisting: fc.subarray(["error", "error2"]),
		throws: fc.array(throwArbitrary, { minLength: 1 }),
	}),
});

type TypeArbitraries = Record<"array" | "generic" | "leaf" | "readonlyArray" | "tuple" | "type" | "union", string>;

const typeArbitraries = fc.letrec<TypeArbitraries>((tie) => ({
	array: tie("type").map((element) => `${element}[]`),
	generic: fc
		.tuple(fc.constantFrom("Array", "Map", "ReadonlyArray", "Set"), tie("type"))
		.map(([name, argument]) => `${name}<${argument}>`),
	leaf: fc.oneof(fc.constantFrom("boolean", "number", "string"), pascalIdentifierArbitrary),
	readonlyArray: tie("type").map((element) => `readonly ${element}[]`),
	tuple: fc.array(tie("type"), { minLength: 1 }).map((elements) => `[${elements.join(", ")}]`),
	type: fc.oneof(
		{ depthSize: "xsmall", withCrossShrink: true },
		tie("leaf"),
		tie("array"),
		tie("readonlyArray"),
		tie("tuple"),
		tie("generic"),
		tie("union"),
	),
	union: fc.tuple(tie("type"), tie("type")).map(([left, right]) => `(${left} | ${right})`),
}));

const arrayTypeGeneric = defineFixableCase({
	language: "ts",
	render: ({ element, placement }, id) =>
		placement === "alias"
			? { statements: [`type Alias${id} = ${element}[];`] }
			: { statements: [`let annotated${id}: ${element}[] = [];`] },
	rule: "array-type-generic",
	trigger: fc.record({
		element: typeArbitraries.type,
		placement: fc.constantFrom("alias", "annotation"),
	}),
});

export const GENERAL_FIXABLE_CASES: ReadonlyArray<FixableCase> = [
	arrayTypeGeneric,
	noIdentityMap,
	noIncrementDecrement,
	noUnusedImports,
	noUselessConstants,
	preferExpectAssertions,
	preventAbbreviations,
	requireSwitchCaseBraces,
	requireThrowErrorCapture,
];
