import { parse, walk } from "yuku-parser";

import type {
	ArrayExpression,
	CallExpression,
	Expression,
	Literal,
	Node,
	ObjectExpression,
	ObjectProperty,
	PropertyKey,
	TemplateLiteral,
} from "yuku-parser";

type StaticValue =
	| boolean
	| null
	| number
	| string
	| ReadonlyArray<StaticValue>
	| { readonly [key: string]: StaticValue };

export interface RuleExample {
	readonly code: string;
	readonly errors?: StaticValue;
	readonly filename?: string;
	readonly id: string;
	readonly kind: "invalid" | "valid";
	readonly language?: string;
	readonly options?: StaticValue;
	readonly output?: StaticValue;
	readonly settings?: StaticValue;
	readonly sourceType?: string;
	readonly suggestions?: StaticValue;
	readonly title: string;
}

export interface ExtractedRuleExamples {
	readonly examples: ReadonlyArray<RuleExample>;
	readonly ruleName: string;
}

interface ExtractionContext {
	readonly relativePath: string;
	readonly sourceText: string;
}

interface ObjectField {
	readonly key: string;
	readonly property: ObjectProperty;
}

interface CaseArray {
	readonly cases: ArrayExpression;
	readonly kind: "invalid" | "valid";
}

const CASE_FIELD_NAMES = new Set([
	"code",
	"documentation",
	"errors",
	"filename",
	"language",
	"only",
	"options",
	"output",
	"settings",
	"skip",
	"sourceType",
	"suggestions",
]);
const RUNNER_NAMES = new Set(["js", "jsx", "ts", "tsx"]);

export function extractRuleExamples(sourceText: string, relativePath: string): ReadonlyArray<ExtractedRuleExamples> {
	const context = { relativePath, sourceText };
	const parsed = parse(sourceText, { lang: "ts", sourceType: "module" });
	const [firstDiagnostic] = parsed.diagnostics;
	if (firstDiagnostic !== undefined) {
		throwExtractionError(context, firstDiagnostic.start, `failed to parse source: ${firstDiagnostic.message}`);
	}

	const examplesByRuleName = new Map<string, Array<RuleExample>>();
	const idOffsetsByRuleName = new Map<string, Map<string, number>>();
	walk(parsed.program, {
		CallExpression(node) {
			const invocation = getRuleRunnerInvocation(node);
			if (invocation === undefined) return;
			const idOffsets = idOffsetsByRuleName.get(invocation.ruleName) ?? new Map<string, number>();
			idOffsetsByRuleName.set(invocation.ruleName, idOffsets);
			const examples = extractInvocationExamples(invocation.cases, context, idOffsets);
			if (examples.length === 0) return;
			const existingExamples = examplesByRuleName.get(invocation.ruleName);
			if (existingExamples === undefined) examplesByRuleName.set(invocation.ruleName, examples);
			else existingExamples.push(...examples);
		},
	});

	return [...examplesByRuleName.entries()]
		.map(([ruleName, examples]) => ({ examples: orderExamples(examples), ruleName }))
		.toSorted((left, right) => left.ruleName.localeCompare(right.ruleName));
}

function getRuleRunnerInvocation(
	node: CallExpression,
): { readonly cases: ObjectExpression; readonly ruleName: string } | undefined {
	if (!isRuleRunner(node.callee)) return undefined;
	const [ruleNameNode, , casesNode] = node.arguments;
	if (!isStringLiteral(ruleNameNode) || casesNode?.type !== "ObjectExpression") return undefined;
	return { cases: casesNode, ruleName: ruleNameNode.value };
}

function isRuleRunner(callee: Expression): boolean {
	return (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.object.type === "Identifier" &&
		RUNNER_NAMES.has(callee.object.name) &&
		callee.property.type === "Identifier" &&
		callee.property.name === "run"
	);
}

function extractInvocationExamples(
	cases: ObjectExpression,
	context: ExtractionContext,
	idOffsets: Map<string, number>,
): Array<RuleExample> {
	const examples = new Array<RuleExample>();
	for (const caseArray of getCaseArrays(cases, context)) {
		for (const element of caseArray.cases.elements) {
			if (element?.type !== "ObjectExpression") continue;
			const example = extractCaseExample(element, caseArray.kind, context);
			if (example === undefined) continue;
			const idOffset = getDocumentationIdOffset(element);
			if (idOffsets.has(example.id)) {
				throwExtractionError(context, idOffset, `duplicate documentation example ID "${example.id}".`);
			}
			idOffsets.set(example.id, idOffset);
			examples.push(example);
		}
	}
	return examples;
}

