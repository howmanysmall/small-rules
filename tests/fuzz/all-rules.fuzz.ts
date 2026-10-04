import assert from "node:assert/strict";
import nodePath from "node:path";
import { fuzz } from "@vitiate/core";
import { FuzzedDataProvider } from "@vitiate/fuzzed-data-provider";
import { Predicate } from "effect";

import smallRules from "$small-rules";

import { createRuleExecutor } from "./rule-harness/execute";
import { applyFixes, fixer } from "./rule-harness/fixes";
import { getArrayProperty, getObjectProperty, getProperty, getStringProperty } from "./rule-harness/object";
import { getRuleMeta, parseCase } from "./rule-harness/parse";

import type { UnknownRecord } from "type-fest";

import type { HarnessValue } from "./rule-harness/object";
import type { Fix, NormalizedValidCase, RuntimeDiagnostic } from "./rule-harness/types";

interface JsonObject {
	[key: string]: JsonValue;
}
type JsonValue = Array<JsonValue> | boolean | JsonObject | number | string;

const SOURCE_FILE = nodePath.join(import.meta.dirname, "fixtures", "fuzz-target.tsx");
const SPEC_SOURCE_FILE = nodePath.join(import.meta.dirname, "fixtures", "fuzz-target.spec.tsx");

for (const [ruleName, rule] of Object.entries(smallRules.rules)) {
	const execute = createRuleExecutor(ruleName, rule);
	const schema = getProperty(getRuleMeta(rule), "schema");

	fuzz(`${ruleName} handles generated programs`, (data): void => {
		const provider = new FuzzedDataProvider(data);
		const testCase = createCase(createProgram(provider), [], provider.consumeBoolean());
		validateExecution(execute(testCase), testCase);

		const generatedOptions = createOptions(schema, provider);
		if (generatedOptions.length === 0) return;

		const configuredCase = createCase(testCase.code, generatedOptions, provider.consumeBoolean());
		validateExecution(execute(configuredCase), configuredCase);
	});
}

function createCase(code: string, options: ReadonlyArray<unknown>, specFilename: boolean): NormalizedValidCase {
	return {
		code,
		filename: specFilename ? SPEC_SOURCE_FILE : SOURCE_FILE,
		kind: "valid",
		language: "tsx",
		options,
		settings: {},
		sourceType: "module",
	};
}

function createProgram(provider: FuzzedDataProvider): string {
	const suffix = bytesToHex(provider.consumeBytes(12));
	const text = bytesToHex(provider.consumeBytes(48));
	const number = provider.consumeIntegralInRange(0, 10_000);
	const reactSource = provider.consumeBoolean() ? "react" : "@rbxts/react";
	const condition = provider.consumeBoolean() ? "true" : "false";
	const childExpression = toJsxExpression("children");
	const indexExpression = toJsxExpression("index");
	const itemExpression = toJsxExpression("item");
	const memoizedExpression = toJsxExpression("memoized");
	const textExpression = toJsxExpression(`fuzzText${suffix}`);
	const conditionalChild = toJsxExpression(`enabled && <textlabel Text=${textExpression} />`);
	const directive = provider.pickValue([
		"oxlint-disable no-console -- generated fuzz directive",
		"oxlint-disable-next-line no-console -- generated fuzz directive",
		"oxlint-enable no-console -- generated fuzz directive",
	]);

	return `/* ${directive} */
import React, { memo, useEffect, useMemo, useReducer, useState } from ${JSON.stringify(reactSource)};
import type { FC } from ${JSON.stringify(reactSource)};
import { Ianitor } from "@rbxts/ianitor";
import Log from "@rbxts/rbxts-sleitnick-log";

type FuzzRecord${suffix} = Readonly<Record<string, unknown>>;
enum FuzzItems${suffix} { FirstValue, SecondValue }

const fuzzText${suffix} = ${JSON.stringify(text)};
const fuzzNumber${suffix} = ${number};
const sharedObject${suffix} = { fuzzText${suffix}, nested: { fuzzNumber${suffix} } };
const sharedArray${suffix} = [fuzzNumber${suffix}, fuzzNumber${suffix} + 1];

class FuzzClass${suffix} {
	private value = fuzzNumber${suffix};

	public async run(input: number) {
		this.value += input;
		await Promise.resolve(this.value);
		return this.value;
	}

	public unusedMethod() {
		return fuzzText${suffix};
	}
}

const FuzzComponent${suffix}: FC<{ readonly enabled: boolean; readonly onChange?: (value: number) => void }> = memo(
	function FuzzComponent${suffix}({ enabled, onChange }) {
		const [state, setState] = useState(fuzzNumber${suffix});
		const [count, dispatch] = useReducer((value: number) => value + 1, 0);
		const memoized = useMemo(() => ({ count, state }), [count, state]);

		useEffect(function synchronizeState() {
			if (enabled) setState(fuzzNumber${suffix});
			onChange?.(state);
		}, [enabled, onChange, state]);

		const children = sharedArray${suffix}.map((item, index) => <frame key=${indexExpression} Value=${itemExpression} />);
		return (
			<frame Data=${memoizedExpression}>
				${conditionalChild}
				${childExpression}
			</frame>
		);
	},
);

function processValue${suffix}(input: number): number {
	let accumulator = input;
	for (let index = 0; index < sharedArray${suffix}.length; index += 1) {
		accumulator += sharedArray${suffix}[index] ?? 0;
	}

	while (${condition}) {
		if (accumulator > fuzzNumber${suffix}) break;
		accumulator++;
	}

	switch (accumulator) {
		case 0:
			accumulator += 1;
			break;
		default:
			accumulator -= 1;
	}

	try {
		const matcher = /fuzz/;
		if (matcher.test(fuzzText${suffix})) throw new Error(fuzzText${suffix});
	} catch (error) {
		void error;
	}

	const values = new Array<number>(fuzzNumber${suffix});
	values[values.size()] = accumulator;
	const color = new Color3(accumulator, accumulator, accumulator);
	const dimensions = new UDim2(0, accumulator, 0, accumulator);
	const janitor = new Ianitor();
	const log = new Log();
	task.wait();
	print(sharedObject${suffix}, color, dimensions, janitor, log, FuzzComponent${suffix});
	return accumulator;
}

export { FuzzClass${suffix}, FuzzComponent${suffix}, FuzzItems${suffix}, processValue${suffix} };
`;
}

