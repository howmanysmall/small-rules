import { isTsInterfaceDeclaration, isTsTypeAliasDeclaration } from "@small-rules/oxlint-utilities";

import { getResolvedVariable } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { CreateRule, Definition, ESTree, Visitor } from "oxlint-plugin-utilities";

function isTypeDeclaration({ node }: Definition): boolean {
	return isTsTypeAliasDeclaration(node) || isTsInterfaceDeclaration(node);
}

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
			const { sourceCode } = context;

			return {
				[selector](node: ESTree.CallExpression): void {
					// An import, parameter or local function of the same name
					// is not the global. A type of that name is not a value,
					// so the call still reaches the global.
					const variable = getResolvedVariable(sourceCode, node.callee);
					if (variable !== undefined && !variable.defs.every(isTypeDeclaration)) return;

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
