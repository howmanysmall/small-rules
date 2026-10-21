import { isIdentifier, isPrivateIdentifier } from "@small-rules/oxlint-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

type MemberObject = ESTree.MemberExpression["object"];

type MemberProperty = ESTree.Expression | ESTree.PrivateIdentifier;

export type MemberPartComparer<Part> = (left: Part, right: Part, sourceCode: SourceCode) => boolean;

function areEquivalentStaticMemberProperties(left: MemberProperty, right: MemberProperty): boolean {
	if (isIdentifier(left) && isIdentifier(right)) return left.name === right.name;
	return isPrivateIdentifier(left) && isPrivateIdentifier(right) && left.name === right.name;
}

/**
 * Compares two member expressions structurally: same `computed` and
 * `optional` flags, equivalent objects, and equivalent properties. Static
 * properties compare by name; objects and computed properties use the
 * caller's notion of equivalence.
 *
 * @param left - The first member expression.
 * @param right - The second member expression.
 * @param sourceCode - The source code of the current file.
 * @param areEquivalentObjects - Compares the two member objects.
 * @param areEquivalentComputedProperties - Compares two computed properties.
 * @returns Whether the member expressions are equivalent.
 */
export function areEquivalentMemberExpressions(
	left: ESTree.MemberExpression,
	right: ESTree.MemberExpression,
	sourceCode: SourceCode,
	areEquivalentObjects: MemberPartComparer<MemberObject>,
	areEquivalentComputedProperties: MemberPartComparer<MemberProperty>,
): boolean {
	if (left.computed !== right.computed || left.optional !== right.optional) return false;
	if (!areEquivalentObjects(left.object, right.object, sourceCode)) return false;

	return left.computed
		? areEquivalentComputedProperties(left.property, right.property, sourceCode)
		: areEquivalentStaticMemberProperties(left.property, right.property);
}
