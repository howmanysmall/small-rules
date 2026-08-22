// Vendored from src/shared/lexical-type-parameters.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: replaced the upstream cast with repository type guards and adapted imports.

import { isNode } from "$oxc-utilities/oxc-utilities";
import { isRecord } from "$oxc-utilities/type-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

function appendChildNodes(value: unknown, pending: Array<ESTree.Node>): void {
	if (isNode(value)) {
		pending.push(value);
		return;
	}
	if (!Array.isArray(value)) {
		return;
	}
	for (const child of value) {
		if (isNode(child)) {
			pending.push(child);
		}
	}
}

function appendDescendants(
	node: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
	pending: Array<ESTree.Node>,
): void {
	if (!isRecord(node)) {
		return;
	}
	const keys = visitorKeys[node.type];
	if (keys === undefined) {
		return;
	}
	for (const key of keys) {
		appendChildNodes(node[key], pending);
	}
}

function collectInferTypeParameterNames(
	node: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
	names: Set<string>,
): void {
	let pending: Array<ESTree.Node> = [node];
	while (pending.length > 0) {
		const next: Array<ESTree.Node> = [];
		for (const current of pending) {
			if (current.type === "TSInferType") {
				names.add(current.typeParameter.name.name);
			}
			appendDescendants(current, visitorKeys, next);
		}
		pending = next;
	}
}

function collectTypeParameterNames(node: ESTree.Node, names: Set<string>): void {
	if (!("typeParameters" in node)) {
		return;
	}
	const parameters = node.typeParameters?.params;
	if (parameters === undefined) {
		return;
	}
	for (const parameter of parameters) {
		names.add(parameter.name.name);
	}
}

function collectMappedTypeParameterName(node: ESTree.Node, descendant: ESTree.Node, names: Set<string>): void {
	if (node.type === "TSMappedType" && (descendant === node.nameType || descendant === node.typeAnnotation)) {
		names.add(node.key.name);
	}
}

function collectConditionalInferTypeParameterNames(
	node: ESTree.Node,
	descendant: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
	names: Set<string>,
): void {
	if (node.type === "TSConditionalType" && descendant === node.trueType) {
		collectInferTypeParameterNames(node.extendsType, visitorKeys, names);
	}
}

export function lexicalTypeParameterNames(
	node: ESTree.Node,
	visitorKeys: SourceCode["visitorKeys"],
): ReadonlySet<string> {
	const names = new Set<string>();
	let descendant = node;
	let current = node;
	while (current.type !== "Program") {
		collectTypeParameterNames(current, names);
		collectMappedTypeParameterName(current, descendant, names);
		collectConditionalInferTypeParameterNames(current, descendant, visitorKeys, names);
		descendant = current;
		current = current.parent;
	}
	return names;
}
