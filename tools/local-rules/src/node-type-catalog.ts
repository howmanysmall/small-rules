import { Predicate } from "effect";

import { isNodeTypeName, NODE_TYPES } from "./node-types.ts";

export interface NodeTypeCatalog {
	readonly getConstant: (nodeType: string) => string | undefined;
	readonly getGuards: (nodeType: string) => ReadonlyArray<string>;
	readonly getNodeTypeOfConstant: (name: string) => string | undefined;
	readonly isGuardName: (name: string) => boolean;
}

interface ProbeNode {
	readonly type: string;
}

type ProbedFunction = (node: ProbeNode) => boolean;

/** A `[name, value]` export pair, as `Object.entries` yields it. */
export type ModuleExport = readonly [name: string, value: unknown];

const GUARD_NAME = /^is[A-Z]/v;
const NO_GUARDS: ReadonlyArray<string> = [];
const PRESENT = { present: true };

function isProbedFunction(value: unknown): value is ProbedFunction {
	return Predicate.isFunction(value);
}

/**
 * Every property besides `type` exists and is truthy, so a guard that looks
 * past `type` answers differently here than for a bare `{ type }` node.
 *
 * @param type - Node type the probe reports.
 * @returns A node whose other properties all exist.
 */
function createDecoratedProbe(type: string): ProbeNode {
	return new Proxy(
		{ type },
		{
			get: (_target, property) => (property === "type" ? type : PRESENT),
			has: () => true,
		},
	);
}

/**
 * A guard is a drop-in replacement for `node.type === X` only when its
 * answer depends on `type` alone and is true for exactly one node type.
 *
 * @param guard - Exported `is*` function to probe.
 * @returns The one node type the guard accepts, if it is such a guard.
 */
function getGuardedNodeType(guard: ProbedFunction): string | undefined {
	let guardedNodeType: string | undefined;

	for (const nodeType of NODE_TYPES) {
		let bareResult: unknown;
		let decoratedResult: unknown;
		try {
			bareResult = guard({ type: nodeType });
			decoratedResult = guard(createDecoratedProbe(nodeType));
		} catch {
			return undefined;
		}

		if (bareResult !== decoratedResult) return undefined;
		if (bareResult !== true) continue;
		if (guardedNodeType !== undefined) return undefined;
		guardedNodeType = nodeType;
	}

	return guardedNodeType;
}

function compareGuards(nodeType: string): (left: string, right: string) => number {
	const exactName = `is${nodeType}`;
	return (left, right) => {
		if (left === exactName) return -1;
		if (right === exactName) return 1;
		return left.length - right.length || left.localeCompare(right);
	};
}

/**
 * Reads the node type constants and type guards a utilities module exports.
 *
 * @param moduleExports - Every export of the shared utilities module.
 * @returns Lookups from node types to constants and guards.
 */
export function createNodeTypeCatalog(moduleExports: Iterable<ModuleExport>): NodeTypeCatalog {
	const constantByNodeType = new Map<string, string>();
	const nodeTypeByConstant = new Map<string, string>();
	const guardsByNodeType = new Map<string, Array<string>>();
	const guardNames = new Set<string>();

	for (const [name, value] of moduleExports) {
		if (Predicate.isString(value)) {
			if (!isNodeTypeName(value)) continue;
			constantByNodeType.set(value, name);
			nodeTypeByConstant.set(name, value);
			continue;
		}

		if (!isProbedFunction(value) || !GUARD_NAME.test(name)) continue;

		const nodeType = getGuardedNodeType(value);
		if (nodeType === undefined) continue;

		guardNames.add(name);
		const guards = guardsByNodeType.get(nodeType);
		if (guards === undefined) guardsByNodeType.set(nodeType, [name]);
		else guards.push(name);
	}

	for (const [nodeType, guards] of guardsByNodeType) guards.sort(compareGuards(nodeType));

	return {
		getConstant: (nodeType) => constantByNodeType.get(nodeType),
		getGuards: (nodeType) => guardsByNodeType.get(nodeType) ?? NO_GUARDS,
		getNodeTypeOfConstant: (name) => nodeTypeByConstant.get(name),
		isGuardName: (name) => guardNames.has(name),
	};
}
