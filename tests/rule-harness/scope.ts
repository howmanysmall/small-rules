// oxlint-disable sonar/cognitive-complexity unicorn/no-null -- Scope construction is a compact AST dispatcher that mirrors eslint-scope null sentinels.
import { getNodeChildren } from "./ast";

import type {
	HarnessDefinition,
	HarnessNode,
	HarnessReference,
	HarnessScope,
	HarnessVariable,
	ScopeManager,
} from "./types";

const IMPLICIT_GLOBAL_NAMES: ReadonlyArray<string> = ["Error"];

export function buildScopeManager(program: HarnessNode): ScopeManager {
	const rootScope = createScope(program.sourceType === "script" ? "global" : "module", null, program);
	for (const name of IMPLICIT_GLOBAL_NAMES) defineImplicitVariable(rootScope, name);
	const state: ScopeState = {
		declaredVariables: new WeakMap(),
		nodeToScope: new WeakMap(),
		rootScope,
	};
	visitNode(program, rootScope, state);
	resolveReferences(rootScope);
	return {
		declaredVariables: state.declaredVariables,
		globalScope: rootScope,
		nodeToScope: state.nodeToScope,
	};
}

interface ScopeState {
	declaredVariables: WeakMap<object, Array<HarnessVariable>>;
	nodeToScope: WeakMap<object, HarnessScope>;
	rootScope: HarnessScope;
}

function createScope(type: string, upper: HarnessScope | null, block: HarnessNode): HarnessScope {
	const scope: HarnessScope = {
		block,
		childScopes: [],
		references: [],
		set: new Map(),
		through: [],
		type,
		upper,
		variables: [],
	};
	if (upper !== null) upper.childScopes.push(scope);
	return scope;
}

function visitNode(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	state.nodeToScope.set(node, scope);

	switch (node.type) {
		case "Program": {
			visitChildren(node, scope, state);
			return;
		}

		case "ImportDeclaration": {
			defineImportSpecifiers(node, scope, state);
			return;
		}

		case "FunctionDeclaration": {
			defineFunctionDeclaration(node, scope, state);
			return;
		}

		case "FunctionExpression":
		case "ArrowFunctionExpression": {
			visitFunctionLike(node, scope, state);
			return;
		}

		case "ClassDeclaration": {
			defineClassDeclaration(node, scope, state);
			visitClassLike(node, scope, state);
			visitChildren(node, state.nodeToScope.get(node) ?? scope, state);
			return;
		}

		case "ClassExpression": {
			visitClassLike(node, scope, state);
			visitChildren(node, state.nodeToScope.get(node) ?? scope, state);
			return;
		}

		case "TSEnumDeclaration": {
			defineTSEnumDeclaration(node, scope, state);
			visitChildren(node, scope, state);
			return;
		}

		case "TSInterfaceDeclaration":
		case "TSTypeAliasDeclaration": {
			defineTypeDeclaration(node, scope, state);
			visitChildren(node, scope, state);
			return;
		}

		case "VariableDeclaration": {
			defineVariableDeclaration(node, scope, state);
			visitVariableDeclarationChildren(node, scope, state);
			return;
		}

		case "BlockStatement":
		case "StaticBlock":
		case "SwitchStatement":
		case "TSModuleBlock": {
			const blockScope = shouldReuseParentFunctionScope(node) ? scope : createScope("block", scope, node);
			state.nodeToScope.set(node, blockScope);
			visitChildren(node, blockScope, state);
			return;
		}

		case "CatchClause": {
			const blockScope = createScope("block", scope, node);
			state.nodeToScope.set(node, blockScope);
			const parameter = getNodeProperty(node, "param");
			if (parameter !== undefined) definePattern(parameter, blockScope, "CatchClause", node, state);
			visitChildren(node, blockScope, state);
			return;
		}

		case "Identifier": {
			if (isReferenceIdentifier(node)) addReference(node, scope, readModeForIdentifier(node));
			return;
		}

		default: {
			visitChildren(node, scope, state);
		}
	}
}

function visitChildren(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	for (const child of getNodeChildren(node)) visitNode(child, scope, state);
}

