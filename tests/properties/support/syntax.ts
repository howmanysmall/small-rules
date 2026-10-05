import { fc } from "@fast-check/vitest";

import type { Arbitrary } from "fast-check";

// Plain dictionary words: none is a keyword, a Roblox global, or an
// abbreviation that `prevent-abbreviations` would rename.
export const wordArbitrary = fc.constantFrom(
	"anchor",
	"banner",
	"cargo",
	"dragon",
	"ember",
	"falcon",
	"garden",
	"harbor",
	"island",
	"jungle",
	"kettle",
	"lantern",
	"meadow",
	"nectar",
	"orchard",
	"pepper",
	"quartz",
	"river",
	"saddle",
	"timber",
	"velvet",
	"walnut",
	"zephyr",
);

export function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

function joinCamelCase([head, tail]: readonly [string, string | undefined]): string {
	return tail === undefined ? head : head + capitalize(tail);
}

/** A camelCase identifier made of one or two dictionary words. */
export const identifierArbitrary = fc
	.tuple(wordArbitrary, fc.option(wordArbitrary, { nil: undefined }))
	.map(joinCamelCase);

/** A PascalCase identifier, suitable for components, classes, and types. */
export const pascalIdentifierArbitrary = identifierArbitrary.map(capitalize);

export const integerLiteralArbitrary = fc.nat().map(String);

export const stringLiteralArbitrary = wordArbitrary.map((word) => JSON.stringify(word));

const binaryOperatorArbitrary = fc.constantFrom("+", "-", "*", "/", "%", "<", ">", "===", "!==", "&&", "||", "??");

type ExpressionArbitraries = Record<
	"array" | "arrow" | "binary" | "call" | "conditional" | "expression" | "leaf" | "member" | "object" | "primary",
	string
>;

function renderObject(entries: ReadonlyArray<readonly [string, string]>): string {
	const properties = entries.map(([key, value]) => `${key}: ${value}`);
	return `({ ${properties.join(", ")} })`;
}

const expressionArbitraries = fc.letrec<ExpressionArbitraries>((tie) => ({
	array: fc.array(tie("expression"), { size: "xsmall" }).map((items) => `[${items.join(", ")}]`),
	arrow: fc.tuple(identifierArbitrary, tie("expression")).map(([parameter, body]) => `((${parameter}) => ${body})`),
	binary: fc
		.tuple(tie("expression"), binaryOperatorArbitrary, tie("expression"))
		.map(([left, operator, right]) => `(${left} ${operator} ${right})`),
	call: fc
		.tuple(tie("primary"), fc.array(tie("expression"), { size: "xsmall" }))
		.map(([callee, parameters]) => `${callee}(${parameters.join(", ")})`),
	conditional: fc
		.tuple(tie("expression"), tie("expression"), tie("expression"))
		.map(([test, consequent, alternate]) => `(${test} ? ${consequent} : ${alternate})`),
	expression: fc.oneof(
		{ depthSize: "xsmall", withCrossShrink: true },
		tie("leaf"),
		tie("call"),
		tie("member"),
		tie("binary"),
		tie("conditional"),
		tie("array"),
		tie("object"),
		tie("arrow"),
	),
	leaf: fc.oneof(
		identifierArbitrary,
		integerLiteralArbitrary,
		stringLiteralArbitrary,
		fc.constantFrom("true", "false", "undefined"),
	),
	member: fc.tuple(tie("primary"), wordArbitrary).map(([object, property]) => `${object}.${property}`),
	object: fc
		.uniqueArray(fc.tuple(wordArbitrary, tie("expression")), { selector: ([key]) => key, size: "xsmall" })
		.map(renderObject),
	primary: fc.oneof({ depthSize: "xsmall", withCrossShrink: true }, identifierArbitrary, tie("call"), tie("member")),
}));

/** Arbitrary side-effecting or pure expressions, nested to a small depth. */
export const expressionArbitrary = expressionArbitraries.expression;

/** Call and member chains, usable as a callee or a receiver. */
export const primaryArbitrary = expressionArbitraries.primary;

/** Expressions that can be the target of an assignment. */
export const assignableArbitrary = fc.oneof(identifierArbitrary, expressionArbitraries.member);

type StatementArbitraries = Record<
	"block" | "declaration" | "expressionStatement" | "forOf" | "functionDeclaration" | "ifStatement" | "statement",
	string
>;

function renderIf([test, consequent, alternate]: readonly [string, string, string | undefined]): string {
	const head = `if (${test}) {\n${consequent}\n}`;
	return alternate === undefined ? head : `${head} else {\n${alternate}\n}`;
}

const statementArbitraries = fc.letrec<StatementArbitraries>((tie) => ({
	block: fc.array(tie("statement"), { size: "xsmall" }).map((statements) => statements.join("\n")),
	declaration: fc
		.tuple(fc.constantFrom("const", "let"), identifierArbitrary, expressionArbitrary)
		.map(([kind, name, value]) => `${kind} ${name} = ${value};`),
	expressionStatement: expressionArbitraries.call.map((call) => `${call};`),
	forOf: fc
		.tuple(identifierArbitrary, expressionArbitrary, tie("block"))
		.map(([name, iterable, body]) => `for (const ${name} of ${iterable}) {\n${body}\n}`),
	functionDeclaration: fc
		.tuple(identifierArbitrary, tie("block"))
		.map(([name, body]) => `function ${name}() {\n${body}\n}`),
	ifStatement: fc.tuple(expressionArbitrary, tie("block"), fc.option(tie("block"), { nil: undefined })).map(renderIf),
	statement: fc.oneof(
		{ depthSize: "xsmall", withCrossShrink: true },
		tie("declaration"),
		tie("expressionStatement"),
		tie("ifStatement"),
		tie("forOf"),
		tie("functionDeclaration"),
	),
}));