function getCaseArrays(cases: ObjectExpression, context: ExtractionContext): Array<CaseArray> {
	const caseArrays = new Array<CaseArray>();
	for (const field of getObjectFields(cases, context)) {
		if (field.key !== "invalid" && field.key !== "valid") continue;
		if (field.property.value.type !== "ArrayExpression") continue;
		caseArrays.push({ cases: field.property.value, kind: field.key });
	}
	return caseArrays;
}

function extractCaseExample(
	testCase: ObjectExpression,
	kind: "invalid" | "valid",
	context: ExtractionContext,
): RuleExample | undefined {
	const documentationValue = findField(testCase, "documentation")?.property.value;
	if (documentationValue?.type !== "ObjectExpression") {
		return undefined;
	}
	const fields = getObjectFields(testCase, context);
	for (const field of fields) {
		if (!CASE_FIELD_NAMES.has(field.key)) {
			throwExtractionError(context, field.property.start, `unknown field "${field.key}" in documented case.`);
		}
		if (field.key === "only" || field.key === "skip") {
			throwExtractionError(context, field.property.start, `documented cases cannot use ${field.key}.`);
		}
	}

	const documentation = evaluateDocumentation(documentationValue, context);
	const code = evaluateRequiredString(fields, "code", context);
	const example: RuleExample = { code, id: documentation.id, kind, title: documentation.title };
	for (const field of fields) {
		if (field.key === "documentation" || field.key === "code") continue;
		const value = evaluateStatic(field.property.value, context);
		if (field.key === "filename" || field.key === "language" || field.key === "sourceType") {
			if (typeof value !== "string") {
				throwExtractionError(context, field.property.value.start, `${field.key} must evaluate to a string.`);
			}
			Object.assign(example, { [field.key]: value });
		} else Object.assign(example, { [field.key]: value });
	}
	return example;
}

function evaluateDocumentation(
	value: Expression,
	context: ExtractionContext,
): { readonly id: string; readonly title: string } {
	if (value.type !== "ObjectExpression") {
		throwExtractionError(context, value.start, "documentation must be an object with id and title.");
	}
	const fields = getObjectFields(value, context);
	const id = evaluateRequiredString(fields, "id", context, "documentation.");
	const title = evaluateRequiredString(fields, "title", context, "documentation.");
	for (const field of fields) {
		if (field.key !== "id" && field.key !== "title") {
			throwExtractionError(context, field.property.start, "documentation only supports id and title.");
		}
	}
	return { id, title };
}

function evaluateRequiredString(
	fields: ReadonlyArray<ObjectField>,
	name: string,
	context: ExtractionContext,
	prefix = "",
): string {
	const field = fields.find((candidate) => candidate.key === name);
	if (field === undefined) throwExtractionError(context, 0, `${prefix}${name} is required.`);
	const value = evaluateStatic(field.property.value, context);
	if (typeof value !== "string") {
		throwExtractionError(context, field.property.value.start, `${prefix}${name} must evaluate to a string.`);
	}
	return value;
}

function getObjectFields(object: ObjectExpression, context: ExtractionContext): Array<ObjectField> {
	const fields = new Array<ObjectField>();
	for (const property of object.properties) {
		if (property.type === "SpreadElement") {
			throwExtractionError(context, property.start, "spread properties are not supported.");
		}
		if (property.computed) throwExtractionError(context, property.start, "computed object keys are not supported.");
		if (property.kind !== "init" || property.method) {
			throwExtractionError(context, property.start, "object methods, getters, and setters are not supported.");
		}
		fields.push({ key: getStaticKey(property.key, context), property });
	}
	return fields;
}

function findField(object: ObjectExpression, name: string): ObjectField | undefined {
	for (const property of object.properties) {
		if (property.type !== "Property" || property.computed || property.kind !== "init" || property.method) continue;
		if (property.key.type === "Identifier" && property.key.name === name) return { key: name, property };
		if (isStringLiteral(property.key) && property.key.value === name) return { key: name, property };
	}
	return undefined;
}

function getDocumentationIdOffset(testCase: ObjectExpression): number {
	const documentation = findField(testCase, "documentation");
	if (documentation?.property.value.type !== "ObjectExpression") return testCase.start;
	return findField(documentation.property.value, "id")?.property.value.start ?? documentation.property.value.start;
}

function getStaticKey(key: PropertyKey, context: ExtractionContext): string {
	if (key.type === "Identifier") return key.name;
	if (isStringLiteral(key)) return key.value;
	return throwExtractionError(context, key.start, "object keys must be static strings.");
}

