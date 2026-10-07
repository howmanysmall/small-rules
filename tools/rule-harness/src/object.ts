import { Predicate } from "effect";

import type { UnknownRecord } from "type-fest";

export type HarnessValue = UnknownRecord[keyof UnknownRecord];

export function getProperty(value: HarnessValue, key: string): HarnessValue {
	if (!Predicate.isObject(value)) return undefined;
	return value[key];
}

export function getStringProperty(value: HarnessValue, key: string): string | undefined {
	const property = getProperty(value, key);
	return Predicate.isString(property) ? property : undefined;
}

export function getArrayProperty(value: HarnessValue, key: string): ReadonlyArray<HarnessValue> | undefined {
	const property = getProperty(value, key);
	return Array.isArray(property) ? property : undefined;
}

export function getObjectProperty(value: HarnessValue, key: string): undefined | UnknownRecord {
	const property = getProperty(value, key);
	return Predicate.isObject(property) ? property : undefined;
}

export function isJsonSerializable(value: HarnessValue): boolean {
	if (value === null) return true;
	if (Predicate.isString(value) || Predicate.isBoolean(value)) return true;
	if (Predicate.isNumber(value)) return Number.isFinite(value);
	if (Array.isArray(value)) return value.every(isJsonSerializable);
	if (!Predicate.isObject(value)) return false;

	for (const [key, property] of Object.entries(value)) {
		if (key === "__proto__" || !isJsonSerializable(property)) return false;
	}

	return true;
}
