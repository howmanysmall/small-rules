import { defineRule } from "oxlint-plugin-utilities";

import { computeDisabledArea, lte, toRuleIdLocation } from "../utilities/directive-comments";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveDisableEnablePair = defineRule({
	create(context): Visitor {
		const [options] = context.options;
		const allowWholeFile = options?.allowWholeFile === true;
		const disabledArea = computeDisabledArea(context.sourceCode);
		const [firstToken] = context.sourceCode.ast.tokens;

		if (allowWholeFile && firstToken === undefined) return {};

		for (const area of disabledArea.areas) {
			if (area.end !== undefined) continue;
			if (allowWholeFile && firstToken !== undefined && lte(area.start, firstToken.loc.start)) continue;

			context.report({
				data: { ruleId: area.ruleId ?? "" },
				loc: toRuleIdLocation(area.comment, area.ruleId),
				messageId: area.ruleId === undefined ? "missingPair" : "missingRulePair",
			});
		}
		return {};
	},
	meta: {
		docs: {
			description:
				"Require a matching enable comment for every `oxlint-disable` or `eslint-disable` block directive.",
		},
		messages: {
			missingPair: "Requires 'eslint-enable' directive.",
			missingRulePair: "Requires 'eslint-enable' directive for '{{ruleId}}'.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowWholeFile: {
						description: "Allow a disable directive that covers the entire file.",
						type: "boolean" as const,
					},
				},
				type: "object" as const,
			},
		],
		type: "suggestion" as const,
	},
});

export default directiveDisableEnablePair;
