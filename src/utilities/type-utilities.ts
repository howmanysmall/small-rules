import { Predicate } from "effect";

export function isNonEmptyString(value: unknown): value is string {
	return Predicate.isString(value) && value.length > 0;
}

export function isStringArray(object: unknown): object is ReadonlyArray<string> {
	if (!Array.isArray(object)) return false;
	for (const item of object) if (!Predicate.isString(item)) return false;
	return true;
}

export function isStringRecord(object: unknown): object is Record<string, string> {
	if (!Predicate.isObject(object)) return false;
	for (const entry of Object.values(object)) if (!Predicate.isString(entry)) return false;
	return true;
}

export function isNumber(value: unknown): value is number {
	return Predicate.isNumber(value) && !Number.isNaN(value);
}
