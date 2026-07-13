import {
	getMemberPropertyName,
	getVariableByName,
	hasShadowedBinding,
	unwrapExpression,
} from "$oxc-utilities/ast-utilities";
import { isAnyFunction, isNode } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import { ROBLOX_YIELDING_MEMBERS } from "../generated/roblox-yielding-members";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

const DEFAULT_SYSTEM_TYPE_NAMES = ["PlanckSystem", "System", "SystemFunction", "SystemReturn", "SystemTableLike"];
const KEYS_TO_SKIP = new Set(["comments", "loc", "parent", "range", "tokens"]);

type ScopeVariable = ReturnType<SourceCode["getDeclaredVariables"]>[number];

interface ImportBinding {
	readonly imported: string;
	readonly source: string;
}

interface MemberChain {
	readonly path: ReadonlyArray<string>;
	readonly root: ESTree.IdentifierReference;
}

function getTypeName(typeNode: ESTree.Node, allowQualified: boolean): string | undefined {
	if (typeNode.type === "Identifier") return typeNode.name;
	if (allowQualified && typeNode.type === "TSQualifiedName") return getTypeName(typeNode.right, allowQualified);
	return undefined;
}

function getReferencedTypeName(typeNode: ESTree.Node | null | undefined, allowQualified = true): string | undefined {
	if (typeNode === null || typeNode === undefined) return undefined;
	if (typeNode.type === "TSTypeAnnotation") return getReferencedTypeName(typeNode.typeAnnotation, allowQualified);
	if (typeNode.type === "TSUnionType") {
		let referencedTypeName: string | undefined;
		for (const unionType of typeNode.types) {
			if (unionType.type === "TSUndefinedKeyword" || unionType.type === "TSNullKeyword") continue;
			const unionTypeName = getReferencedTypeName(unionType, allowQualified);
			if (unionTypeName === undefined || referencedTypeName !== undefined) return undefined;
			referencedTypeName = unionTypeName;
		}
		return referencedTypeName;
	}
	if (typeNode.type !== "TSTypeReference") return undefined;
	return getTypeName(typeNode.typeName, allowQualified);
}

function isRecognizedType(typeNode: ESTree.Node | null | undefined, systemTypeNames: ReadonlySet<string>): boolean {
	const typeName = getReferencedTypeName(typeNode);
	return typeName !== undefined && systemTypeNames.has(typeName);
}

function pushChildren(node: ESTree.Node, stack: Array<unknown>): void {
	for (const key of Object.keys(node)) {
		if (KEYS_TO_SKIP.has(key)) continue;
		const value: unknown = Reflect.get(node, key);
		if (value !== null && value !== undefined) stack.push(value);
	}
}

function forEachNode(root: ESTree.Node, visit: (node: ESTree.Node) => boolean | undefined): void {
	const stack: Array<unknown> = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined || current === null || typeof current !== "object") continue;
		if (Array.isArray(current)) {
			for (const child of current) stack.push(child);
			continue;
		}
		/* v8 ignore next -- @preserve parser object fields are arrays or AST nodes. */
		if (!isNode(current)) continue;
		if (visit(current) === false) continue;
		pushChildren(current, stack);
	}
}

function getPropertyName(property: ESTree.ObjectExpression["properties"][number]): string | undefined {
	if (property.type !== "Property") return undefined;
	if (property.computed) {
		return property.key.type === "Literal" && typeof property.key.value === "string"
			? property.key.value
			: undefined;
	}
	if (property.key.type === "Identifier") return property.key.name;
	return property.key.type === "Literal" && typeof property.key.value === "string" ? property.key.value : undefined;
}

function addSystemPropertyFunction(
	object: ESTree.ObjectExpression,
	namedFunctions: ReadonlyMap<string, CallbackFunction>,
	systemFunctions: Set<CallbackFunction>,
): void {
	for (const property of object.properties) {
		if (getPropertyName(property) !== "system" || property.type !== "Property") continue;
		if (isAnyFunction(property.value)) systemFunctions.add(property.value);
		else if (property.value.type === "Identifier") {
			const systemFunction = namedFunctions.get(property.value.name);
			if (systemFunction !== undefined) systemFunctions.add(systemFunction);
		}
	}
}

