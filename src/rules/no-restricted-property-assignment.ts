import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { isRecord, isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, VisitorWithHooks } from "oxlint-plugin-utilities";

interface Restriction {
	message?: string;
	object: string;
	properties: ReadonlyArray<string>;
}

interface RuleOptions {
	checkComputed?: boolean;
	restrictions: ReadonlyArray<Restriction>;
}

function isRestriction(value: unknown): value is Restriction {
	if (!isRecord(value)) return false;
	if (!isStringRaw(value.object)) return false;
	if (!Array.isArray(value.properties)) return false;
	if (!value.properties.every((property) => isStringRaw(property))) return false;
	return value.message === undefined || isStringRaw(value.message);
}

function isRuleOptions(value: unknown): value is RuleOptions {
	if (!isRecord(value)) return false;
	if (!Array.isArray(value.restrictions)) return false;
	if (!value.restrictions.every(isRestriction)) return false;
	return value.checkComputed === undefined || typeof value.checkComputed === "boolean";
}

function isMemberExpressionTarget(node: ESTree.Node): node is ESTree.MemberExpression {
	return node.type === "MemberExpression";
}

const noRestrictedPropertyAssignment = defineRule({
	createOnce(context): VisitorWithHooks {
		let restrictions: ReadonlyArray<Restriction> = [];
		let checkComputed = true;

		function reportIfRestricted(node: ESTree.Node, reportNode: ESTree.Node): void {
			if (!isMemberExpressionTarget(node)) return;
			if (node.computed && !checkComputed) return;
			if (node.object.type !== "Identifier") return;

			const property = getMemberPropertyName(node);
			if (property === undefined) return;

			for (const restriction of restrictions) {
				if (restriction.object !== node.object.name) continue;
				if (restriction.properties.includes("*") || restriction.properties.includes(property)) {
					if (restriction.message === undefined) {
						context.report({
							data: { object: node.object.name, property },
							messageId: "restricted",
							node: reportNode,
						});
					} else {
						context.report({
							data: { message: restriction.message },
							messageId: "restrictedCustom",
							node: reportNode,
						});
					}
					return;
				}
			}
		}

		return {
			AssignmentExpression(node): void {
				reportIfRestricted(node.left, node);
			},
			before() {
				const [options] = context.options;
				if (!isRuleOptions(options)) {
					restrictions = [];
					checkComputed = true;
					return;
				}

				const { checkComputed: nextCheckComputed, restrictions: nextRestrictions } = options;
				restrictions = nextRestrictions;
				checkComputed = nextCheckComputed ?? true;
			},
			UpdateExpression(node): void {
				reportIfRestricted(node.argument, node);
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow assignment to restricted object properties.",
			recommended: true,
		},
		messages: {
			restricted: "Assignment to '{{object}}.{{property}}' is not permitted.",
			restrictedCustom: "{{message}}",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					checkComputed: {
						default: true,
						type: "boolean",
					},
					restrictions: {
						items: {
							additionalProperties: false,
							properties: {
								message: {
									type: "string",
								},
								object: {
									type: "string",
								},
								properties: {
									items: {
										type: "string",
									},
									minItems: 1,
									type: "array",
								},
							},
							required: ["object", "properties"],
							type: "object",
						},
						type: "array",
					},
				},
				required: ["restrictions"],
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noRestrictedPropertyAssignment;