function shouldReuseParentFunctionScope(node: HarnessNode): boolean {
	const { parent } = node;
	if (parent === null || parent === undefined) return false;
	return (
		(parent.type === "FunctionDeclaration" ||
			parent.type === "FunctionExpression" ||
			parent.type === "ArrowFunctionExpression") &&
		parent.body === node
	);
}

function defineImportSpecifiers(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	const specifiers = getNodeArrayProperty(node, "specifiers");
	for (const specifier of specifiers) {
		const local = getNodeProperty(specifier, "local");
		if (local === undefined || typeof local.name !== "string") continue;
		defineVariable(scope, local.name, local, {
			name: local,
			node: specifier,
			parent: node,
			type: "ImportBinding",
		});
		registerDeclaredVariable(state, node, scope.set.get(local.name));
	}
}

function defineFunctionDeclaration(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	const id = getNodeProperty(node, "id");
	if (id !== undefined && typeof id.name === "string") {
		const variable = defineVariable(scope, id.name, id, {
			name: id,
			node,
			parent: node.parent ?? null,
			type: "FunctionName",
		});
		registerDeclaredVariable(state, node, variable);
	}

	visitFunctionLike(node, scope, state);
}

function defineClassDeclaration(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	const id = getNodeProperty(node, "id");
	if (id === undefined || typeof id.name !== "string") return;
	const variable = defineVariable(scope, id.name, id, {
		name: id,
		node,
		parent: node.parent ?? null,
		type: "ClassName",
	});
	registerDeclaredVariable(state, node, variable);
}

function visitClassLike(node: HarnessNode, parentScope: HarnessScope, state: ScopeState): void {
	const classScope = createScope("class", parentScope, node);
	state.nodeToScope.set(node, classScope);
	const id = getNodeProperty(node, "id");
	if (id !== undefined && typeof id.name === "string") {
		defineVariable(classScope, id.name, id, {
			name: id,
			node,
			parent: node.parent ?? null,
			type: "ClassName",
		});
	}
}

function defineTSEnumDeclaration(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	const id = getNodeProperty(node, "id");
	if (id === undefined || typeof id.name !== "string") return;
	const variable = defineVariable(scope, id.name, id, {
		name: id,
		node,
		parent: node.parent ?? null,
		type: "TSEnumName",
	});
	registerDeclaredVariable(state, node, variable);
}

function defineTypeDeclaration(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	const id = getNodeProperty(node, "id");
	if (id === undefined || typeof id.name !== "string") return;
	const variable = defineVariable(scope, id.name, id, {
		name: id,
		node,
		parent: node.parent ?? null,
		type: "TypeName",
	});
	registerDeclaredVariable(state, node, variable);
}

function visitFunctionLike(node: HarnessNode, parentScope: HarnessScope, state: ScopeState): void {
	const functionScope = createScope("function", parentScope, node);
	state.nodeToScope.set(node, functionScope);

	const id = getNodeProperty(node, "id");
	if (node.type === "FunctionExpression" && id !== undefined && typeof id.name === "string") {
		defineVariable(functionScope, id.name, id, {
			name: id,
			node,
			parent: node.parent ?? null,
			type: "FunctionName",
		});
	}

	for (const parameter of getNodeArrayProperty(node, "params")) {
		definePattern(parameter, functionScope, "Parameter", node, state);
	}

	const body = getNodeProperty(node, "body");
	if (body !== undefined) visitNode(body, functionScope, state);
}

function defineVariableDeclaration(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	const targetScope = node.kind === "var" ? getVariableScope(scope) : scope;
	for (const declarator of getNodeArrayProperty(node, "declarations")) {
		const id = getNodeProperty(declarator, "id");
		if (id !== undefined) definePattern(id, targetScope, "Variable", declarator, state);
	}
}

function visitVariableDeclarationChildren(node: HarnessNode, scope: HarnessScope, state: ScopeState): void {
	for (const declarator of getNodeArrayProperty(node, "declarations")) {
		state.nodeToScope.set(declarator, scope);
		const init = getNodeProperty(declarator, "init");
		if (init !== undefined) visitNode(init, scope, state);
	}
}