function getImportedName(specifier: ESTree.ImportDeclaration["specifiers"][number]): string | undefined {
	if (specifier.type !== "ImportSpecifier") return undefined;
	return specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
}

function collectImportBindings(
	program: ESTree.Program,
	sourceCode: SourceCode,
): ReadonlyMap<ScopeVariable, ImportBinding> {
	const bindings = new Map<ScopeVariable, ImportBinding>();
	for (const statement of program.body) {
		if (statement.type !== "ImportDeclaration" || typeof statement.source.value !== "string") continue;
		const variables = sourceCode.getDeclaredVariables(statement);
		for (const specifier of statement.specifiers) {
			const imported = getImportedName(specifier);
			if (imported === undefined) continue;
			const variable = variables.find((candidate) => candidate.name === specifier.local.name);
			/* v8 ignore else -- @preserve each import specifier declares its local binding. */
			if (variable !== undefined) bindings.set(variable, { imported, source: statement.source.value });
		}
	}
	return bindings;
}

function getMemberChain(expression: ESTree.Expression): MemberChain | undefined {
	const path = new Array<string>();
	let current = unwrapExpression(expression);
	while (current.type === "MemberExpression") {
		const propertyName = getMemberPropertyName(current);
		if (propertyName === undefined) return undefined;
		path.unshift(propertyName);
		current = unwrapExpression(current.object);
	}
	return current.type === "Identifier" ? { path, root: current } : undefined;
}

function pathsEqual(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
	return left.length === right.length && left.every((part, index) => part === right[index]);
}

function getIdentifierVariable(
	sourceCode: SourceCode,
	identifier: ESTree.IdentifierReference,
): ScopeVariable | undefined {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name);
}

function collectConfiguredCallbackTypes(
	program: ESTree.Program,
	sourceCode: SourceCode,
	imports: ReadonlyMap<ScopeVariable, ImportBinding>,
	configurations: ReadonlyArray<{
		readonly callbackArgumentIndex: number;
		readonly className: string;
		readonly imported: string;
		readonly memberPath: ReadonlyArray<string>;
		readonly parameterIndex: number;
		readonly source: string;
	}>,
	types: Map<ScopeVariable, string>,
): void {
	forEachNode(program, (node) => {
		if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") return;
		const chain = getMemberChain(node.callee);
		if (chain === undefined) return;
		const rootVariable = getIdentifierVariable(sourceCode, chain.root);
		const binding = rootVariable === undefined ? undefined : imports.get(rootVariable);
		if (binding === undefined) return;

		for (const configuration of configurations) {
			if (
				binding.source !== configuration.source ||
				binding.imported !== configuration.imported ||
				!pathsEqual(chain.path, configuration.memberPath)
			) {
				continue;
			}
			const callback = node.arguments[configuration.callbackArgumentIndex];
			if (callback === undefined || callback.type === "SpreadElement" || !isAnyFunction(callback)) continue;
			const parameter = callback.params[configuration.parameterIndex];
			if (parameter?.type !== "Identifier") continue;
			const variable = getIdentifierVariable(sourceCode, parameter);
			/* v8 ignore else -- @preserve function parameter identifiers always resolve to their declared variable. */
			if (variable !== undefined) types.set(variable, configuration.className);
		}
	});
}

function collectAnnotatedTypes(
	program: ESTree.Program,
	sourceCode: SourceCode,
	declaredTypeNames: ReadonlySet<string>,
	types: Map<ScopeVariable, string>,
): void {
	forEachNode(program, (node) => {
		if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
			const identifierName = node.id.name;
			const className = getReferencedTypeName(node.id.typeAnnotation, false);
			if (className === undefined || declaredTypeNames.has(className)) return;
			const variable = sourceCode
				.getDeclaredVariables(node)
				.find((candidate) => candidate.name === identifierName);
			/* v8 ignore else -- @preserve identifier variable declarations always expose their declared variable. */
			if (variable !== undefined) types.set(variable, className);
			return;
		}
		if (!isAnyFunction(node)) return;
		const variables = sourceCode.getDeclaredVariables(node);
		for (const parameter of node.params) {
			if (parameter.type !== "Identifier") continue;
			const parameterName = parameter.name;
			const className = getReferencedTypeName(parameter.typeAnnotation, false);
			if (className === undefined || declaredTypeNames.has(className)) continue;
			const variable = variables.find((candidate) => candidate.name === parameterName);
			/* v8 ignore else -- @preserve identifier parameters always appear in their function's declared variables. */
			if (variable !== undefined) types.set(variable, className);
		}
	});
}

