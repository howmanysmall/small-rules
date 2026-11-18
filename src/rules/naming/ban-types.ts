import { isIdentifier, isMemberExpression, isTsQualifiedName } from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import { isStringArray, isStringRecord } from "$oxc-utilities/type-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

interface BannedTypeEntry {
	readonly originalName: string;
	readonly replacementName?: string | undefined;
}

const DEFAULT_BANNED_TYPES = new Map<string, BannedTypeEntry>([
	["omit", { originalName: "Omit", replacementName: "Except" }],
]);

type RuleOptions = InferContextFromRule<typeof banTypes>["options"][0];

function normalizeBannedTypes(rawOptions: RuleOptions): ReadonlyMap<string, BannedTypeEntry> {
	const bannedTypes = new Map(DEFAULT_BANNED_TYPES);

	if (!Predicate.isObject(rawOptions) || !("bannedTypes" in rawOptions)) return bannedTypes;

	const { bannedTypes: configuredBannedTypes } = rawOptions;

	if (isStringArray(configuredBannedTypes)) {
		for (const typeName of configuredBannedTypes) {
			bannedTypes.set(typeName.toLowerCase(), { originalName: typeName, replacementName: undefined });
		}

		return bannedTypes;
	}

	/* v8 ignore next -- schema allows only arrays or string records for configured banned types. @preserve */
	if (isStringRecord(configuredBannedTypes)) {
		for (const [typeName, replacementName] of Object.entries(configuredBannedTypes)) {
			bannedTypes.set(typeName.toLowerCase(), { originalName: typeName, replacementName });
		}
	}

	return bannedTypes;
}

function getReferencedTypeName(typeNameNode: ESTree.TSTypeName): string | undefined {
	if (isIdentifier(typeNameNode)) return typeNameNode.name;
	/* v8 ignore next -- TSQualifiedName is the only other parser-produced TSTypeName variant. @preserve */
	if (isTsQualifiedName(typeNameNode)) return typeNameNode.right.name;
	/* v8 ignore next -- ESTree TSTypeName is currently only Identifier or TSQualifiedName. @preserve */
	return undefined;
}

/**
 * Names the type a heritage clause extends or implements.
 *
 * @param expression - The clause's expression, an identifier or member access.
 * @returns The referenced name, or undefined for `this`.
 */
function getHeritageTypeName(expression: ESTree.Expression): string | undefined {
	if (isIdentifier(expression)) return expression.name;
	return isMemberExpression(expression) && !expression.computed ? expression.property.name : undefined;
}

const banTypes = createRule("ban-types", "naming", {
	create(context): Visitor {
		const [rawOptions] = context.options;

		const bannedTypes = normalizeBannedTypes(rawOptions);

		function reportBannedType(referencedTypeName: string, node: ESTree.Node): void {
			const bannedTypeEntry = bannedTypes.get(referencedTypeName.toLowerCase());
			if (bannedTypeEntry === undefined) return;

			if (bannedTypeEntry.replacementName !== undefined && bannedTypeEntry.replacementName.length > 0) {
				context.report({
					data: {
						replacementName: bannedTypeEntry.replacementName,
						typeName: bannedTypeEntry.originalName,
					},
					messageId: "bannedTypeWithReplacement",
					node,
				});
				return;
			}

			context.report({
				data: { typeName: bannedTypeEntry.originalName },
				messageId: "bannedType",
				node,
			});
		}

		function checkHeritage(node: ESTree.TSClassImplements | ESTree.TSInterfaceHeritage): void {
			const heritageTypeName = getHeritageTypeName(node.expression);
			if (heritageTypeName === undefined) return;

			reportBannedType(heritageTypeName, node.expression);
		}

		return {
			TSClassImplements: checkHeritage,
			TSInterfaceHeritage: checkHeritage,
			TSTypeReference(node): void {
				const referencedTypeName = getReferencedTypeName(node.typeName);
				/* v8 ignore next -- parser-produced TSTypeReference nodes always have a supported typeName. @preserve */
				if (referencedTypeName === undefined) return;

				reportBannedType(referencedTypeName, node.typeName);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Ban configured TypeScript utility types, defaulting to Omit in favor of Except.",
		},
		messages: {
			bannedType:
				"Type '{{typeName}}' is banned by project configuration. Use the project-preferred alternative for this type.",
			bannedTypeWithReplacement: "Type '{{typeName}}' is banned. Use '{{replacementName}}' instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					bannedTypes: {
						default: { Omit: "Except" },
						description:
							"Array of banned type names or an object mapping banned type names to preferred replacement names.",
						oneOf: [
							{
								items: { type: "string" },
								type: "array",
							},
							{
								additionalProperties: { type: "string" },
								type: "object",
							},
						],
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default banTypes;
