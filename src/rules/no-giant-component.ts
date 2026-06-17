import { isComponentDeclaration } from "$oxc-utilities/component-utilities";
import { isComponentAssignment } from "$oxc-utilities/lint-utilities";
import { isNode } from "$oxc-utilities/oxc-utilities";
import { isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const GIANT_COMPONENT_LINE_THRESHOLD = 300;

function getLineCount(node: ESTree.Node): number {
	return node.loc.end.line - node.loc.start.line + 1;
}

interface ComponentDetails {
	readonly body: ESTree.Node;
	readonly name: string;
	readonly nameNode: ESTree.Node;
}
function getComponentDeclarationDetails(node: ESTree.Node): ComponentDetails | undefined {
	if (
		node.type !== "FunctionDeclaration" ||
		!isComponentDeclaration(node) ||
		node.id === null ||
		node.body === null
	) {
		return undefined;
	}

	if (!(isNode(node.id) && "name" in node.id && isStringRaw(node.id.name))) return undefined;

	return { body: node.body, name: node.id.name, nameNode: node.id };
}

function getComponentAssignmentDetails(node: ESTree.Node): ComponentDetails | undefined {
	if (node.type !== "VariableDeclarator" || !isComponentAssignment(node) || node.init === null) return undefined;
	if (!("name" in node.id && isStringRaw(node.id.name))) return undefined;
	if (node.init.type !== "ArrowFunctionExpression" && node.init.type !== "FunctionExpression") return undefined;
	if (!isNode(node.init.body)) return undefined;

	const { name } = node.id;
	return { body: node.init.body, name, nameNode: node.id };
}

const noGiantComponent = defineRule({
	create(context): Visitor {
		function reportOversizedComponent(node: ESTree.Node, name: string, body: ESTree.Node): void {
			const lineCount = getLineCount(body);
			if (lineCount <= GIANT_COMPONENT_LINE_THRESHOLD) return;

			context.report({
				data: { lineCount: String(lineCount), name },
				messageId: "giantComponent",
				node,
			});
		}

		return {
			FunctionDeclaration(node): void {
				const componentDetails = getComponentDeclarationDetails(node);
				if (componentDetails === undefined) return;
				reportOversizedComponent(componentDetails.nameNode, componentDetails.name, componentDetails.body);
			},
			VariableDeclarator(node): void {
				const componentDetails = getComponentAssignmentDetails(node);
				if (componentDetails === undefined) return;
				reportOversizedComponent(componentDetails.nameNode, componentDetails.name, componentDetails.body);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Report React components whose bodies exceed 300 lines.",
			recommended: true,
		},
		messages: {
			giantComponent:
				'Component "{{name}}" is {{lineCount}} lines — consider breaking it into smaller focused components',
		},
		type: "problem",
	},
});

export default noGiantComponent;