function collectDeclaredTypeNames(program: ESTree.Program): ReadonlySet<string> {
	const names = new Set<string>();
	forEachNode(program, (node) => {
		if (node.type === "ImportDeclaration") {
			for (const specifier of node.specifiers) names.add(specifier.local.name);
			return false;
		}
		if (
			(node.type === "TSInterfaceDeclaration" ||
				node.type === "TSTypeAliasDeclaration" ||
				node.type === "ClassDeclaration" ||
				node.type === "TSEnumDeclaration") &&
			node.id !== null
		) {
			names.add(node.id.name);
		}
		return true;
	});
	return names;
}

function getConstInitializer(
	identifier: ESTree.IdentifierReference,
	sourceCode: SourceCode,
): ESTree.Expression | undefined {
	const variable = getIdentifierVariable(sourceCode, identifier);
	if (variable?.defs.length !== 1) return undefined;
	const [definition] = variable.defs;
	if (definition?.node.type !== "VariableDeclarator") return undefined;
	const declaration = definition.node.parent;
	/* v8 ignore next -- @preserve variable declarator definitions always have variable declaration parents. */
	if (declaration.type !== "VariableDeclaration" || declaration.kind !== "const") return undefined;
	/* v8 ignore next -- @preserve a referenced variable declarator definition always has an initializer. */
	return definition.node.init ?? undefined;
}

function getExpressionClass(
	expression: ESTree.Expression,
	sourceCode: SourceCode,
	imports: ReadonlyMap<ScopeVariable, ImportBinding>,
	types: ReadonlyMap<ScopeVariable, string>,
	visited: Set<ESTree.Expression>,
): string | undefined {
	const current = unwrapExpression(expression);
	if (current.type === "Identifier") return getIdentifierClass(current, sourceCode, imports, types, visited);
	if (
		!(
			current.type === "CallExpression" &&
			current.callee.type === "MemberExpression" &&
			getMemberPropertyName(current.callee) === "GetService" &&
			current.callee.object.type === "Identifier" &&
			current.callee.object.name === "game" &&
			!hasShadowedBinding(sourceCode, current.callee.object, "game")
		)
	) {
		return undefined;
	}
	const [serviceName] = current.arguments;
	return serviceName?.type === "Literal" && typeof serviceName.value === "string" ? serviceName.value : undefined;
}

function getIdentifierClass(
	identifier: ESTree.IdentifierReference,
	sourceCode: SourceCode,
	imports: ReadonlyMap<ScopeVariable, ImportBinding>,
	types: ReadonlyMap<ScopeVariable, string>,
	visited: Set<ESTree.Expression>,
): string | undefined {
	const variable = getIdentifierVariable(sourceCode, identifier);
	if (variable !== undefined) {
		const annotatedType = types.get(variable);
		if (annotatedType !== undefined) return annotatedType;
		const binding = imports.get(variable);
		if (binding?.source === "@rbxts/services") return binding.imported;
	}
	const initializer = getConstInitializer(identifier, sourceCode);
	if (initializer === undefined || visited.has(initializer)) return undefined;
	visited.add(initializer);
	return getExpressionClass(initializer, sourceCode, imports, types, visited);
}

function classHasYieldingMember(className: string, memberName: string): boolean {
	if (!Object.hasOwn(ROBLOX_YIELDING_MEMBERS, className)) return false;
	const members: unknown = Reflect.get(ROBLOX_YIELDING_MEMBERS, className);
	return Array.isArray(members) && members.includes(memberName);
}

