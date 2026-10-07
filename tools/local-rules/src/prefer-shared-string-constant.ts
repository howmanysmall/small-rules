import {
	isIdentifier,
	isIdentifierNamed,
	isProperty,
	isStringLiteral,
	isTsAsExpression,
	isTsSatisfiesExpression,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";
import { defineRule } from "oxlint-plugin-utilities";

import { createImportingFix } from "./import-fixes.ts";
import { loadRepositoryUtilities } from "./repository-utilities.ts";

import type { CreateRule, ESTree, RuleSchemaDefinition, Visitor } from "oxlint-plugin-utilities";

import type { UtilitiesIndex } from "./utilities-index.ts";

const SCHEMA = [
	{
		additionalProperties: false,
		properties: {
			ignoredProperties: {
				description: "Property names whose string values are never reported, such as a rule's `type`.",
				items: { type: "string" },
				type: "array",
			},
		},
		type: "object",
	},
] as const satisfies RuleSchemaDefinition;

/** Places a string literal is syntax, not a value a constant could replace. */
const NON_VALUE_PARENTS = new Set<string>([
	"ExportAllDeclaration",
	"ExportNamedDeclaration",
	"ExpressionStatement",
	"ImportDeclaration",
	"ImportExpression",
	"JSXAttribute",
	"TSEnumMember",
	"TSLiteralType",
]);

function getPropertyName(key: ESTree.Node): string | undefined {
	if (isIdentifier(key)) return key.name;
	return isStringLiteral(key) ? key.value : undefined;
}

/**
 * Whether the literal is a value: not an object key, an import source, a type,
 * an enum value, a JSX attribute, a directive, or the value of an ignored
 * property.
 *
 * @param node - String literal.
 * @param ignoredProperties - Property names whose values are skipped.
 * @returns Whether a constant could stand in for it.
 */
function isValuePosition(node: ESTree.StringLiteral, ignoredProperties: ReadonlySet<string>): boolean {
	const { parent } = node;
	if (NON_VALUE_PARENTS.has(parent.type) || isNamingKey(node, parent)) return false;
	if (!isProperty(parent) || parent.value !== node) return true;

	const name = getPropertyName(parent.key);
	return name === undefined || !ignoredProperties.has(name);
}

/**
 * A key that names a property or member, as in `{ "name": value }`; a computed
 * key, `{ ["name"]: value }`, is a value.
 *
 * @param node - String literal.
 * @param parent - Its parent.
 * @returns Whether the literal is a non-computed key.
 */
function isNamingKey(node: ESTree.StringLiteral, parent: ESTree.Node): boolean {
	return (
		Predicate.hasProperty(parent, "key") &&
		parent.key === node &&
		(!Predicate.hasProperty(parent, "computed") || !parent.computed)
	);
}

/**
 * The constant's own definition, `const NAME = "value"`, possibly with
 * `as const` or `satisfies`.
 *
 * @param node - String literal.
 * @param name - Name the constant is exported as.
 * @returns Whether the literal is the value the constant is defined as.
 */
function isConstantDefinition(node: ESTree.StringLiteral, name: string): boolean {
	let current = node.parent;
	while (isTsAsExpression(current) || isTsSatisfiesExpression(current)) current = current.parent;
	return isVariableDeclarator(current) && isIdentifierNamed(current.id, name);
}

export function createPreferSharedStringConstantRule(
	getIndex: () => UtilitiesIndex,
): CreateRule<typeof SCHEMA, "useConstant"> {
	return defineRule({
		create(context): Visitor {
			const index = getIndex();
			const { sourceCode } = context;
			const ownSpecifier = index.getSpecifierOf(context.filename);
			const [options] = context.options;
			const ignoredProperties = new Set(options?.ignoredProperties);

			return {
				Literal(node): void {
					if (!isStringLiteral(node) || !isValuePosition(node, ignoredProperties)) return;

					const [constant] = index.getConstants(node.value);
					if (constant === undefined || isConstantDefinition(node, constant.name)) return;

					const isDefiningModule = ownSpecifier === constant.specifier;
					context.report({
						data: { constant: constant.name, specifier: constant.specifier, value: node.value },
						fix: createImportingFix(sourceCode, node, constant.name, constant, isDefiningModule),
						messageId: "useConstant",
						node,
					});
				},
			} satisfies Visitor;
		},
		meta: {
			docs: {
				description:
					"Prefer the string constants exported by shared utilities over repeating their values inline, so the bundle stores each string once",
			},
			fixable: "code",
			messages: {
				useConstant: 'Use `{{constant}}` from `{{specifier}}` instead of the inline "{{value}}" string.',
			},
			schema: SCHEMA,
			type: "suggestion",
		},
	});
}

const preferSharedStringConstant = createPreferSharedStringConstantRule(loadRepositoryUtilities);

export default preferSharedStringConstant;
