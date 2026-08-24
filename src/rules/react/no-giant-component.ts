import { Predicate } from "effect";

import { isComponentDeclaration } from "$oxc-utilities/component-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isComponentAssignment } from "$oxc-utilities/lint-utilities";
import { isNode } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const GIANT_COMPONENT_LINE_THRESHOLD = 300;

function getLineCount(node: ESTree.Node): number {
	return node.loc.end.line - node.loc.start.line + 1;
}

interface ComponentDetails {
	readonly name: string;
	readonly body: ESTree.Node;
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

	/* v8 ignore next -- FunctionDeclaration ids are parser-produced identifiers after the null guard. @preserve */
	if (!isNode(node.id) || !("name" in node.id) || !Predicate.isString(node.id.name)) return undefined;

	return { name: node.id.name, body: node.body, nameNode: node.id };
}

function getComponentAssignmentDetails(node: ESTree.Node): ComponentDetails | undefined {
	if (node.type !== "VariableDeclarator" || !isComponentAssignment(node) || node.init === null) return undefined;
	/* v8 ignore next -- component assignments require identifier declarators. @preserve */
	if (!("name" in node.id) || !Predicate.isString(node.id.name)) return undefined;
	/* v8 ignore next -- component assignments require function initializers. @preserve */
	if (node.init.type !== "ArrowFunctionExpression" && node.init.type !== "FunctionExpression") return undefined;
	/* v8 ignore next -- function initializers have parser-produced node bodies. @preserve */
	if (!isNode(node.init.body)) return undefined;

	const { name } = node.id;
	return { name, body: node.init.body, nameNode: node.id };
}

const noGiantComponent = createRule("no-giant-component", "react", {
	create(context): Visitor {
		function reportOversizedComponent(node: ESTree.Node, name: string, body: ESTree.Node): void {
			const lineCount = getLineCount(body);
			if (lineCount <= GIANT_COMPONENT_LINE_THRESHOLD) return;

			context.report({
				data: { name, lineCount: String(lineCount) },
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
