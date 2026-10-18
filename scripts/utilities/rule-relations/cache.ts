import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { Predicate } from "effect";

import { compareStrings, isPairJudgments } from "./types";

import type { PairJudgments } from "./types";

// oxlint-disable-next-line small-rules/no-unknown-parameters -- literally "unknown" in the sense it is not known
export function toStringStable(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => toStringStable(entry)).join(",")}]`;
	}
	if (Predicate.isObjectKeyword(value)) {
		const entries = Object.entries(value).toSorted(([left], [right]) => compareStrings(left, right));
		const stringBuilder = entries.map(
			([key, entryValue]) => `${JSON.stringify(key)}:${toStringStable(entryValue)}`,
		);
		return `{${stringBuilder.join(",")}}`;
	}
	return JSON.stringify(value);
}

// oxlint-disable-next-line small-rules/no-unknown-parameters -- literally "unknown" in the sense it is not known
export function createCacheKey(value: unknown): string {
	return createHash("sha256").update(toStringStable(value)).digest("hex");
}

interface ValidatedCache<TValue> {
	readonly get: (key: string) => TValue | undefined;
	readonly set: (key: string, value: TValue) => void;
}

export type JudgmentCache = ValidatedCache<PairJudgments>;
export type ReasonCache = ValidatedCache<string>;

interface JsonFileStore {
	// oxlint-disable-next-line small-rules/no-unknown-returns -- literally "unknown" in the sense it is not known
	readonly get: (key: string) => unknown;
	// oxlint-disable-next-line small-rules/no-unknown-parameters -- literally "unknown" in the sense it is not known
	readonly set: (key: string, value: unknown) => void;
}

function createJsonFileStore(directory: string): JsonFileStore {
	// oxlint-disable-next-line small-rules/no-unknown-returns -- literally "unknown" in the sense it is not known
	function load(key: string): unknown {
		try {
			return JSON.parse(readFileSync(nodePath.join(directory, `${key}.json`), "utf8"));
		} catch {
			return undefined;
		}
	}

	// oxlint-disable-next-line small-rules/no-unknown-parameters -- literally "unknown" in the sense it is not known
	function save(key: string, value: unknown): void {
		mkdirSync(directory, { recursive: true });
		writeFileSync(nodePath.join(directory, `${key}.json`), `${JSON.stringify(value)}\n`, "utf8");
	}

	return { get: load, set: save };
}

function createValidatedCache<TValue>(
	directory: string,
	isValue: (value: unknown) => value is TValue,
): ValidatedCache<TValue> {
	const store = createJsonFileStore(directory);
	return {
		get: (key): TValue | undefined => {
			const value = store.get(key);
			return isValue(value) ? value : undefined;
		},
		set: (key, value): void => {
			store.set(key, value);
		},
	};
}

export function createJudgmentCache(directory: string): JudgmentCache {
	return createValidatedCache(directory, (value) => isPairJudgments.allows(value));
}

export function createReasonCache(directory: string): ReasonCache {
	return createValidatedCache(directory, Predicate.isString);
}
