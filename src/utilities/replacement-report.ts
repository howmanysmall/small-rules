import type { Diagnostic, ESTree } from "oxlint-plugin-utilities";

interface ReplacementReportContext<TMessageId extends string> {
	readonly report: (diagnostic: Diagnostic<TMessageId>) => void;
}

/**
 * Reports a node, attaching a fix that replaces it when a replacement exists.
 *
 * @template TMessageId - The rule's message IDs.
 * @param context - Rule context to report through.
 * @param messageId - Message to report.
 * @param node - Node to report and replace.
 * @param replacement - Replacement source text, or undefined to report
 *   without a fix.
 */
export function reportWithReplacement<TMessageId extends string>(
	context: ReplacementReportContext<TMessageId>,
	messageId: TMessageId,
	node: ESTree.Node,
	replacement?: string,
): void {
	if (replacement === undefined) {
		context.report({ messageId, node });
		return;
	}

	context.report({
		fix: (fixer) => fixer.replaceText(node, replacement),
		messageId,
		node,
	});
}
