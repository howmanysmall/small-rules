import prettyMilliseconds from "pretty-ms";

import type { Writable } from "type-fest";

import type { RelationProgress, RelationUsage } from "./types";

export interface RelationPhaseUsageTotals {
	readonly cost: number;
	readonly costReports: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly requests: number;
	readonly totalTokens: number;
}

export interface RelationUsageTotals {
	readonly judgments: RelationPhaseUsageTotals;
	readonly reasons: RelationPhaseUsageTotals;
}

function createEmptyTotals(): Writable<RelationPhaseUsageTotals> {
	return { cost: 0, costReports: 0, inputTokens: 0, outputTokens: 0, requests: 0, totalTokens: 0 };
}

function copyTotals(totals: RelationPhaseUsageTotals): RelationPhaseUsageTotals {
	return { ...totals };
}

interface RelationUsageTracker {
	readonly getTotals: () => RelationUsageTotals;
	readonly record: (usage: RelationUsage) => void;
}

export function createRelationUsageTracker(): RelationUsageTracker {
	const judgments = createEmptyTotals();
	const reasons = createEmptyTotals();

	return {
		getTotals: () => ({ judgments: copyTotals(judgments), reasons: copyTotals(reasons) }),
		record: (usage): void => {
			const totals = usage.phase === "judgments" ? judgments : reasons;
			totals.requests += 1;
			totals.inputTokens += usage.inputTokens ?? 0;
			totals.outputTokens += usage.outputTokens ?? 0;
			totals.totalTokens += usage.totalTokens ?? 0;
			if (usage.cost !== undefined) {
				totals.cost += usage.cost;
				totals.costReports += 1;
			}
		},
	};
}

interface FormatSummaryOptions {
	readonly elapsedMilliseconds: number;
	readonly progress: Partial<Record<RelationProgress["phase"], RelationProgress>>;
	readonly usage: RelationUsageTotals;
}

function formatInteger(value: number): string {
	return value.toLocaleString("en-US");
}

export function formatRelationRunSummary(options: FormatSummaryOptions): ReadonlyArray<string> {
	const judgmentUsage = options.usage.judgments;
	const reasonUsage = options.usage.reasons;
	const requests = judgmentUsage.requests + reasonUsage.requests;
	const cost = judgmentUsage.cost + reasonUsage.cost;
	const costReports = judgmentUsage.costReports + reasonUsage.costReports;
	const inputTokens = judgmentUsage.inputTokens + reasonUsage.inputTokens;
	const outputTokens = judgmentUsage.outputTokens + reasonUsage.outputTokens;
	const totalTokens = judgmentUsage.totalTokens + reasonUsage.totalTokens;
	const judgmentProgress = options.progress.judgments;
	const reasonProgress = options.progress.reasons;

	return [
		`usage: ${formatInteger(requests)} API requests (${formatInteger(judgmentUsage.requests)} judgments, ${formatInteger(reasonUsage.requests)} reasons), ${formatInteger(inputTokens)} input tokens, ${formatInteger(outputTokens)} output tokens, ${formatInteger(totalTokens)} total tokens`,
		`reported cost: $${cost.toFixed(6)} (${formatInteger(costReports)}/${formatInteger(requests)} requests)`,
		`cache: ${formatInteger(judgmentProgress?.cached ?? 0)}/${formatInteger(judgmentProgress?.total ?? 0)} judgments, ${formatInteger(reasonProgress?.cached ?? 0)}/${formatInteger(reasonProgress?.total ?? 0)} reasons`,
		`elapsed: ${prettyMilliseconds(options.elapsedMilliseconds)}`,
	];
}