function createOptions(schema: HarnessValue, provider: FuzzedDataProvider): ReadonlyArray<unknown> {
	if (Array.isArray(schema)) {
		const [optionSchema] = schema;
		return optionSchema === undefined ? [] : [createSchemaValue(optionSchema, provider, "option")];
	}

	const options = createSchemaValue(schema, provider, "options");
	return Array.isArray(options) ? options : [];
}

function createSchemaValue(schema: HarnessValue, provider: FuzzedDataProvider, salt: string): JsonValue {
	const resolvedSchema = resolveAlternative(schema, provider);
	if (!Predicate.isObject(resolvedSchema)) return false;

	const enumeration = getArrayProperty(resolvedSchema, "enum");
	if (enumeration !== undefined) {
		const values = enumeration.map(toJsonValue).filter(isJsonValue);
		if (values.length > 0) return provider.pickValue(values);
	}

	switch (getStringProperty(resolvedSchema, "type")) {
		case "array":
			return createSchemaArray(resolvedSchema, provider, salt);
		case "boolean":
			return provider.consumeBoolean();
		case "integer":
		case "number":
			return createSchemaNumber(resolvedSchema, provider);
		case "object":
			return createSchemaObject(resolvedSchema, provider, salt);
		case "string":
			return `fuzz${salt}${bytesToHex(provider.consumeBytes(12))}`;
		default:
			return false;
	}
}

function resolveAlternative(schema: HarnessValue, provider: FuzzedDataProvider): HarnessValue {
	let resolvedSchema = schema;
	while (Predicate.isObject(resolvedSchema)) {
		const alternatives = getArrayProperty(resolvedSchema, "oneOf") ?? getArrayProperty(resolvedSchema, "anyOf");
		if (alternatives === undefined || alternatives.length === 0) return resolvedSchema;
		resolvedSchema = provider.pickValue(alternatives);
	}
	return resolvedSchema;
}

function createSchemaArray(schema: UnknownRecord, provider: FuzzedDataProvider, salt: string): Array<JsonValue> {
	const items = getProperty(schema, "items");
	const minimumItems = getNonnegativeInteger(schema, "minItems") ?? 1;
	const maximumItems = getNonnegativeInteger(schema, "maxItems") ?? minimumItems + 2;
	const length = provider.consumeIntegralInRange(minimumItems, Math.max(minimumItems, maximumItems));
	const result = new Array<JsonValue>();
	for (let index = 0; index < length; index += 1) {
		result.push(createSchemaValue(items, provider, `${salt}${index}`));
	}
	return result;
}

