import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { isRecord, isStringArray, isStringRaw } from "$oxc-utilities/type-utilities";
import { minimatch } from "minimatch";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface Restriction {
	message?: string;
	object: string;
	properties: ReadonlyArray<string>;
}

interface RuleOptions {
	allowFiles?: ReadonlyArray<string>;
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
	if (!(value.checkComputed === undefined || typeof value.checkComputed === "boolean")) return false;
	if (!(value.allowFiles === undefined || isStringArray(value.allowFiles))) return false;
	return true;
}

function isMemberExpressionTarget(node: ESTree.Node): node is ESTree.MemberExpression {
	return node.type === "MemberExpression";
}

function getEffectiveOptions(context: { filename: string; options: ReadonlyArray<unknown> }): {
	checkComputed: boolean;
	isAllowedFile: boolean;
	restrictions: ReadonlyArray<Restriction>;
} {
	const [options] = context.options;
	if (!isRuleOptions(options)) {
		return { checkComputed: true, isAllowedFile: false, restrictions: [] };
	}

	const { allowFiles, checkComputed, restrictions } = options;
	const isAllowedFile =
		allowFiles?.some((pattern) => minimatch(context.filename, pattern, { matchBase: true })) ?? false;

	return { checkComputed: checkComputed ?? true, isAllowedFile, restrictions };
}

const noRestrictedPropertyAssignment = defineRule({
	create(context): Visitor {
		const { checkComputed, isAllowedFile, restrictions } = getEffectiveOptions(context);

		function reportIfRestricted(node: ESTree.Node, reportNode: ESTree.Node): void {
			if (isAllowedFile) return;
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
					allowFiles: {
						items: {
							type: "string",
						},
						type: "array",
					},
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
