import { Predicate } from "effect";

import type { UnknownRecord } from "type-fest";

export function getProperty(value: unknown, key: string): unknown {
	if (!Predicate.isObject(value)) return undefined;
	return value[key];
}

export function getStringProperty(value: unknown, key: string): string | undefined {
	const property = getProperty(value, key);
	return Predicate.isString(property) ? property : undefined;
}

export function getArrayProperty(value: unknown, key: string): ReadonlyArray<unknown> | undefined {
	const property = getProperty(value, key);
	return Array.isArray(property) ? property : undefined;
}

export function getObjectProperty(value: unknown, key: string): undefined | UnknownRecord {
	const property = getProperty(value, key);
	return Predicate.isObject(property) ? property : undefined;
}

export function isJsonSerializable(value: unknown): boolean {
	if (value === null) return true;
	// oxlint-disable-next-line small-rules/no-runtime-typeof -- not slop??
	const valueType = typeof value;
	if (valueType === "string" || valueType === "boolean") return true;
	if (valueType === "number") return Number.isFinite(value);
	if (valueType !== "object") return false;
	if (Array.isArray(value)) return value.every(isJsonSerializable);
	if (!Predicate.isObject(value)) return false;

	for (const [key, property] of Object.entries(value)) {
		if (key === "__proto__" || !isJsonSerializable(property)) return false;
	}

	return true;
}