/** A possibly empty run of statements, nested to a small depth. */
export const blockArbitrary = statementArbitraries.block;

/** Unrelated filler statements that surround the code under test. */
export const fillerArbitrary = fc.array(statementArbitraries.statement, { size: "xsmall" });

/** A syntactic construct that encloses a list of statements. */
export type Frame =
	| { readonly iterable: string; readonly kind: "forOf"; readonly name: string }
	| { readonly kind: "arrow"; readonly name: string }
	| { readonly kind: "block" }
	| { readonly kind: "class"; readonly method: string; readonly name: string }
	| { readonly kind: "function"; readonly name: string }
	| { readonly kind: "if"; readonly test: string };

const blockFrameArbitrary = fc.record({ kind: fc.constant("block") });
const functionFrameArbitrary = fc.record({ name: identifierArbitrary, kind: fc.constant("function") });
const arrowFrameArbitrary = fc.record({ name: identifierArbitrary, kind: fc.constant("arrow") });
const ifFrameArbitrary = fc.record({ kind: fc.constant("if"), test: expressionArbitrary });
const forOfFrameArbitrary = fc.record({
	name: identifierArbitrary,
	iterable: expressionArbitrary,
	kind: fc.constant("forOf"),
});
const classFrameArbitrary = fc.record({
	name: pascalIdentifierArbitrary,
	kind: fc.constant("class"),
	method: identifierArbitrary,
});

export const frameArbitrary: Arbitrary<Frame> = fc.oneof(
	blockFrameArbitrary,
	functionFrameArbitrary,
	arrowFrameArbitrary,
	ifFrameArbitrary,
	forOfFrameArbitrary,
	classFrameArbitrary,
);

/** Function-like frames only: each one opens a new variable scope. */
export const scopeFrameArbitrary: Arbitrary<Frame> = fc.oneof(
	functionFrameArbitrary,
	arrowFrameArbitrary,
	classFrameArbitrary,
);

function wrapInFrame(frame: Frame, body: string): string {
	switch (frame.kind) {
		case "arrow":
			return `const ${frame.name} = () => {\n${body}\n};`;
		case "block":
			return `{\n${body}\n}`;
		case "class":
			return `class ${frame.name} {\n${frame.method}() {\n${body}\n}\n}`;
		case "forOf":
			return `for (const ${frame.name} of ${frame.iterable}) {\n${body}\n}`;
		case "function":
			return `function ${frame.name}() {\n${body}\n}`;
		default:
			return `if (${frame.test}) {\n${body}\n}`;
	}
}

/**
 * Nests statements inside frames.
 *
 * @param frames - The enclosing frames, the first one being the outermost.
 * @param body - The statements to nest.
 * @returns The nested code.
 */
export function wrapInFrames(frames: ReadonlyArray<Frame>, body: string): string {
	let code = body;
	for (const frame of frames.toReversed()) code = wrapInFrame(frame, code);
	return code;
}

/** JSX attributes with distinct PascalCase names, as Roblox properties use. */
export const jsxAttributesArbitrary = fc
	.uniqueArray(fc.tuple(wordArbitrary.map(capitalize), expressionArbitrary), {
		selector: ([name]) => name,
		size: "xsmall",
	})
	.map((attributes) => attributes.map(([name, value]) => ` ${name}={${value}}`).join(""));

type JsxArbitraries = Record<"child" | "element" | "leafElement" | "parentElement", string>;

const intrinsicElementArbitrary = fc.constantFrom("frame", "imagelabel", "scrollingframe", "textbutton", "textlabel");

function renderParentElement([tag, attributes, children]: readonly [string, string, ReadonlyArray<string>]): string {
	return `<${tag}${attributes}>${children.join("")}</${tag}>`;
}

const jsxArbitraries = fc.letrec<JsxArbitraries>((tie) => ({
	child: fc.oneof(
		{ depthSize: "xsmall", withCrossShrink: true },
		tie("leafElement"),
		expressionArbitrary.map((expression) => `{${expression}}`),
		tie("parentElement"),
	),
	element: fc.oneof({ depthSize: "xsmall", withCrossShrink: true }, tie("leafElement"), tie("parentElement")),
	leafElement: fc
		.tuple(intrinsicElementArbitrary, jsxAttributesArbitrary)
		.map(([tag, attributes]) => `<${tag}${attributes} />`),
	parentElement: fc
		.tuple(intrinsicElementArbitrary, jsxAttributesArbitrary, fc.array(tie("child"), { size: "xsmall" }))
		.map(renderParentElement),
}));

/** A JSX element tree built from Roblox intrinsic elements. */
export const jsxElementArbitrary = jsxArbitraries.element;
