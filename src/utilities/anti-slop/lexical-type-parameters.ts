// Vendored from src/shared/lexical-type-parameters.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: replaced the upstream cast with repository type guards and
// Reflect-based child access, made infer collection an append-only worklist,
// pruned nested conditional ownership during infer collection, and added a
// stop-exclusive owner boundary for alias substitutions.

import { isNode, isProgram, isTsConditionalType, isTsInferType, isTsMappedType } from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

// oxlint-disable-next-line small-rules/no-unknown-parameters -- visitor values are validated with isNode.
function appendChildNodes(value: unknown, pending: Array<ESTree.Node>): void {
	if (isNode(value)) {
		pending.push(value);
		return;
	}
	if (!Array.isArray(value)) return;
	for (const child of value) {
		/* v8 ignore next -- the istanbul conversion emits an empty implicit-else arm for this branch. @preserve */
		if (isNode(child)) pending.push(child);
	}
}

/**
 * Appends the visitor-key children of an AST node to a worklist.
 *
 * @param node - AST node whose direct children should be appended.
 * @param visitorKeys - Parser visitor keys identifying child properties.
 * @param pending - Append-only worklist that receives each child node.
 */
export function appendVisitorChildren(
	node: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
	pending: Array<ESTree.Node>,
): void {
	const keys = visitorKeys[node.type];
	if (keys === undefined) return;
	for (const key of keys) {
		// oxlint-disable-next-line small-rules/no-reflect-get -- visitor keys are dynamic parser metadata.
		appendChildNodes(Reflect.get(node, key), pending);
	}
}

function collectInferTypeParameterNames(
	node: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
	names: Set<string>,
): void {
	const pending: Array<ESTree.Node> = [node];
	for (const current of pending) {
		if (isTsConditionalType(current)) continue;
		if (isTsInferType(current)) names.add(current.typeParameter.name.name);
		appendVisitorChildren(current, visitorKeys, pending);
	}
}

function collectTypeParameterNames(node: ESTree.Node, names: Set<string>): void {
	if (!("typeParameters" in node)) return;
	const parameters = node.typeParameters?.params;
	if (parameters === undefined) return;

	for (const parameter of parameters) {
		names.add(parameter.name.name);
	}
}

function collectMappedTypeParameterName(node: ESTree.Node, descendant: ESTree.Node, names: Set<string>): void {
	if (isTsMappedType(node) && (descendant === node.nameType || descendant === node.typeAnnotation)) {
		names.add(node.key.name);
	}
}

function collectConditionalInferTypeParameterNames(
	node: ESTree.Node,
	descendant: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
	names: Set<string>,
): void {
	if (isTsConditionalType(node) && descendant === node.trueType) {
		collectInferTypeParameterNames(node.extendsType, visitorKeys, names);
	}
}

export function lexicalTypeParameterNames(
	node: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
	stopBefore?: ESTree.Node,
): ReadonlySet<string> {
	const names = new Set<string>();
	let descendant = node;
	let current = node;
	while (current !== stopBefore && !isProgram(current)) {
		collectTypeParameterNames(current, names);
		collectMappedTypeParameterName(current, descendant, names);
		collectConditionalInferTypeParameterNames(current, descendant, visitorKeys, names);
		descendant = current;
		current = current.parent;
	}
	return names;
}