function evaluateStatic(node: Expression, context: ExtractionContext): StaticValue {
	if (isStaticLiteral(node)) return node.value;
	if (node.type === "TemplateLiteral") return evaluateTemplate(node, context);
	if (node.type === "TaggedTemplateExpression" && isStringRawTag(node.tag)) {
		return evaluateTemplate(node.quasi, context);
	}
	if (node.type === "ArrayExpression") return evaluateArray(node, context);
	if (node.type === "ObjectExpression") return evaluateObject(node, context);
	if (node.type === "CallExpression" && isStringJoin(node)) return evaluateStringJoin(node, context);
	if (node.type === "Identifier") {
		throwExtractionError(context, node.start, "identifier references are not supported.");
	}
	if (node.type === "CallExpression") throwExtractionError(context, node.start, "function calls are not supported.");
	return throwExtractionError(context, node.start, `${node.type} values are not supported.`);
}

function isStaticLiteral(node: Expression): node is Literal & { readonly value: boolean | null | number | string } {
	return (
		node.type === "Literal" &&
		(typeof node.value === "boolean" ||
			typeof node.value === "number" ||
			typeof node.value === "string" ||
			node.value === null) &&
		!("regex" in node) &&
		(typeof node.value !== "number" || Number.isFinite(node.value))
	);
}

function isStringLiteral(node: Node | undefined): node is Literal & { readonly value: string } {
	return node?.type === "Literal" && typeof node.value === "string";
}

function evaluateTemplate(template: TemplateLiteral, context: ExtractionContext): string {
	if (template.expressions.length > 0) {
		throwExtractionError(context, template.start, "interpolated template literals are not supported.");
	}
	return template.quasis.map((quasi) => quasi.value.cooked).join("");
}

function isStringRawTag(tag: Expression): boolean {
	return (
		tag.type === "MemberExpression" &&
		!tag.computed &&
		tag.object.type === "Identifier" &&
		tag.object.name === "String" &&
		tag.property.type === "Identifier" &&
		tag.property.name === "raw"
	);
}

function evaluateArray(array: ArrayExpression, context: ExtractionContext): ReadonlyArray<StaticValue> {
	const values = new Array<StaticValue>();
	for (const element of array.elements) {
		if (element === null) throwExtractionError(context, array.start, "array holes are not supported.");
		if (element.type === "SpreadElement") {
			throwExtractionError(context, element.start, "array spreads are not supported.");
		}
		values.push(evaluateStatic(element, context));
	}
	return values;
}

function evaluateObject(object: ObjectExpression, context: ExtractionContext): Record<string, StaticValue> {
	const value: Record<string, StaticValue> = {};
	for (const field of getObjectFields(object, context)) {
		value[field.key] = evaluateStatic(field.property.value, context);
	}
	return value;
}

function isStringJoin(node: CallExpression): boolean {
	const [separator] = node.arguments;
	return (
		node.callee.type === "MemberExpression" &&
		!node.callee.computed &&
		node.callee.object.type === "ArrayExpression" &&
		node.callee.property.type === "Identifier" &&
		node.callee.property.name === "join" &&
		node.arguments.length === 1 &&
		isStringLiteral(separator) &&
		separator.value === "\n"
	);
}

function evaluateStringJoin(node: CallExpression, context: ExtractionContext): string {
	if (node.callee.type !== "MemberExpression" || node.callee.object.type !== "ArrayExpression") {
		throwExtractionError(context, node.start, "function calls are not supported.");
	}
	const values = evaluateArray(node.callee.object, context);
	if (!values.every((value) => typeof value === "string")) {
		throwExtractionError(context, node.callee.object.start, "join arrays must contain only strings.");
	}
	return values.join("\n");
}

function orderExamples(examples: ReadonlyArray<RuleExample>): Array<RuleExample> {
	return examples.toSorted((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

function throwExtractionError(context: ExtractionContext, offset: number, reason: string): never {
	const position = getSourcePosition(context.sourceText, offset);
	const error = new Error(`${context.relativePath}:${position.line}:${position.column}: ${reason}`);
	Error.captureStackTrace(error, throwExtractionError);
	throw error;
}

function getSourcePosition(sourceText: string, offset: number): { readonly column: number; readonly line: number } {
	const prefix = Buffer.from(sourceText).subarray(0, offset).toString("utf8");
	const lastLineBreak = prefix.lastIndexOf("\n");
	return { column: prefix.length - lastLineBreak, line: prefix.split("\n").length };
}
