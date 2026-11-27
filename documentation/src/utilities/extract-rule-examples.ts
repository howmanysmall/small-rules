import { Predicate } from "effect";
import { parse, walk } from "yuku";

import { ExtractionError } from "../classes/extraction-error";

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
} from "yuku";

import type { ExtractionContext } from "../classes/extraction-error";

type StaticValue =
	| boolean
	| null
	| number
	| ReadonlyArray<StaticValue>
	| string
	| { readonly [key: string]: StaticValue };

type StaticObject = Record<string, StaticValue>;

interface DocumentationMetadata {
	readonly id: string;
	readonly preserveFormatting?: boolean | undefined;
	readonly title: string;
}

export interface RuleExample {
	readonly id: string;
	readonly code: string;
	readonly errors?: StaticValue | undefined;
	readonly filename?: string | undefined;
	readonly kind: "invalid" | "valid";
	readonly language?: string | undefined;
	readonly options?: StaticValue | undefined;
	readonly output?: StaticValue | undefined;
	readonly preserveFormatting?: boolean | undefined;
	readonly settings?: StaticValue | undefined;
	readonly sourceType?: string | undefined;
	readonly suggestions?: StaticValue | undefined;
	readonly title: string;
}

export interface ExtractedRuleExamples {
	readonly examples: ReadonlyArray<RuleExample>;
	readonly ruleName: string;
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
	const extractionContext = { relativePath, sourceText } satisfies ExtractionContext;
	const parsed = parse(sourceText, { lang: "ts", sourceType: "module" });
	const [firstDiagnostic] = parsed.diagnostics;
	if (firstDiagnostic !== undefined) {
		throw new ExtractionError(
			extractionContext,
			firstDiagnostic.start,
			`failed to parse source: ${firstDiagnostic.message}`,
		);
	}

	const examplesByRuleName = new Map<string, Array<RuleExample>>();
	const idOffsetsByRuleName = new Map<string, Map<string, number>>();
	walk(parsed.program, {
		CallExpression(node) {
			const invocation = getRuleRunnerInvocation(node);
			if (invocation === undefined) return;

			const idOffsets = idOffsetsByRuleName.get(invocation.ruleName) ?? new Map<string, number>();
			idOffsetsByRuleName.set(invocation.ruleName, idOffsets);

			const examples = extractInvocationExamples(
				invocation.cases,
				invocation.language,
				extractionContext,
				idOffsets,
			);

			if (examples.length === 0) return;

			const existingExamples = examplesByRuleName.get(invocation.ruleName);
			if (existingExamples === undefined) {
				examplesByRuleName.set(invocation.ruleName, examples);
			} else {
				for (const example of examples) {
					existingExamples.push(example);
				}
			}
		},
	});

	return Array.from(examplesByRuleName, ([ruleName, examples]) => ({
		examples: orderExamples(examples),
		ruleName,
	})).toSorted((left, right) => left.ruleName.localeCompare(right.ruleName));
}

interface RunnerInvocation {
	readonly cases: ObjectExpression;
	readonly language: string;
	readonly ruleName: string;
}

