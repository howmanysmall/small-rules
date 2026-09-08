// Vendored from src/shared/type-alias-resolution.ts@e8c4880471b23ab7f216fba7b27d173a6ef07d4c by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: uses iterative worklists and opaque captured-resolution
// frames; shares the no-cast visitor child appender; resolves aliases and
// interfaces through one lexical binding index; uses undefined for absence;
// caches by Program and visitor-key identity; keeps class-expression bindings
// class-local; merges exported and ambient identifier namespaces; separates
// module and global namespace trees with a lower-priority global fallback; keys
// private namespaces by concrete parent block; recognizes import-equals and
// module competitors; and isolates concrete string-literal module blocks.

import { appendVisitorChildren, lexicalTypeParameterNames } from "$oxc-utilities/anti-slop/lexical-type-parameters";
import {
	isBlockStatement,
	isClassDeclaration,
	isClassExpression,
	isExportNamedDeclaration,
	isIdentifierName,
	isImportDefaultSpecifier,
	isImportNamespaceSpecifier,
	isImportSpecifier,
	isNode,
	isProgram,
	isStaticBlock,
	isSwitchStatement,
	isTsEnumDeclaration,
	isTsGlobalDeclaration,
	isTsImportEqualsDeclaration,
	isTsInterfaceDeclaration,
	isTsModuleBlock,
	isTsModuleDeclaration,
	isTsQualifiedName,
	isTsTypeAliasDeclaration,
	isTsTypeReference,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

interface NamespaceScopeKey {
	readonly blocks: Set<ESTree.TSModuleBlock>;
	readonly children: Map<string, NamespaceScopeKey>;
	readonly programFallback: boolean;
}

type TypeBindingScope = ESTree.Node | NamespaceScopeKey;

interface TypeBinding {
	readonly name: string;
	readonly alias: ESTree.TSTypeAliasDeclaration | undefined;
	readonly interface: ESTree.TSInterfaceDeclaration | undefined;
	readonly scope: TypeBindingScope;
}

interface DeclaredTypeBinding {
	readonly name: string;
	readonly alias: ESTree.TSTypeAliasDeclaration | undefined;
	readonly interface: ESTree.TSInterfaceDeclaration | undefined;
}

interface Substitution {
	readonly environment: SubstitutionEnvironment;
	readonly resolving: ReadonlySet<ESTree.TSTypeAliasDeclaration>;
	readonly type: ESTree.TSType;
}

interface SubstitutionEnvironment {
	readonly owner: ESTree.TSTypeAliasDeclaration | undefined;
	readonly parameters: ReadonlyMap<string, Substitution>;
}

const resolutionContext = Symbol("TypeResolution");

interface ResolutionContext {
	readonly environment: SubstitutionEnvironment;
	readonly resolving: ReadonlySet<ESTree.TSTypeAliasDeclaration>;
}

/** A type plus opaque captured alias-resolution context. */
export interface TypeResolution {
	readonly [resolutionContext]: ResolutionContext;
	readonly type: ESTree.TSType;
}

interface NamespaceScopes {
	readonly ambientBlocks: WeakSet<ESTree.TSModuleBlock>;
	readonly byBlock: WeakMap<ESTree.TSModuleBlock, NamespaceScopeKey>;
	readonly global: NamespaceScopeKey;
	readonly privateRoots: WeakMap<ESTree.TSModuleBlock, NamespaceScopeKey>;
	readonly root: NamespaceScopeKey;
}

/** Immutable lexical type-binding facts collected for one program. */
export interface TypeAliasEnvironment {
	readonly aliases: ReadonlyArray<ESTree.TSTypeAliasDeclaration>;
	readonly bindingsByName: ReadonlyMap<string, ReadonlyArray<TypeBinding>>;
	readonly visitorKeys: SourceCode["visitorKeys"];
}

/** Matches a resolved type and may enqueue child types for later matching. */
export type ResolvedTypeMatcher = (resolved: ESTree.TSType, enqueue: (child: ESTree.TSType) => void) => boolean;

const environmentsByProgram = new WeakMap<ESTree.Program, WeakMap<SourceCode["visitorKeys"], TypeAliasEnvironment>>();

const EMPTY_SUBSTITUTION_ENVIRONMENT: SubstitutionEnvironment = {
	owner: undefined,
	parameters: new Map(),
};

function isTypeScope(node: ESTree.Node): boolean {
	return (
		isProgram(node) ||
		isBlockStatement(node) ||
		isTsModuleBlock(node) ||
		isStaticBlock(node) ||
		isSwitchStatement(node)
	);
}

function enclosingTypeScope(node: ESTree.Node, program: ESTree.Program): ESTree.Node {
	let current: ESTree.Node | null = node.parent;
	while (current !== null && current !== program) {
		if (isTypeScope(current)) return current;
		current = current.parent;
	}
	return program;
}

function createNamespaceScopeKey(programFallback: boolean): NamespaceScopeKey {
	return { blocks: new Set(), children: new Map(), programFallback };
}

function moduleBindingName(module: ESTree.TSModuleDeclaration): string | undefined {
	let current: ESTree.Node = module.id;
	while (isTsQualifiedName(current)) current = current.left;
	return isIdentifierName(current) ? current.name : undefined;
}

function namespaceNameParts(module: ESTree.TSModuleDeclaration): ReadonlyArray<string> | undefined {
	const reversed = new Array<string>();
	let current: ESTree.Node = module.id;
	while (isTsQualifiedName(current)) {
		reversed.push(current.right.name);
		current = current.left;
	}
	if (!isIdentifierName(current)) return undefined;
	reversed.push(current.name);
	return reversed.toReversed();
}

function childNamespaceScope(parent: NamespaceScopeKey, name: string): NamespaceScopeKey {
	const existing = parent.children.get(name);
	if (existing !== undefined) return existing;
	const created = createNamespaceScopeKey(false);
	parent.children.set(name, created);
	return created;
}

function privateNamespaceRoot(block: ESTree.TSModuleBlock, scopes: NamespaceScopes): NamespaceScopeKey {
	const existing = scopes.privateRoots.get(block);
	if (existing !== undefined) return existing;
	const created = createNamespaceScopeKey(false);
	scopes.privateRoots.set(block, created);
	return created;
}

function namespaceScopeBase(
	module: ESTree.TSModuleDeclaration,
	lexicalScope: ESTree.Node,
	scopes: NamespaceScopes,
): NamespaceScopeKey {
	if (!isTsModuleBlock(lexicalScope)) return scopes.root;
	const parent = scopes.byBlock.get(lexicalScope);
	if (parent === undefined) return privateNamespaceRoot(lexicalScope, scopes);
	if (isExportNamedDeclaration(module.parent) || scopes.ambientBlocks.has(lexicalScope)) return parent;
	return privateNamespaceRoot(lexicalScope, scopes);
}

function registerGlobalScope({ body }: ESTree.TSGlobalDeclaration, scopes: NamespaceScopes): void {
	scopes.global.blocks.add(body);
	scopes.byBlock.set(body, scopes.global);
	scopes.ambientBlocks.add(body);
}

function registerNamespaceScope(
	module: ESTree.TSModuleDeclaration,
	lexicalScope: ESTree.Node,
	scopes: NamespaceScopes,
): void {
	const names = namespaceNameParts(module);
	const body: unknown = module.body;
	if (!isNode(body) || !isTsModuleBlock(body)) return;
	if (module.declare || (isTsModuleBlock(lexicalScope) && scopes.ambientBlocks.has(lexicalScope))) {
		scopes.ambientBlocks.add(body);
	}
	if (names === undefined) return;
	let scope = namespaceScopeBase(module, lexicalScope, scopes);
	for (const name of names) scope = childNamespaceScope(scope, name);
	scope.blocks.add(body);
	scopes.byBlock.set(body, scope);
}

function bindingScope({ parent }: ESTree.Node, lexicalScope: ESTree.Node, scopes: NamespaceScopes): TypeBindingScope {
	if (!isTsModuleBlock(lexicalScope)) return lexicalScope;
	const namespaceScope = scopes.byBlock.get(lexicalScope);
	if (namespaceScope === undefined) return lexicalScope;
	if ((parent !== null && isExportNamedDeclaration(parent)) || scopes.ambientBlocks.has(lexicalScope)) {
		return namespaceScope;
	}
	return lexicalScope;
}

function declaredTypeBinding(node: ESTree.Node): DeclaredTypeBinding | undefined {
	if (isTsTypeAliasDeclaration(node)) return { name: node.id.name, alias: node, interface: undefined };
	if (isTsInterfaceDeclaration(node)) return { name: node.id.name, alias: undefined, interface: node };
	if (isTsEnumDeclaration(node) || isClassDeclaration(node) || isClassExpression(node)) {
		return node.id === null ? undefined : { name: node.id.name, alias: undefined, interface: undefined };
	}
	if (isImportSpecifier(node) || isImportDefaultSpecifier(node) || isImportNamespaceSpecifier(node)) {
		return { name: node.local.name, alias: undefined, interface: undefined };
	}
	if (isTsImportEqualsDeclaration(node)) return { name: node.id.name, alias: undefined, interface: undefined };
	if (isTsModuleDeclaration(node)) {
		const name = moduleBindingName(node);
		return name === undefined ? undefined : { name, alias: undefined, interface: undefined };
	}
	return undefined;
}

function collectTypeBindings(
	program: ESTree.Program,
	visitorKeys: SourceCode["visitorKeys"],
	bindingsByName: Map<string, Array<TypeBinding>>,
	aliases: Array<ESTree.TSTypeAliasDeclaration>,
): void {
	const scopes: NamespaceScopes = {
		ambientBlocks: new WeakSet(),
		byBlock: new WeakMap(),
		global: createNamespaceScopeKey(true),
		privateRoots: new WeakMap(),
		root: createNamespaceScopeKey(false),
	};
	const pending: Array<ESTree.Node> = [program];
	for (const node of pending) {
		const lexicalScope = enclosingTypeScope(node, program);
		if (isTsGlobalDeclaration(node)) registerGlobalScope(node, scopes);
		if (isTsModuleDeclaration(node)) registerNamespaceScope(node, lexicalScope, scopes);
		const declared = declaredTypeBinding(node);
		if (declared !== undefined) {
			const bindings = bindingsByName.get(declared.name) ?? [];
			const scope = isClassExpression(node) ? node : bindingScope(node, lexicalScope, scopes);
			bindings.push({ name: declared.name, alias: declared.alias, interface: declared.interface, scope });
			bindingsByName.set(declared.name, bindings);
			if (declared.alias !== undefined) aliases.push(declared.alias);
		}
		appendVisitorChildren(node, visitorKeys, pending);
	}
}

function isNamespaceScopeKey(scope: TypeBindingScope): scope is NamespaceScopeKey {
	return "blocks" in scope;
}

function scopeDistance(scope: TypeBindingScope, node: ESTree.Node): number | undefined {
	let current: ESTree.Node | null = node;
	let distance = 0;
	while (current !== null) {
		if (isNamespaceScopeKey(scope)) {
			if (isTsModuleBlock(current) && scope.blocks.has(current)) return distance;
			if (scope.programFallback && isProgram(current)) return distance + 1;
		} else if (current === scope) {
			return distance;
		}
		current = current.parent;
		distance += 1;
	}
	return undefined;
}

function nearestTypeBindings(
	name: string,
	use: ESTree.Node,
	environment: TypeAliasEnvironment,
): ReadonlyArray<TypeBinding> {
	const candidates = environment.bindingsByName.get(name) ?? [];
	let nearestDistance = Number.POSITIVE_INFINITY;
	let nearest: Array<TypeBinding> = [];
	for (const candidate of candidates) {
		const distance = scopeDistance(candidate.scope, use);
		if (distance === undefined || distance > nearestDistance) continue;
		if (distance === nearestDistance) {
			nearest.push(candidate);
			continue;
		}
		nearestDistance = distance;
		nearest = [candidate];
	}
	return nearest;
}

/**
 * Collects lexical type aliases and competing type bindings in a program.
 *
 * @param program - Program whose immutable type environment is required.
 * @param visitorKeys - Parser visitor keys used to discover descendants.
 * @returns The cached environment for the program.
 */
export function createTypeAliasEnvironment(
	program: ESTree.Program,
	visitorKeys: SourceCode["visitorKeys"],
): TypeAliasEnvironment {
	let environmentsByVisitorKeys = environmentsByProgram.get(program);
	if (environmentsByVisitorKeys === undefined) {
		environmentsByVisitorKeys = new WeakMap();
		environmentsByProgram.set(program, environmentsByVisitorKeys);
	}
	const cached = environmentsByVisitorKeys.get(visitorKeys);
	if (cached !== undefined) return cached;
	const bindingsByName = new Map<string, Array<TypeBinding>>();
	const aliases: Array<ESTree.TSTypeAliasDeclaration> = [];
	collectTypeBindings(program, visitorKeys, bindingsByName, aliases);
	const environment = { aliases, bindingsByName, visitorKeys };
	environmentsByVisitorKeys.set(visitorKeys, environment);
	return environment;
}

/**
 * Resolves the nearest visible type alias with the requested name.
 *
 * @param name - Type binding name to resolve.
 * @param use - AST node at the lexical use site.
 * @param environment - Program type environment containing the use site.
 * @returns The visible alias, or undefined when absent or ambiguous.
 */
export function visibleTypeAlias(
	name: string,
	use: ESTree.Node,
	environment: TypeAliasEnvironment,
): ESTree.TSTypeAliasDeclaration | undefined {
	if (lexicalTypeParameterNames(use, environment.visitorKeys).has(name)) return undefined;
	const bindings = nearestTypeBindings(name, use, environment);
	return bindings.length === 1 ? bindings[0]?.alias : undefined;
}

/**
 * Resolves visible interface declarations in one lexical merge group.
 *
 * @param name - Interface binding name to resolve.
 * @param use - AST node at the lexical use site.
 * @param environment - Program type environment containing the use site.
 * @returns The merged declarations, or undefined when absent or competing.
 */
export function visibleInterfaceDeclarations(
	name: string,
	use: ESTree.Node,
	environment: TypeAliasEnvironment,
): ReadonlyArray<ESTree.TSInterfaceDeclaration> | undefined {
	if (lexicalTypeParameterNames(use, environment.visitorKeys).has(name)) return undefined;
	const bindings = nearestTypeBindings(name, use, environment);
	if (bindings.length === 0) return undefined;
	const declarations = new Array<ESTree.TSInterfaceDeclaration>();
	for (const binding of bindings) {
		if (binding.interface === undefined) return undefined;
		declarations.push(binding.interface);
	}
	return declarations;
}

/**
 * Checks whether a local declaration shadows a type name at a use site.
 *
 * @param name - Type binding name to inspect.
 * @param use - AST node at the lexical use site.
 * @param environment - Program type environment containing the use site.
 * @returns Whether a visible type binding or type parameter has this name.
 */
export function hasVisibleTypeBinding(name: string, use: ESTree.Node, environment: TypeAliasEnvironment): boolean {
	return (
		lexicalTypeParameterNames(use, environment.visitorKeys).has(name) ||
		nearestTypeBindings(name, use, environment).length > 0
	);
}

function typeReferenceName(type: ESTree.TSTypeReference): string | undefined {
	return isIdentifierName(type.typeName) ? type.typeName.name : undefined;
}

function aliasSubstitutions(
	alias: ESTree.TSTypeAliasDeclaration,
	reference: ESTree.TSTypeReference,
	caller: TypeResolution,
	resolving: ReadonlySet<ESTree.TSTypeAliasDeclaration>,
): SubstitutionEnvironment | undefined {
	const parameters = alias.typeParameters?.params ?? [];
	const arguments_ = reference.typeArguments?.params ?? [];
	const next = new Map<string, Substitution>();
	for (const [index, parameter] of parameters.entries()) {
		const explicitArgument = arguments_[index];
		const argument = explicitArgument ?? parameter.default;
		if (argument === null) return undefined;
		const environment =
			explicitArgument === undefined
				? { owner: alias, parameters: new Map(next) }
				: caller[resolutionContext].environment;
		next.set(parameter.name.name, {
			environment,
			resolving: explicitArgument === undefined ? resolving : caller[resolutionContext].resolving,
			type: argument,
		});
	}
	return { owner: alias, parameters: next };
}

function visibleSubstitution(
	name: string,
	resolution: TypeResolution,
	environment: TypeAliasEnvironment,
): Substitution | undefined {
	const { owner, parameters } = resolution[resolutionContext].environment;
	if (owner === undefined) return undefined;
	if (lexicalTypeParameterNames(resolution.type, environment.visitorKeys, owner).has(name)) return undefined;
	return parameters.get(name);
}

/**
 * Creates a root type resolution with no captured substitutions.
 *
 * @param type - Root type to resolve.
 * @returns An opaque resolution for the type.
 */
export function createTypeResolution(type: ESTree.TSType): TypeResolution {
	return {
		[resolutionContext]: { environment: EMPTY_SUBSTITUTION_ENVIRONMENT, resolving: new Set() },
		type,
	};
}

/**
 * Continues resolution at a structured child while preserving context.
 *
 * @param parentResolution - Resolution owning the child.
 * @param childType - Structured child type to inspect.
 * @returns A resolution carrying the parent's captured context.
 */
export function continueTypeResolution(parentResolution: TypeResolution, childType: ESTree.TSType): TypeResolution {
	return { [resolutionContext]: parentResolution[resolutionContext], type: childType };
}

/**
 * Resolves one visible substitution or alias transition.
 *
 * @param resolution - Type resolution to advance.
 * @param environment - Lexical type environment containing the type.
 * @returns The next captured resolution, or undefined when unresolved.
 */
export function resolveTypeReference(
	resolution: TypeResolution,
	environment: TypeAliasEnvironment,
): TypeResolution | undefined {
	if (!isTsTypeReference(resolution.type)) return undefined;
	const name = typeReferenceName(resolution.type);
	if (name === undefined) return undefined;
	const substitution = visibleSubstitution(name, resolution, environment);
	if (substitution !== undefined && (resolution.type.typeArguments?.params.length ?? 0) === 0) {
		return {
			[resolutionContext]: {
				environment: substitution.environment,
				resolving: substitution.resolving,
			},
			type: substitution.type,
		};
	}
	const alias = visibleTypeAlias(name, resolution.type, environment);
	if (alias === undefined || resolution[resolutionContext].resolving.has(alias)) return undefined;
	const resolving = new Set<ESTree.TSTypeAliasDeclaration>([alias]);
	const previouslyResolving = resolution[resolutionContext].resolving;
	for (const resolvingAlias of previouslyResolving) resolving.add(resolvingAlias);
	const substitutions = aliasSubstitutions(alias, resolution.type, resolution, resolving);
	if (substitutions === undefined) return undefined;
	return { [resolutionContext]: { environment: substitutions, resolving }, type: alias.typeAnnotation };
}

/**
 * Matches a type after resolving visible aliases and generic substitutions.
 *
 * @param type - Type to resolve and inspect.
 * @param environment - Program type environment containing the type.
 * @param matcher - Behavioral matcher that may enqueue transparent children.
 * @returns Whether the type or an enqueued child matches.
 */
export function resolvedTypeMatches(
	type: ESTree.TSType,
	environment: TypeAliasEnvironment,
	matcher: ResolvedTypeMatcher,
): boolean {
	const pending: Array<TypeResolution> = [createTypeResolution(type)];
	for (const resolution of pending) {
		const resolved = resolveTypeReference(resolution, environment);
		if (resolved !== undefined) {
			// oxlint-disable-next-line small-rules/no-loop-iterable-mutation -- ADR-0001 append-only worklist.
			pending.push(resolved);
			continue;
		}
		if (
			matcher(resolution.type, function enqueue(child) {
				pending.push(continueTypeResolution(resolution, child));
			})
		) {
			return true;
		}
	}
	return false;
}
