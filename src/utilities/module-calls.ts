import {
	IMPORT_EXPRESSION,
	isAwaitExpression,
	isCallExpression,
	isIdentifier,
	isIdentifierNamed,
	isImportSpecifier,
	isMemberExpression,
	isObjectPattern,
	isRestElement,
	isStringLiteral,
} from "@small-rules/oxlint-utilities";

import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

/**
 * A module's matched surface: `true` marks a matched function, an object a
 * namespace.
 */
export interface ApiTree {
	readonly [key: string]: ApiTree | true;
}

/**
 * Functions to match in one module, as dotted paths such as
 * `promises.mkdtemp`.
 */
export interface ModuleFunctions {
	readonly functions: ReadonlyArray<string>;
	readonly source: string;
}

interface MutableApiTree {
	[key: string]: MutableApiTree | true;
}

type Binding = ApiTree | true;

interface PatternBinding {
	readonly binding: Binding;
	readonly pattern: ESTree.Node;
}

const NODE_PREFIX = /^node:/u;

function normalizeSource(source: string): string {
	return source.replace(NODE_PREFIX, "");
}

function addFunction(tree: MutableApiTree, path: string): void {
	let current = tree;
	const keys = path.split(".");
	for (const [index, key] of keys.entries()) {
		if (index === keys.length - 1) {
			current[key] = true;
			return;
		}

		const next = Object.hasOwn(current, key) ? current[key] : undefined;
		// A function already matched covers anything reached through it.
		if (next === true) return;

		const child: MutableApiTree = next ?? {};
		current[key] = child;
		current = child;
	}
}

/**
 * Builds the matched surface of each module, keyed by specifier without
 * `node:`. Each module gets its own tree, so a nested namespace is never
 * mistaken for a module.
 *
 * @param entries - The functions to match, grouped by module.
 * @returns The trees, ready for `createModuleCallVisitor`.
 */
export function createApiTrees(entries: ReadonlyArray<ModuleFunctions>): ReadonlyMap<string, ApiTree> {
	const trees = new Map<string, MutableApiTree>();
	for (const { functions, source } of entries) {
		const key = normalizeSource(source);
		let tree = trees.get(key);
		if (tree === undefined) {
			tree = {};
			trees.set(key, tree);
		}

		for (const path of functions) {
			addFunction(tree, path);
		}
	}

	return trees;
}

function getKeyName(node: ESTree.Node): string | undefined {
	if (isIdentifier(node)) return node.name;
	return isStringLiteral(node) ? node.value : undefined;
}

/**
 * Builds a visitor that calls `onCall` for every call to a function in
 * `modules`, resolved through named, aliased, namespace, and default imports,
 * `require()`, `import()`, and object destructuring.
 *
 * @param sourceCode - The source code of the current file.
 * @param modules - The trees from `createApiTrees`.
 * @param onCall - Receives each matched call.
 * @returns A visitor that tracks imports and `require` bindings to their calls.
 */
