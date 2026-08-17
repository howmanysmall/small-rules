import { createRule } from "$oxc-utilities/create-rule";

import type { CreateRule, ESTree, Visitor } from "oxlint-plugin-utilities";

interface BannedGlobalCallRuleOptions<TMessageId extends string> {
	readonly name: string;
	readonly alternative: string;
	readonly category: string;
	readonly message: string;
	readonly messageId: TMessageId;
	readonly ruleName: string;
}

export function createBannedGlobalCallRule<const TMessageId extends string>(
	options: BannedGlobalCallRuleOptions<TMessageId>,
): CreateRule<readonly [], TMessageId, readonly []> {
	const selector = `CallExpression[callee.type="Identifier"][callee.name="${options.name}"]`;

	return createRule(options.ruleName, options.category, {
		create(context): Visitor {
			return {
				[selector](node: ESTree.CallExpression): void {
					context.report({
						messageId: options.messageId,
						node,
					});
				},
			} satisfies Visitor;
		},
		meta: {
			docs: {
				description: `Use ${options.alternative} instead of ${options.name}().`,
			},
			messages: {
				[options.messageId]: options.message
					.replaceAll("{{name}}", options.name)
					.replaceAll("{{alternative}}", options.alternative),
			},
			schema: [] as const,
			type: "problem",
		},
	});
}
