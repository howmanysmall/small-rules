import { maxReasonLength } from "./constants";

import type { RelationDraft, RuleCard } from "./types";

export interface ReasonMessage {
	readonly content: string;
	readonly role: "user";
}

interface CreateOptions {
	readonly left: RuleCard;
	readonly relation: RelationDraft;
	readonly right: RuleCard;
}

export function createReasonMessages({ left, relation, right }: CreateOptions): ReadonlyArray<ReasonMessage> {
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
		"For directed kinds, write the sentence from the first rule's perspective.",
		"Do not use newlines.",
	].join("\n");

	return [{ content, role: "user" }];
}

interface ReasonOptions {
	readonly allNames: ReadonlyArray<string>;
	readonly reason: string;
	readonly relation: RelationDraft;
}

export function validateReason({ allNames, reason, relation }: ReasonOptions): ReadonlyArray<string> {
	const problems = new Array<string>();
	let size = 0;

	if (reason.trim().length === 0) problems[size++] = "Reason is empty.";
	if (reason.includes("\n")) problems[size++] = "Reason contains a newline.";
	if (reason.length > maxReasonLength) {
		problems[size++] = `Reason exceeds ${maxReasonLength} characters (${reason.length}).`;
	}

	for (const name of allNames) {
		if (name === relation.from || name === relation.to) continue;
		if (reason.includes(name)) problems[size++] = `Reason mentions unrelated rule "${name}".`;
	}

	return problems;
}
