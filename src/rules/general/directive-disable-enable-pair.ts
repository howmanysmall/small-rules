import { createRule } from "$oxc-utilities/create-rule";
import { computeDisabledArea, lte, toRuleIdLocation } from "$oxc-utilities/directive-comments";
import { MESSAGE_ID_SUGGESTION } from "$oxc-utilities/prevent-abbreviations/constants";

import type { Visitor } from "oxlint-plugin-utilities";

const directiveDisableEnablePair = createRule("directive-disable-enable-pair", "general", {
	create(context): Visitor {
		const [options] = context.options;
		const allowWholeFile = options?.allowWholeFile === true;
		const openAreas = computeDisabledArea(context.sourceCode).areas.filter((area) => area.end === undefined);
		if (openAreas.length === 0) {
			return {};
		}

		// Reading the token list materializes every token of the file, so
		// only an unclosed directive that may cover the whole file pays for it.
		const [firstToken] = allowWholeFile ? context.sourceCode.ast.tokens : [];
		if (allowWholeFile && firstToken === undefined) {
			return {};
		}

		for (const area of openAreas) {
			if (firstToken !== undefined && lte(area.start, firstToken.loc.start)) continue;

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
		type: MESSAGE_ID_SUGGESTION,
	},
});

export default directiveDisableEnablePair;
