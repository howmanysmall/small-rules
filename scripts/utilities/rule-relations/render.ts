import { isNumber, isString, isUndefined } from "@small-rules/arktype-utilities";
import { type } from "arktype";

import { isRuleName } from "$data/rule-relations";

import { relationGeneratorPath } from "./constants";
import { compareStrings, isPairJudgments } from "./types";

import type { RuleName } from "$data/rule-manifest";

export const isRelationEvidence = type({
	"+": "reject",
	backward: isPairJudgments,
	forward: isPairJudgments,
	strength: isNumber,
}).readonly();
export type RelationEvidence = typeof isRelationEvidence.infer;

const isRuleNameArkType = isString
	.narrow((data, context) => {
		if (isRuleName(data)) return true;
		return context.reject(`Invalid rule name: ${data}`);
	})
	.as<RuleName>();

export const isGeneratedEdge = type({
	"evidence?": isRelationEvidence.or(isUndefined),
	from: isRuleNameArkType,
	kind: '"overlaps" | "depends-on" | "supersedes" | "related"',
	reason: isString,
	to: isRuleNameArkType,
}).readonly();
export type GeneratedEdge = typeof isGeneratedEdge.infer;

export interface RelationModels {
	readonly decisions: string;
	readonly reasons: string;
}

export interface RelationDocument {
	readonly edges: ReadonlyArray<GeneratedEdge>;
	readonly generator: string;
	readonly models: RelationModels;
}

interface DocumentOptions {
	readonly edges: ReadonlyArray<GeneratedEdge>;
	readonly models: RelationModels;
}
export function createRelationDocument(options: DocumentOptions): RelationDocument {
	const edges = options.edges.toSorted(
		(left, right) =>
			compareStrings(left.from, right.from) ||
			compareStrings(left.to, right.to) ||
			compareStrings(left.kind, right.kind),
	);

	return { edges, generator: relationGeneratorPath, models: options.models };
}

export function renderRelationDocument(options: DocumentOptions): string {
	return `${JSON.stringify(createRelationDocument(options), undefined, "\t")}\n`;
}