function getRuleRunnerInvocation(node: CallExpression): RunnerInvocation | undefined {
	if (!isRuleRunner(node.callee)) return undefined;

	const [ruleNameNode, , casesNode] = node.arguments;
	if (
		!isStringLiteral(ruleNameNode) ||
		casesNode?.type !== "ObjectExpression" ||
		node.callee.type !== "MemberExpression" ||
		node.callee.object.type !== "Identifier"
	) {
		return undefined;
	}

	return { cases: casesNode, language: node.callee.object.name, ruleName: ruleNameNode.value };
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
	runnerLanguage: string,
	extractionContext: ExtractionContext,
	idOffsets: Map<string, number>,
): Array<RuleExample> {
	const examples = new Array<RuleExample>();
	for (const caseArray of getCaseArrays(cases, extractionContext)) {
		for (const element of caseArray.cases.elements) {
			if (element?.type !== "ObjectExpression") continue;

			const example = extractCaseExample(element, caseArray.kind, runnerLanguage, extractionContext);
			if (example === undefined) continue;

			const idOffset = getDocumentationIdOffset(element);
			if (idOffsets.has(example.id)) {
				throw new ExtractionError(
					extractionContext,
					idOffset,
					`duplicate documentation example ID "${example.id}".`,
				);
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

function validateFields(extractionContext: ExtractionContext, objectFields: ReadonlyArray<ObjectField>): void {
	for (const field of objectFields) {
		if (!CASE_FIELD_NAMES.has(field.key)) {
			throw new ExtractionError(
				extractionContext,
				field.property.start,
				`unknown field "${field.key}" in documented case.`,
			);
		}

		if (field.key === "only" || field.key === "skip") {
			throw new ExtractionError(
				extractionContext,
				field.property.start,
				`documented cases cannot use ${field.key}.`,
			);
		}
	}
}

// oxlint-disable-next-line jsdoc-js/convert-to-jsdoc-comments -- shut up
// fallow-ignore-next-line complexity
function extractCaseExample(
	testCase: ObjectExpression,
	kind: "invalid" | "valid",
	runnerLanguage: string,
	extractionContext: ExtractionContext,
): RuleExample | undefined {
	const documentationValue = findField(testCase, "documentation")?.property.value;
	if (documentationValue?.type !== "ObjectExpression") return undefined;

	const fields = getObjectFields(testCase, extractionContext);
	validateFields(extractionContext, fields);

	const documentation = evaluateDocumentation(documentationValue, extractionContext);
	const code = evaluateRequiredString(fields, "code", extractionContext);
	const example: RuleExample = {
		id: documentation.id,
		code,
		kind,
		language: runnerLanguage,
		title: documentation.title,
	};

	if (documentation.preserveFormatting === true) {
		Object.assign(example, { preserveFormatting: true });
	}

	for (const field of fields) {
		if (field.key === "documentation" || field.key === "code") continue;
		const value = evaluateStatic(field.property.value, extractionContext);
		if (
			(field.key === "filename" || field.key === "language" || field.key === "sourceType") &&
			!Predicate.isString(value)
		) {
			throw new ExtractionError(
				extractionContext,
				field.property.value.start,
				`${field.key} must evaluate to a string.`,
			);
		}

		Object.assign(example, { [field.key]: value });
	}

	return example;
}

const DOCUMENTATION_FIELD_NAMES = new Set(["id", "preserveFormatting", "title"]);
const DOCUMENTATION_FIELD_PREFIX = "documentation.";

function evaluateDocumentation(value: Expression, extractionContext: ExtractionContext): DocumentationMetadata {
	if (value.type !== "ObjectExpression") {
		throw new ExtractionError(extractionContext, value.start, "documentation must be an object with id and title.");
	}

	const fields = getObjectFields(value, extractionContext);
	const id = evaluateRequiredString(fields, "id", extractionContext, DOCUMENTATION_FIELD_PREFIX);
	const title = evaluateRequiredString(fields, "title", extractionContext, DOCUMENTATION_FIELD_PREFIX);
	const preserveFormatting = evaluateOptionalField(
		fields,
		"preserveFormatting",
		Predicate.isBoolean,
		"boolean",
		extractionContext,
		DOCUMENTATION_FIELD_PREFIX,
	);

	for (const field of fields) {
		if (!DOCUMENTATION_FIELD_NAMES.has(field.key)) {
			throw new ExtractionError(
				extractionContext,
				field.property.start,
				"documentation only supports id, preserveFormatting, and title.",
			);
		}
	}

	return { id, preserveFormatting, title };
}

function evaluateOptionalField<Value extends StaticValue>(
	fields: ReadonlyArray<ObjectField>,
	name: string,
	guard: (value: StaticValue) => value is Value,
	expectedType: string,
	context: ExtractionContext,
	prefix = "",
): undefined | Value {
	const field = fields.find((candidate) => candidate.key === name);
	if (field === undefined) return undefined;

	const value = evaluateStatic(field.property.value, context);
	if (!guard(value)) {
		throw new ExtractionError(
			context,
			field.property.value.start,
			`${prefix}${name} must evaluate to a ${expectedType}.`,
		);
	}

	return value;
}

function evaluateRequiredString(
	fields: ReadonlyArray<ObjectField>,
	name: string,
	context: ExtractionContext,
	prefix = "",
): string {
	const value = evaluateOptionalField(fields, name, Predicate.isString, "string", context, prefix);
	if (value === undefined) {
		throw new ExtractionError(context, 0, `${prefix}${name} is required.`);
	}

	return value;
}

function getObjectFields(object: ObjectExpression, context: ExtractionContext): Array<ObjectField> {
	const fields = new Array<ObjectField>();
	let size = 0;
	for (const property of object.properties) {
		if (property.type === "SpreadElement") {
			throw new ExtractionError(context, property.start, "spread properties are not supported.");
		}

		if (property.computed) {
			throw new ExtractionError(context, property.start, "computed object keys are not supported.");
		}

		if (property.kind !== "init" || property.method) {
			throw new ExtractionError(
				context,
				property.start,
				"object methods, getters, and setters are not supported.",
			);
		}

		fields[size++] = { key: getStaticKey(property.key, context), property };
	}

	return fields;
}

// oxlint-disable-next-line jsdoc-js/convert-to-jsdoc-comments -- shut up
// fallow-ignore-next-line complexity
function findField(object: ObjectExpression, name: string): ObjectField | undefined {
	for (const property of object.properties) {
		if (property.type !== "Property" || property.computed || property.kind !== "init" || property.method) continue;

		if (property.key.type === "Identifier" && property.key.name === name) {
			return { key: name, property };
		}

		if (isStringLiteral(property.key) && property.key.value === name) {
			return { key: name, property };
		}
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
	throw new ExtractionError(context, key.start, "object keys must be static strings.");
}

// oxlint-disable-next-line jsdoc-js/convert-to-jsdoc-comments -- shut up
// fallow-ignore-next-line complexity
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
		throw new ExtractionError(context, node.start, "identifier references are not supported.");
	} else if (node.type === "CallExpression") {
		throw new ExtractionError(context, node.start, "function calls are not supported.");
	}

	throw new ExtractionError(context, node.start, `${node.type} values are not supported.`);
}

type StaticLiteral = Literal & {
	readonly value: boolean | null | number | string;
};

function isStaticLiteral(node: Expression): node is StaticLiteral {
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

type StringLiteral = Literal & { readonly value: string };

function isStringLiteral(node?: Node): node is StringLiteral {
	return node?.type === "Literal" && typeof node.value === "string";
}

function evaluateTemplate(template: TemplateLiteral, extractionContext: ExtractionContext): string {
	if (template.expressions.length > 0) {
		throw new ExtractionError(
			extractionContext,
			template.start,
			"interpolated template literals are not supported.",
		);
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

function evaluateArray(array: ArrayExpression, extractionContext: ExtractionContext): ReadonlyArray<StaticValue> {
	const values = new Array<StaticValue>();
	let size = 0;
	for (const element of array.elements) {
		if (element === null) {
			throw new ExtractionError(extractionContext, array.start, "array holes are not supported.");
		}

		if (element.type === "SpreadElement") {
			throw new ExtractionError(extractionContext, element.start, "array spreads are not supported.");
		}

		values[size++] = evaluateStatic(element, extractionContext);
	}

	return values;
}

function evaluateObject(object: ObjectExpression, extractionContext: ExtractionContext): StaticObject {
	return Object.fromEntries(
		getObjectFields(object, extractionContext).map((field) => [
			field.key,
			evaluateStatic(field.property.value, extractionContext),
		]),
	);
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

function evaluateStringJoin(node: CallExpression, extractionContext: ExtractionContext): string {
	if (node.callee.type !== "MemberExpression" || node.callee.object.type !== "ArrayExpression") {
		throw new ExtractionError(extractionContext, node.start, "function calls are not supported.");
	}

	const values = evaluateArray(node.callee.object, extractionContext);
	if (values.some((value) => !Predicate.isString(value))) {
		throw new ExtractionError(
			extractionContext,
			node.callee.object.start,
			"join arrays must contain only strings.",
		);
	}

	// oxlint-disable-next-line typescript/no-base-to-string -- i hate.
	return values.join("\n");
}

function orderExamples(examples: ReadonlyArray<RuleExample>): Array<RuleExample> {
	return examples.toSorted((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}
