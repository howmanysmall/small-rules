import { getMemberPropertyName } from "$oxc-utilities/ast-utilities";
import { isMemberExpression } from "$oxc-utilities/oxc-utilities";
import { type } from "arktype";
import { minimatch, Minimatch } from "minimatch";
import { defineRule } from "oxlint-plugin-utilities";

import type { MinimatchOptions } from "minimatch";
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
type Matcher = (value: string) => boolean;
type Restriction = typeof isRestriction.infer;
interface CompiledMatcher {
	readonly hasMagic: boolean;
	readonly matches: Matcher;
}
interface CompiledRestriction {
	readonly matchesObject: Matcher;
	readonly matchesProperty: Matcher;
	readonly message: Restriction["message"];
}
type EffectiveOptions = Simplify<
	Except<typeof isRuleOptions.infer, "allowFiles" | "restrictions"> & {
		readonly isAllowedFile: boolean;
		readonly checkComputed: boolean;
		readonly restrictions: ReadonlyArray<CompiledRestriction>;
	}
>;

const FILE_MATCH_OPTIONS = { matchBase: true } satisfies MinimatchOptions;
const NAME_MATCH_OPTIONS = { dot: true, magicalBraces: true } satisfies MinimatchOptions;

function compileMatcher(pattern: string, options: MinimatchOptions): CompiledMatcher {
	const matcher = new Minimatch(pattern, options);
	const hasMagic = matcher.hasMagic();
	return {
		hasMagic,
		matches: hasMagic ? (value): boolean => matcher.match(value) : (value): boolean => value === pattern,
	};
}

function createPropertyMatcher(patterns: ReadonlyArray<string>): Matcher {
	const literalPatterns = new Set<string>();
	const globMatchers: Array<Matcher> = [];

	for (const pattern of patterns) {
		const matcher = compileMatcher(pattern, NAME_MATCH_OPTIONS);
		if (matcher.hasMagic) {
			globMatchers.push(matcher.matches);
		} else {
			literalPatterns.add(pattern);
		}
	}

	return (property) => literalPatterns.has(property) || globMatchers.some((matcher) => matcher(property));
}

function compileRestriction(restriction: Restriction): CompiledRestriction {
	return {
		matchesObject: compileMatcher(restriction.object, NAME_MATCH_OPTIONS).matches,
		matchesProperty: createPropertyMatcher(restriction.properties),
		message: restriction.message,
	};
}

function getEffectiveOptions(context: Context): EffectiveOptions {
	const [options] = context.options;
	if (!isRuleOptions.allows(options)) return { checkComputed: true, isAllowedFile: false, restrictions: [] };

	const { allowFiles, checkComputed, restrictions } = options;
	const isAllowedFile =
		allowFiles?.some((pattern) => minimatch(context.filename, pattern, FILE_MATCH_OPTIONS)) ?? false;

	return { checkComputed: checkComputed ?? true, isAllowedFile, restrictions: restrictions.map(compileRestriction) };
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
				if (!restriction.matchesObject(node.object.name)) continue;
				if (restriction.matchesProperty(property)) {
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
