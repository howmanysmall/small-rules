#!/usr/bin/env nub

import { readFile, writeFile } from "node:fs/promises";
import { type } from "arktype";

const isDefaultProperties = type({ classes: "Record<string, Record<string, unknown>>" }).readonly();
const defaultProperties = isDefaultProperties(JSON.parse(await readFile("src/default-properties.json", "utf8")));
if (defaultProperties instanceof type.errors) throw new TypeError(defaultProperties.summary);

const valueTypeIndexes = new Map(
	["Enum", "bool", "CFrame", "Color3", "number", "Rect", "string", "UDim2", "UDim", "Vector2", "Vector3"].map(
		(valueType, index) => [valueType, index],
	),
);

function encodeValue(value: unknown): ReadonlyArray<unknown> {
	if (typeof value !== "object" || value === null || !("type" in value) || !("value" in value)) {
		const error = new TypeError("Invalid canonical default property value.");
		Error.captureStackTrace(error, encodeValue);
		throw error;
	}
	const valueType = value.type;
	if (typeof valueType !== "string") {
		const error = new TypeError("Invalid canonical default property type.");
		Error.captureStackTrace(error, encodeValue);
		throw error;
	}
	const valueTypeIndex = valueTypeIndexes.get(valueType);
	if (valueTypeIndex === undefined) {
		const error = new TypeError(`Unknown canonical default property type: ${valueType}`);
		Error.captureStackTrace(error, encodeValue);
		throw error;
	}
	if (valueType === "Enum") {
		if (!("enumType" in value) || typeof value.enumType !== "string") {
			const error = new TypeError("Invalid canonical enum default property value.");
			Error.captureStackTrace(error, encodeValue);
			throw error;
		}
		return [valueTypeIndex, value.enumType, value.value];
	}
	return [valueTypeIndex, value.value];
}

const propertyNames = [...new Set(Object.values(defaultProperties.classes).flatMap(Object.keys))].toSorted();
const serializedValues = [
	...new Set(
		Object.values(defaultProperties.classes).flatMap((properties) =>
			Object.values(properties).map((value) => JSON.stringify(encodeValue(value))),
		),
	),
].toSorted();
const propertyIndexes = new Map(propertyNames.map((propertyName, index) => [propertyName, index]));
const valueIndexes = new Map(serializedValues.map((value, index) => [value, index]));

const classes: Record<string, Array<number>> = {};
for (const [className, properties] of Object.entries(defaultProperties.classes)) {
	const entries = new Array<number>();
	for (const [propertyName, value] of Object.entries(properties)) {
		const propertyIndex = propertyIndexes.get(propertyName);
		const valueIndex = valueIndexes.get(JSON.stringify(encodeValue(value)));
		if (propertyIndex === undefined || valueIndex === undefined) {
			throw new Error("Failed to index default property.");
		}
		entries.push(propertyIndex, valueIndex);
	}
	classes[className] = entries;
}

const output = JSON.stringify({
	classes,
	properties: propertyNames,
	values: serializedValues.map((value) => JSON.parse(value)),
	version: 1,
});
await writeFile("src/generated/default-properties.json", output, "utf8");
console.log(`Wrote ${output.length} bytes to src/generated/default-properties.json`);
