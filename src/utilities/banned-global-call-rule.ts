import { defineRule } from "oxlint-plugin-utilities";

import type { CreateRule, ESTree, Visitor } from "oxlint-plugin-utilities";

interface BannedGlobalCallRuleOptions<TMessageId extends string> {
	/** A description of what to use instead. */
	readonly alternative: string;
	/** The error message template. Use {{name}} and {{alternative}} placeholders. */
	readonly message: string;
	/** The ESLint message ID (e.g., "noGlobalCall"). */
	readonly messageId: TMessageId;
	/** The name of the global function to ban. */
	readonly name: string;
}

export function createBannedGlobalCallRule<const TMessageId extends string>(
	options: BannedGlobalCallRuleOptions<TMessageId>,
): CreateRule<readonly [], TMessageId, readonly []> {
	const selector = `CallExpression[callee.type="Identifier"][callee.name="${options.name}"]`;

	return defineRule({
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