function isRobloxYieldingCall(
	node: ESTree.CallExpression,
	sourceCode: SourceCode,
	imports: ReadonlyMap<ScopeVariable, ImportBinding>,
	types: ReadonlyMap<ScopeVariable, string>,
): boolean {
	if (node.callee.type !== "MemberExpression") return false;
	const memberName = getMemberPropertyName(node.callee);
	if (memberName === undefined) return false;
	const className = getExpressionClass(node.callee.object, sourceCode, imports, types, new Set());
	return className !== undefined && classHasYieldingMember(className, memberName);
}

function reportYieldingCalls(
	systemFunction: CallbackFunction,
	sourceCode: SourceCode,
	imports: ReadonlyMap<ScopeVariable, ImportBinding>,
	types: ReadonlyMap<ScopeVariable, string>,
	report: (node: ESTree.CallExpression) => void,
): void {
	if (systemFunction.async || systemFunction.body === null) return;
	forEachNode(systemFunction.body, (node) => {
		if (isAnyFunction(node) && node !== systemFunction && node.async) return false;
		if (node.type === "CallExpression" && isRobloxYieldingCall(node, sourceCode, imports, types)) report(node);
		return true;
	});
}

const noAsyncInSystem = defineRule({
	create(context): Visitor {
		const additionalSystemTypeNames = context.options[0]?.additionalSystemTypeNames ?? [];
		const callbackParameterTypes = context.options[0]?.callbackParameterTypes ?? [];
		const systemTypeNames = new Set([...DEFAULT_SYSTEM_TYPE_NAMES, ...additionalSystemTypeNames]);

		return {
			"Program:exit"(program): void {
				const namedFunctions = new Map<string, CallbackFunction>();
				const systemFunctions = new Set<CallbackFunction>();
				const typedSystemObjects = new Array<ESTree.ObjectExpression>();
				const imports = collectImportBindings(program, context.sourceCode);
				const receiverTypes = new Map<ScopeVariable, string>();
				collectAnnotatedTypes(program, context.sourceCode, collectDeclaredTypeNames(program), receiverTypes);
				collectConfiguredCallbackTypes(
					program,
					context.sourceCode,
					imports,
					callbackParameterTypes,
					receiverTypes,
				);

				forEachNode(program, (node) => {
					if (isAnyFunction(node)) {
						if (node.id !== null) namedFunctions.set(node.id.name, node);
						if (isRecognizedType(node.returnType, systemTypeNames)) systemFunctions.add(node);
						return;
					}
					if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
						if (!isRecognizedType(node.id.typeAnnotation, systemTypeNames) || node.init === null) return;
						if (isAnyFunction(node.init)) systemFunctions.add(node.init);
						else if (node.init.type === "ObjectExpression") typedSystemObjects.push(node.init);
						return;
					}
					if (
						node.type === "TSSatisfiesExpression" &&
						isRecognizedType(node.typeAnnotation, systemTypeNames) &&
						node.expression.type === "ObjectExpression"
					) {
						typedSystemObjects.push(node.expression);
					}
				});

				for (const object of typedSystemObjects) {
					addSystemPropertyFunction(object, namedFunctions, systemFunctions);
				}
				for (const systemFunction of systemFunctions) {
					reportYieldingCalls(systemFunction, context.sourceCode, imports, receiverTypes, (node) => {
						context.report({ messageId: "noAsyncInSystem", node });
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow yielding Roblox API calls in synchronous Planck system execution.",
			recommended: true,
		},
		messages: {
			noAsyncInSystem: "Do not call a yielding Roblox API from a synchronous Planck system.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					additionalSystemTypeNames: {
						items: { type: "string" },
						type: "array",
						uniqueItems: true,
					},
					callbackParameterTypes: {
						items: {
							additionalProperties: false,
							properties: {
								callbackArgumentIndex: { minimum: 0, type: "integer" },
								className: { type: "string" },
								imported: { type: "string" },
								memberPath: { items: { type: "string" }, type: "array" },
								parameterIndex: { minimum: 0, type: "integer" },
								source: { type: "string" },
							},
							required: [
								"callbackArgumentIndex",
								"className",
								"imported",
								"memberPath",
								"parameterIndex",
								"source",
							],
							type: "object",
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noAsyncInSystem;