export function createModuleCallVisitor(
	sourceCode: SourceCode,
	modules: ReadonlyMap<string, ApiTree>,
	onCall: (call: ESTree.CallExpression) => void,
): Visitor {
	const roots: ReadonlySet<ApiTree> = new Set(modules.values());

	function getModuleTree(source?: ESTree.Node | null): ApiTree | undefined {
		return isStringLiteral(source) ? modules.get(normalizeSource(source.value)) : undefined;
	}

	function descend(tree: ApiTree, key: string): Binding | undefined {
		// `default` of a module namespace is the module itself under CJS interop.
		if (key === "default" && roots.has(tree)) return tree;

		return Object.hasOwn(tree, key) ? tree[key] : undefined;
	}

	/**
	 * Resolves `require(m)`, `import(m)`, and `await import(m)` to the tree of
	 * module `m`.
	 *
	 * @param node - The expression that may load a module.
	 * @returns The module's tree, if it is one of `modules`.
	 */
	function getRequiredTree(node: ESTree.Expression): ApiTree | undefined {
		const outer = stripExpressionWrappers(node);
		const inner = stripExpressionWrappers(isAwaitExpression(outer) ? outer.argument : outer);
		if (inner.type === IMPORT_EXPRESSION) return getModuleTree(inner.source);

		if (isCallExpression(inner) && isIdentifierNamed(inner.callee, "require") && inner.arguments.length === 1) {
			return getModuleTree(inner.arguments[0]);
		}

		return undefined;
	}

	function reportUse(start: ESTree.Node, binding: Binding): void {
		let current = start;
		let tree = binding;
		while (tree !== true) {
			const { parent } = current;
			if (!isMemberExpression(parent) || parent.object !== current || parent.computed) return;

			const next = descend(tree, parent.property.name);
			if (next === undefined) return;

			current = parent;
			tree = next;
		}

		const { parent } = current;
		if (isCallExpression(parent) && parent.callee === current) {
			onCall(parent);
		}
	}

	/**
	 * Reports the calls made through each variable named `name` that
	 * `declaration` declares.
	 *
	 * @param declaration - The import or variable declarator.
	 * @param name - The local name to follow.
	 * @param binding - What the name holds.
	 */
	function reportReferences(declaration: ESTree.Node, name: string, binding: Binding): void {
		for (const variable of sourceCode.getDeclaredVariables(declaration)) {
			if (variable.name !== name) continue;

			for (const reference of variable.references) {
				if (reference.isRead()) {
					reportUse(reference.identifier, binding);
				}
			}
		}
	}

	function getPropertyBinding(
		property: ESTree.ObjectPattern["properties"][number],
		binding: ApiTree,
	): PatternBinding | undefined {
		if (isRestElement(property)) {
			return { binding, pattern: property.argument };
		}

		if (property.computed) return undefined;

		const key = getKeyName(property.key);
		const next = key === undefined ? undefined : descend(binding, key);
		return next === undefined ? undefined : { binding: next, pattern: property.value };
	}

	function appendPropertyBindings(
		pattern: ESTree.ObjectPattern,
		binding: ApiTree,
		worklist: Array<PatternBinding>,
	): void {
		for (const property of pattern.properties) {
			const next = getPropertyBinding(property, binding);
			if (next !== undefined) {
				worklist.push(next);
			}
		}
	}

	function bindPattern(declarator: ESTree.VariableDeclarator, binding: Binding): void {
		const worklist: Array<PatternBinding> = [{ binding, pattern: declarator.id }];
		for (const { binding: current, pattern } of worklist) {
			if (isIdentifier(pattern)) {
				reportReferences(declarator, pattern.name, current);
			} else if (current !== true && isObjectPattern(pattern)) {
				appendPropertyBindings(pattern, current, worklist);
			}
		}
	}

	function bindImport(declaration: ESTree.ImportDeclaration, tree: ApiTree): void {
		for (const specifier of declaration.specifiers) {
			if (!isImportSpecifier(specifier)) {
				reportReferences(declaration, specifier.local.name, tree);
				continue;
			}

			if (specifier.importKind === "type") continue;

			const { imported } = specifier;
			const binding = descend(tree, isIdentifier(imported) ? imported.name : imported.value);
			if (binding !== undefined) {
				reportReferences(declaration, specifier.local.name, binding);
			}
		}
	}

	return {
		ImportDeclaration(node): void {
			const tree = node.importKind === "type" ? undefined : getModuleTree(node.source);
			if (tree !== undefined) {
				bindImport(node, tree);
			}
		},
		MemberExpression(node): void {
			const tree = getRequiredTree(node.object);
			if (tree !== undefined) {
				reportUse(node.object, tree);
			}
		},
		VariableDeclarator(node): void {
			const tree = node.init === null ? undefined : getRequiredTree(node.init);
			if (tree !== undefined) {
				bindPattern(node, tree);
			}
		},
	} satisfies Visitor;
}
