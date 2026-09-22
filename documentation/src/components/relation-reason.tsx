import { ruleManifest } from "$data/rule-manifest";
import { parseInlineMarkdown } from "$utilities/inline-markdown";

import type { ReactNode } from "react";

interface RelationReasonProperties {
	reason: string;
}

const ESCAPE_REGEXP = /[.*+?^${}()|[\]\\]/gu;

function escapeRegularExpression(value: string): string {
	return value.replaceAll(ESCAPE_REGEXP, String.raw`\$&`);
}

const RULE_ID_REGEXP = new RegExp(
	`(?<![\\w-])(${ruleManifest.categories
		.flatMap((category) => category.rules.map((entry) => escapeRegularExpression(entry.name)))
		.join("|")})(?![\\w-])`,
	"u",
);

export function RelationReason({ reason }: Readonly<RelationReasonProperties>): ReactNode {
	const nodes = new Array<ReactNode>();
	let codeIndex = 0;

	for (const segment of parseInlineMarkdown(reason)) {
		if (segment.code) {
			nodes.push(<code key={`code-${String(codeIndex++)}`}>{segment.text}</code>);
			continue;
		}

		const parts = segment.text.split(RULE_ID_REGEXP);
		for (const [index, part] of parts.entries()) {
			if (part === "") continue;
			nodes.push(index % 2 === 1 ? <code key={`code-${String(codeIndex++)}`}>{part}</code> : part);
		}
	}

	return nodes;
}