function createSchemaNumber(schema: UnknownRecord, provider: FuzzedDataProvider): number {
	const minimum = getFiniteNumber(schema, "minimum") ?? 0;
	const maximum = getFiniteNumber(schema, "maximum") ?? minimum + 100;
	return provider.consumeIntegralInRange(Math.ceil(minimum), Math.max(Math.ceil(minimum), Math.floor(maximum)));
}

function createSchemaObject(schema: UnknownRecord, provider: FuzzedDataProvider, salt: string): JsonObject {
	const result: JsonObject = {};
	const required = new Set(getStringArray(schema, "required"));
	const properties = getObjectProperty(schema, "properties");
	if (properties !== undefined) {
		for (const [name, propertySchema] of Object.entries(properties)) {
			if (!required.has(name) && !provider.consumeBoolean()) continue;
			result[name] = createSchemaValue(propertySchema, provider, `${salt}${name}`);
		}
	}

	const additionalProperties = getProperty(schema, "additionalProperties");
	if (Predicate.isObject(additionalProperties) && provider.consumeBoolean()) {
		const name = `fuzz${salt}${bytesToHex(provider.consumeBytes(8))}`;
		result[name] = createSchemaValue(additionalProperties, provider, `${salt}additional`);
	}

	return result;
}

function getStringArray(value: HarnessValue, key: string): ReadonlyArray<string> {
	return getArrayProperty(value, key)?.filter(Predicate.isString) ?? [];
}

function getFiniteNumber(value: HarnessValue, key: string): number | undefined {
	const property = getProperty(value, key);
	return Predicate.isNumber(property) && Number.isFinite(property) ? property : undefined;
}

function getNonnegativeInteger(value: HarnessValue, key: string): number | undefined {
	const property = getFiniteNumber(value, key);
	return property !== undefined && Number.isInteger(property) && property >= 0 ? property : undefined;
}

function toJsonValue(value: HarnessValue): JsonValue | undefined {
	if (Predicate.isBoolean(value) || Predicate.isString(value)) return value;
	if (Predicate.isNumber(value)) return Number.isFinite(value) ? value : undefined;
	if (Array.isArray(value)) {
		const result = new Array<JsonValue>();
		for (const item of value) {
			const jsonValue = toJsonValue(item);
			if (jsonValue === undefined) return undefined;
			result.push(jsonValue);
		}
		return result;
	}
	if (!Predicate.isObject(value)) return undefined;

	const result: JsonObject = {};
	for (const [key, item] of Object.entries(value)) {
		const jsonValue = toJsonValue(item);
		if (jsonValue === undefined) return undefined;
		result[key] = jsonValue;
	}
	return result;
}

function isJsonValue(value?: JsonValue): value is JsonValue {
	return value !== undefined;
}

function validateExecution(
	result: ReturnType<ReturnType<typeof createRuleExecutor>>,
	testCase: NormalizedValidCase,
): void {
	for (const diagnostic of result.diagnostics) validateDiagnostic(diagnostic, testCase);
}

function validateDiagnostic(diagnostic: RuntimeDiagnostic, testCase: NormalizedValidCase): void {
	assert.ok(diagnostic.message.length > 0, "reported diagnostics must have a message");
	if (diagnostic.node !== undefined) validateRange(diagnostic.node.range, testCase.code.length);
	validateFixProvider(diagnostic.fix, testCase);
	for (const suggestion of diagnostic.suggestions) validateFixProvider(suggestion.fix, testCase);
}

function validateFixProvider(provider: RuntimeDiagnostic["fix"] | undefined, testCase: NormalizedValidCase): void {
	if (provider === undefined) return;
	const fixResult = provider(fixer);
	if (fixResult === undefined) return;

	if (isFix(fixResult)) validateRange(fixResult.range, testCase.code.length);
	else for (const fix of fixResult) validateRange(fix.range, testCase.code.length);

	const output = applyFixes(testCase.code, fixResult);
	assert.notEqual(output, undefined, "a returned fix must produce output");
	if (output === undefined) return;
	parseCase({ ...testCase, code: output });
}

function validateRange(range: readonly [number, number], sourceLength: number): void {
	const [start, end] = range;
	assert.ok(start >= 0, "fix and diagnostic ranges must start inside the source");
	assert.ok(end >= start, "fix and diagnostic ranges must not be reversed");
	assert.ok(end <= sourceLength, "fix and diagnostic ranges must end inside the source");
}

function isFix(value: Fix | ReadonlyArray<Fix>): value is Fix {
	return !Array.isArray(value);
}

function bytesToHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("hex");
}

function toJsxExpression(value: string): string {
	return `{${value}}`;
}