function definePattern(
	pattern: HarnessNode,
	scope: HarnessScope,
	type: string,
	definitionNode: HarnessNode,
	state: ScopeState,
): void {
	switch (pattern.type) {
		case "Identifier": {
			if (typeof pattern.name !== "string") return;
			const variable = defineVariable(scope, pattern.name, pattern, {
				name: pattern,
				node: definitionNode,
				parent: definitionNode.parent ?? null,
				type,
			});
			registerDeclaredVariable(state, definitionNode, variable);
			return;
		}

		case "AssignmentPattern": {
			const left = getNodeProperty(pattern, "left");
			const right = getNodeProperty(pattern, "right");
			if (left !== undefined) definePattern(left, scope, type, definitionNode, state);
			if (right !== undefined) visitNode(right, scope, state);
			return;
		}

		case "RestElement": {
			const argument = getNodeProperty(pattern, "argument");
			if (argument !== undefined) definePattern(argument, scope, type, definitionNode, state);
			return;
		}

		case "ArrayPattern": {
			for (const element of getNodeArrayProperty(pattern, "elements")) {
				definePattern(element, scope, type, definitionNode, state);
			}
			return;
		}

		case "ObjectPattern": {
			for (const property of getNodeArrayProperty(pattern, "properties")) {
				if (property.type === "RestElement") {
					const argument = getNodeProperty(property, "argument");
					if (argument !== undefined) definePattern(argument, scope, type, definitionNode, state);
					continue;
				}
				const value = getNodeProperty(property, "value");
				if (value !== undefined) definePattern(value, scope, type, definitionNode, state);
			}
		}
	}
}

function defineVariable(
	scope: HarnessScope,
	name: string,
	identifier: HarnessNode,
	definition: HarnessDefinition,
): HarnessVariable {
	const existing = scope.set.get(name);
	if (existing !== undefined) {
		existing.identifiers.push(identifier);
		existing.defs.push(definition);
		return existing;
	}

	const variable: HarnessVariable = {
		defs: [definition],
		identifiers: [identifier],
		name,
		references: [],
		scope,
	};
	scope.variables.push(variable);
	scope.set.set(name, variable);
	return variable;
}

function defineImplicitVariable(scope: HarnessScope, name: string): void {
	if (scope.set.has(name)) return;
	const variable: HarnessVariable = {
		defs: [],
		identifiers: [],
		name,
		references: [],
		scope,
	};
	scope.variables.push(variable);
	scope.set.set(name, variable);
}

function registerDeclaredVariable(state: ScopeState, node: HarnessNode, variable: HarnessVariable | undefined): void {
	if (variable === undefined) return;
	const existing = state.declaredVariables.get(node);
	if (existing === undefined) {
		state.declaredVariables.set(node, [variable]);
		return;
	}
	if (!existing.includes(variable)) existing.push(variable);
}

function getVariableScope(scope: HarnessScope): HarnessScope {
	let current: HarnessScope = scope;
	while (
		current.upper !== null &&
		current.type !== "function" &&
		current.type !== "module" &&
		current.type !== "global"
	) {
		current = current.upper;
	}
	return current;
}

function addReference(node: HarnessNode, scope: HarnessScope, mode: ReferenceMode): void {
	const reference: HarnessReference = {
		from: scope,
		identifier: node,
		isRead(): boolean {
			return mode !== "write";
		},
		isReadOnly(): boolean {
			return mode === "read";
		},
		isReadWrite(): boolean {
			return mode === "readwrite";
		},
		isWrite(): boolean {
			return mode !== "read";
		},
		isWriteOnly(): boolean {
			return mode === "write";
		},
	};
	scope.references.push(reference);
}

type ReferenceMode = "read" | "readwrite" | "write";

function readModeForIdentifier(node: HarnessNode): ReferenceMode {
	const { parent } = node;
	if (parent?.type === "AssignmentExpression" && parent.left === node) {
		return parent.operator === "=" ? "write" : "readwrite";
	}
	if (parent?.type === "UpdateExpression" && parent.argument === node) return "readwrite";
	return "read";
}

