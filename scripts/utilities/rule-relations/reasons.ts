import { maxReasonLength } from "./constants";

import type { ReasonAttempt, RelationDraft, RuleCard } from "./types";

export interface ReasonMessage {
	readonly content: string;
	readonly role: "user";
}

interface CreateOptions {
	readonly left: RuleCard;
	readonly previous?: ReasonAttempt | undefined;
	readonly relation: RelationDraft;
	readonly right: RuleCard;
}

function createRetryInstructions(previous: ReasonAttempt): string {
	const lines = [
		"",
		"Your previous sentence was rejected:",
		JSON.stringify(previous.reason),
		"Problems:",
		...previous.problems.map((problem) => `- ${problem}`),
	];

	if (previous.reason.length > maxReasonLength) {
		lines.push(
			`It was ${previous.reason.length} characters; the limit is ${maxReasonLength}, so the new sentence must be shorter.`,
		);
	}

	lines.push("Write a corrected sentence that fixes every problem above.");
	return lines.join("\n");
}

export function createReasonMessages({ left, previous, relation, right }: CreateOptions): ReadonlyArray<ReasonMessage> {
	const content = [
		"You write one-sentence relation descriptions for a lint-rule documentation site.",
		"",
		`Relation kind: ${relation.kind} (from \`${relation.from}\` to \`${relation.to}\`).`,
		"",
		`Rule card for \`${relation.from}\`:`,
		JSON.stringify(left),
		"",
		`Rule card for \`${relation.to}\`:`,
		JSON.stringify(right),
		"",
		`Write exactly ONE sentence (at most ${maxReasonLength} characters) that explains the practical relationship between the two rules for someone configuring them.`,
		`Name only these two rules (\`${relation.from}\`, \`${relation.to}\`); never mention any other rule.`,
		"Write both rule names in backticks, like `rule-name`.",
		"For directed kinds, write the sentence from the first rule's perspective.",
		"Do not use newlines.",
	].join("\n");

	if (previous === undefined) {
		return [{ content, role: "user" }];
	}

	return [{ content: `${content}\n${createRetryInstructions(previous)}`, role: "user" }];
}

interface ReasonOptions {
	readonly allNames: ReadonlyArray<string>;
	readonly reason: string;
	readonly relation: RelationDraft;
}

export function validateReason({ allNames, reason, relation }: ReasonOptions): ReadonlyArray<string> {
	const problems = new Array<string>();
	let size = 0;

	if (reason.trim().length === 0) {
		problems[size++] = "Reason is empty.";
	}

	if (reason.includes("\n")) {
		problems[size++] = "Reason contains a newline.";
	}

	if (reason.length > maxReasonLength) {
		problems[size++] = `Reason exceeds ${maxReasonLength} characters (${reason.length}).`;
	}

	for (const name of allNames) {
		if (name === relation.from || name === relation.to) continue;

		if (reason.includes(name)) {
			problems[size++] = `Reason mentions unrelated rule "${name}".`;
		}
	}

	return problems;
}
