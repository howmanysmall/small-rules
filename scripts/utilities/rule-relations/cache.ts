import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { Predicate } from "effect";

import { compareStrings, isPairJudgments } from "./types";

import type { PairJudgments } from "./types";

// oxlint-disable-next-line small-rules/no-unknown-parameters -- literally "unknown" in the sense it is not known
export function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
	}
	if (Predicate.isObjectKeyword(value)) {
		const entries = Object.entries(value).toSorted(([left], [right]) => compareStrings(left, right));
		const stringBuilder = entries.map(
			([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
		);
		return `{${stringBuilder.join(",")}}`;
	}
	return JSON.stringify(value);
}

// oxlint-disable-next-line small-rules/no-unknown-parameters -- literally "unknown" in the sense it is not known
export function createCacheKey(value: unknown): string {
	return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export interface JudgmentCache {
	readonly get: (key: string) => PairJudgments | undefined;
	readonly set: (key: string, value: PairJudgments) => void;
}

export interface ReasonCache {
	readonly get: (key: string) => string | undefined;
	readonly set: (key: string, value: string) => void;
}

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

export function createJudgmentCache(directory: string): JudgmentCache {
	const store = createJsonFileStore(directory);
	return {
		get: (key): PairJudgments | undefined => {
			const value = store.get(key);
			return isPairJudgments.allows(value) ? value : undefined;
		},
		set: (key, value): void => {
			store.set(key, value);
		},
	};
}

export function createReasonCache(directory: string): ReasonCache {
	const store = createJsonFileStore(directory);
	return {
		get: (key): string | undefined => {
			const value = store.get(key);
			return Predicate.isString(value) ? value : undefined;
		},
		set: (key, value): void => {
			store.set(key, value);
		},
	};
}