function resolveReferences(scope: HarnessScope): void {
	for (const reference of scope.references) {
		const variable = getVariableByName(scope, getIdentifierName(reference.identifier));
		if (variable === undefined) {
			scope.through.push(reference);
			continue;
		}
		reference.resolved = variable;
		variable.references.push(reference);
	}

	for (const child of scope.childScopes) resolveReferences(child);
}

function getVariableByName(scope: HarnessScope, name: string | undefined): HarnessVariable | undefined {
	if (name === undefined) return undefined;
	let current: HarnessScope | null = scope;
	while (current !== null) {
		const variable = current.set.get(name);
		if (variable !== undefined) return variable;
		current = current.upper;
	}
	return undefined;
}

function getIdentifierName(node: HarnessNode): string | undefined {
	return typeof node.name === "string" ? node.name : undefined;
}

function isReferenceIdentifier(node: HarnessNode): boolean {
	const { parent } = node;
	if (parent === null || parent === undefined) return true;

	if (isBindingIdentifier(node, parent)) return false;
	if (parent.type === "MemberExpression" && parent.property === node && parent.computed !== true) return false;
	if (
		parent.type === "Property" &&
		parent.key === node &&
		parent.computed !== true &&
		(parent.shorthand !== true || parent.value !== node)
	) {
		return false;
	}
	if (parent.type === "MethodDefinition" && parent.key === node && parent.computed !== true) return false;
	if (parent.type === "PropertyDefinition" && parent.key === node && parent.computed !== true) return false;
	if (parent.type === "TSPropertySignature" && parent.key === node && parent.computed !== true) return false;
	if (parent.type === "TSEnumMember" && parent.id === node) return false;
	if (parent.type === "BreakStatement" || parent.type === "ContinueStatement" || parent.type === "LabeledStatement") {
		return false;
	}
	if (parent.type === "ImportSpecifier" && parent.imported === node) return false;
	if (parent.type === "ExportSpecifier" && parent.exported === node) return false;

	return true;
}

function isBindingIdentifier(node: HarnessNode, parent: HarnessNode): boolean {
	if (parent.type === "VariableDeclarator" && isInPattern(node, getNodeProperty(parent, "id"))) return true;
	if (isFunctionLike(parent) && isParameterIdentifier(node, parent)) return true;
	if ((parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression") && parent.id === node) {
		return true;
	}
	if ((parent.type === "ClassDeclaration" || parent.type === "ClassExpression") && parent.id === node) return true;
	if (parent.type === "ImportDefaultSpecifier" && parent.local === node) return true;
	if (parent.type === "ImportNamespaceSpecifier" && parent.local === node) return true;
	if (parent.type === "ImportSpecifier" && parent.local === node) return true;
	if (parent.type === "CatchClause" && isInPattern(node, getNodeProperty(parent, "param"))) return true;
	if (parent.type === "TSTypeAliasDeclaration" && parent.id === node) return true;
	if (parent.type === "TSInterfaceDeclaration" && parent.id === node) return true;
	if (parent.type === "TSEnumDeclaration" && parent.id === node) return true;
	return false;
}

function isFunctionLike(node: HarnessNode): boolean {
	return (
		node.type === "FunctionDeclaration" ||
		node.type === "FunctionExpression" ||
		node.type === "ArrowFunctionExpression"
	);
}

function isParameterIdentifier(node: HarnessNode, parent: HarnessNode): boolean {
	for (const parameter of getNodeArrayProperty(parent, "params")) {
		if (isInPattern(node, parameter)) return true;
	}
	return false;
}

function isInPattern(target: HarnessNode, pattern: HarnessNode | undefined): boolean {
	if (pattern === undefined) return false;
	if (target === pattern) return true;
	return getNodeChildren(pattern).some((child) => isInPattern(target, child));
}

function getNodeProperty(node: HarnessNode, key: string): HarnessNode | undefined {
	const value = node[key];
	return isNode(value) ? value : undefined;
}

function getNodeArrayProperty(node: HarnessNode, key: string): Array<HarnessNode> {
	const value = node[key];
	if (!Array.isArray(value)) return [];
	return value.filter(isNode);
}

function isNode(value: unknown): value is HarnessNode {
	return typeof value === "object" && value !== null && "type" in value && "range" in value && "loc" in value;
}
