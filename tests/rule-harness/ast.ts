// oxlint-disable unicorn/no-null -- ESTree Program parents use null sentinels.
import { visitorKeys } from "oxc-parser";

import { throwHarnessError } from "./errors";
import { locationForRange } from "./locations";
import { isRecord } from "./object";

import type { LocationIndex } from "./locations";
import type { HarnessNode, Range } from "./types";

export const harnessVisitorKeys: Record<string, ReadonlyArray<string>> = visitorKeys;

const ATTRIBUTE_SELECTOR_PATTERN = /\[(?<path>[\w.]+)=(?<quote>["'])(?<value>.*?)\k<quote>\]/gu;
const CHILD_FIELD_SELECTOR_PATTERN = /^(?<parentType>\w+)\s*>\s*\.(?<field>\w+)$/u;

export function decorateAst(program: unknown, locationIndex: LocationIndex): HarnessNode {
	if (!isParsedNode(program)) throwHarnessError("Oxc parser returned an invalid Program node.");
	attachNodeMetadata(program, null, locationIndex);
	if (!isHarnessNode(program)) throwHarnessError("Oxc parser Program node could not be decorated.");
	return program;
}

export function traverseAst(root: HarnessNode, visitor: unknown): void {
	const entries = createVisitorEntries(visitor);
	traverseNode(root, entries);
}

export function isHarnessNode(value: unknown): value is HarnessNode {
	if (!isRecord(value)) return false;
	return typeof value.type === "string" && isRange(value.range) && isRecord(value.loc);
}

export function getNodeChildren(node: HarnessNode): Array<HarnessNode> {
	const keys = harnessVisitorKeys[node.type] ?? [];
	const children = new Array<HarnessNode>();
	let size = 0;

	for (const key of keys) {
		const child = node[key];
		if (Array.isArray(child)) {
			for (const item of child) {
				if (isHarnessNode(item)) children[size++] = item;
			}
			continue;
		}

		if (isHarnessNode(child)) children[size++] = child;
	}

	return children.toSorted(compareNodeRanges);
}

function compareNodeRanges(left: HarnessNode, right: HarnessNode): number {
	return left.range[0] - right.range[0] || left.range[1] - right.range[1];
}

function attachNodeMetadata(
	node: Record<string, unknown>,
	parent: HarnessNode | null,
	locationIndex: LocationIndex,
): void {
	const range = readRange(node.range);
	if (range === undefined) return;

	normalizeNodeShape(node);
	node.parent = parent;
	node.loc = locationForRange(locationIndex, range);

	if (!isHarnessNode(node)) return;

	const keys = harnessVisitorKeys[node.type] ?? [];
	for (const key of keys) {
		const child = node[key];
		if (Array.isArray(child)) {
			for (const item of child) {
				if (isParsedNode(item)) attachNodeMetadata(item, node, locationIndex);
			}
			continue;
		}

		if (isParsedNode(child)) attachNodeMetadata(child, node, locationIndex);
	}
}

function normalizeNodeShape(node: Record<string, unknown>): void {
	if (node.type !== "MethodDefinition" || typeof node.kind === "string") return;
	const { key } = node;
	if (!isRecord(key)) return;
	node.kind = key.name === "constructor" ? "constructor" : "method";
}

function isParsedNode(value: unknown): value is Record<string, unknown> {
	if (!isRecord(value)) return false;
	return typeof value.type === "string" && readRange(value.range) !== undefined;
}

function readRange(value: unknown): Range | undefined {
	if (!isRange(value)) return undefined;
	return value;
}

function isRange(value: unknown): value is Range {
	return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

interface VisitorEntries {
	enter: Map<string, Array<VisitorEntry>>;
	exit: Map<string, Array<VisitorEntry>>;
}

type VisitorCallback = (node: HarnessNode) => void;
type NodePredicate = (node: HarnessNode) => boolean;

interface VisitorEntry {
	callback: VisitorCallback;
	matches: NodePredicate;
}

function createVisitorEntries(visitor: unknown): VisitorEntries {
	const entries: VisitorEntries = { enter: new Map(), exit: new Map() };
	if (!isRecord(visitor)) return entries;

	for (const [key, value] of Object.entries(visitor)) {
		if (!isVisitorCallback(value)) continue;
		const exitSuffix = ":exit";
		if (key.endsWith(exitSuffix)) {
			addVisitor(entries.exit, key.slice(0, -exitSuffix.length), value);
			continue;
		}
		addVisitor(entries.enter, key, value);
	}

	return entries;
}

function addVisitor(map: Map<string, Array<VisitorEntry>>, selector: string, visitor: VisitorCallback): void {
	const parsed = parseSelector(selector);
	const visitors = map.get(parsed.nodeType);
	const entry: VisitorEntry = { callback: visitor, matches: parsed.matches };
	if (visitors === undefined) {
		map.set(parsed.nodeType, [entry]);
		return;
	}
	visitors.push(entry);
}

function isVisitorCallback(value: unknown): value is VisitorCallback {
	return typeof value === "function";
}

function traverseNode(node: HarnessNode, entries: VisitorEntries): void {
	for (const visitor of getVisitors(entries.enter, node.type)) {
		if (visitor.matches(node)) visitor.callback(node);
	}
	for (const child of getNodeChildren(node)) traverseNode(child, entries);
	for (const visitor of getVisitors(entries.exit, node.type)) {
		if (visitor.matches(node)) visitor.callback(node);
	}
}

function getVisitors(map: Map<string, Array<VisitorEntry>>, nodeType: string): ReadonlyArray<VisitorEntry> {
	return [...(map.get(nodeType) ?? []), ...(map.get("*") ?? [])];
}

function parseSelector(selector: string): { matches: NodePredicate; nodeType: string } {
	const childSelector = parseChildFieldSelector(selector);
	if (childSelector !== undefined) return childSelector;

	const statementSelector = parseStatementNotSelector(selector);
	if (statementSelector !== undefined) return statementSelector;

	const bracketIndex = selector.indexOf("[");
	if (bracketIndex === -1) return { matches: () => true, nodeType: selector };

	const nodeType = selector.slice(0, bracketIndex);
	const conditions = new Array<NodePredicate>();
	for (const match of selector.matchAll(ATTRIBUTE_SELECTOR_PATTERN)) {
		const path = match.groups?.path;
		const value = match.groups?.value;
		if (path === undefined || value === undefined) continue;
		conditions.push((node) => readPath(node, path) === value);
	}

	return {
		matches(node): boolean {
			return conditions.every((condition) => condition(node));
		},
		nodeType,
	};
}

function parseChildFieldSelector(selector: string): { matches: NodePredicate; nodeType: string } | undefined {
	const match = CHILD_FIELD_SELECTOR_PATTERN.exec(selector);
	const parentType = match?.groups?.parentType;
	const field = match?.groups?.field;
	if (parentType === undefined || field === undefined) return undefined;

	return {
		matches(node): boolean {
			const { parent } = node;
			if (parent === null || parent === undefined || parent.type !== parentType) return false;
			const value = parent[field];
			if (Array.isArray(value)) return value.includes(node);
			return value === node;
		},
		nodeType: "*",
	};
}

function parseStatementNotSelector(selector: string): { matches: NodePredicate; nodeType: string } | undefined {
	const prefix = ":statement:not(";
	if (!(selector.startsWith(prefix) && selector.endsWith(")"))) return undefined;

	const excluded = parseSelector(selector.slice(prefix.length, -1));
	return {
		matches(node): boolean {
			return isStatementNode(node) && !(node.type === excluded.nodeType && excluded.matches(node));
		},
		nodeType: "*",
	};
}

function isStatementNode(node: HarnessNode): boolean {
	return node.type.endsWith("Statement") || node.type.endsWith("Declaration");
}

function readPath(node: HarnessNode, path: string): unknown {
	let current: unknown = node;
	for (const key of path.split(".")) {
		if (!isRecord(current)) return undefined;
		current = current[key];
	}
	return current;
}
