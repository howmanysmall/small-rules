import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { isMemberExpression } from "$oxc-utilities/oxc-utilities";
import { type } from "arktype";
import { minimatch } from "minimatch";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";
import type { Except, Simplify } from "type-fest";

const isRestriction = type({
	"message?": "string | undefined",
	object: "string",
	properties: type("string[]").readonly(),
}).readonly();
const isRuleOptions = type({
	"allowFiles?": type("string[]").readonly().or("undefined"),
	"checkComputed?": "boolean | undefined",
	restrictions: isRestriction.array().readonly(),
}).readonly();

type Context = InferContextFromRule<typeof noRestrictedPropertyAssignment>;
type EffectiveOptions = Simplify<
	Except<typeof isRuleOptions.infer, "allowFiles"> & {
		readonly isAllowedFile: boolean;
		readonly checkComputed: boolean;
	}
>;

const MATCH_BASE = { matchBase: true };

function getEffectiveOptions(context: Context): EffectiveOptions {
	const [options] = context.options;
	if (!isRuleOptions.allows(options)) return { checkComputed: true, isAllowedFile: false, restrictions: [] };

	const { allowFiles, checkComputed, restrictions } = options;
	const isAllowedFile = allowFiles?.some((pattern) => minimatch(context.filename, pattern, MATCH_BASE)) ?? false;

	return { checkComputed: checkComputed ?? true, isAllowedFile, restrictions };
}

const noRestrictedPropertyAssignment = defineRule({
	create(context): Visitor {
		const { checkComputed, isAllowedFile, restrictions } = getEffectiveOptions(context);

		function reportIfRestricted(node: ESTree.Node, reportNode: ESTree.Node): void {
			if (isAllowedFile || !isMemberExpression(node)) return;
			if ((node.computed && !checkComputed) || node.object.type !== "Identifier") return;

			const property = getMemberPropertyName(node);
			if (property === undefined) return;

			for (const restriction of restrictions) {
				if (!minimatch(node.object.name, restriction.object, MATCH_BASE)) continue;
				if (restriction.properties.some((pattern) => minimatch(property, pattern, MATCH_BASE))) {
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
