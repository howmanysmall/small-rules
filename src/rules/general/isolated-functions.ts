import { getMemberPropertyName, pushChildScopes } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isAnyFunction, isNode } from "$oxc-utilities/oxc-utilities";
import { isRecord, isStringArray, isStringRaw } from "$oxc-utilities/type-utilities";

import type { ESTree, InferContextFromRule, Reference, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

type GlobalMode = "off" | "readonly" | "writable";
type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

type Context = InferContextFromRule<typeof isolatedFunctions>;

interface RuleOptions {
	readonly comments: ReadonlyArray<string>;
	readonly functions: ReadonlySet<string>;
	readonly overrideGlobals: ReadonlyMap<string, GlobalMode>;
	readonly selectors: ReadonlyArray<string>;
}

const DEFAULT_FUNCTIONS = ["makeSynchronous", "workerize"] as const;
const DEFAULT_COMMENTS = ["@isolated"] as const;
const SCRIPTING_OBJECTS = new Set(["browser", "chrome"]);

const COMMENTABLE_PARENT_TYPES = new Set([
	"ExportDefaultDeclaration",
	"ExportNamedDeclaration",
	"MethodDefinition",
	"Property",
	"VariableDeclaration",
	"VariableDeclarator",
]);

const NESTED_FUNCTION_CUTOFF_TYPES = new Set(["FunctionDeclaration", "FunctionExpression"]);
const CLASS_TYPES = new Set(["ClassDeclaration", "ClassExpression"]);
const LEADING_JSDOC_STAR_PATTERN = /(?:\*\s*)*/u;

function parseGlobalMode(value: unknown): GlobalMode | undefined {
	if (value === true || value === "writable" || value === "writeable") return "writable";
	if (value === false || value === "off") return "off";
	if (value === "readonly" || value === "readable") return "readonly";
	return undefined;
}

function parseOptions(rawOptions: unknown): RuleOptions {
	if (!isRecord(rawOptions)) {
		return {
			comments: DEFAULT_COMMENTS.map((comment) => comment.toLowerCase()),
			functions: new Set(DEFAULT_FUNCTIONS),
			overrideGlobals: new Map(),
			selectors: [],
		};
	}

	const comments = isStringArray(rawOptions.comments)
		? rawOptions.comments.map((comment) => comment.toLowerCase())
		: DEFAULT_COMMENTS.map((comment) => comment.toLowerCase());
	const functions = isStringArray(rawOptions.functions) ? new Set(rawOptions.functions) : new Set(DEFAULT_FUNCTIONS);
	const selectors = isStringArray(rawOptions.selectors) ? rawOptions.selectors : [];
	const overrideGlobals = new Map<string, GlobalMode>();
	if (isRecord(rawOptions.overrideGlobals)) {
		for (const [name, value] of Object.entries(rawOptions.overrideGlobals)) {
			const mode = parseGlobalMode(value);
			if (mode !== undefined) overrideGlobals.set(name, mode);
		}
	}

	return { comments, functions, overrideGlobals, selectors };
}

function isFunctionNode(node: ESTree.Node): node is FunctionNode {
	return isAnyFunction(node);
}

function getObjectPropertyName(node: ESTree.Node): string | undefined {
	/* v8 ignore next -- callers only pass Property nodes from object literals. @preserve */
	if (node.type !== "Property" && node.type !== "MethodDefinition") return undefined;
	if (node.computed && node.key.type !== "Literal") return undefined;
	if (node.key.type === "Identifier") return node.key.name;
	if (node.key.type === "Literal" && isStringRaw(node.key.value)) return node.key.value;
	return undefined;
}

function isMethodCallNamed(node: ESTree.CallExpression, objectName: string, methodName: string): boolean {
	if (node.callee.type !== "MemberExpression" || node.callee.computed || node.callee.optional) return false;
	if (node.callee.object.type !== "Identifier" || node.callee.object.name !== objectName) return false;
	return getMemberPropertyName(node.callee) === methodName;
}

function getDefaultArgumentCallReason(node: ESTree.Node): string | undefined {
	const { parent } = node;
	if (parent?.type !== "CallExpression" || parent.arguments[0] !== node) return undefined;
	if (isMethodCallNamed(parent, "browser", "execute")) return 'callee of method named "browser.execute"';
	if (isMethodCallNamed(parent, "page", "evaluate")) return 'callee of method named "page.evaluate"';
	return undefined;
}

function getScriptingObjectName(call: ESTree.CallExpression): string | undefined {
	if (call.callee.type !== "MemberExpression" || call.callee.computed || call.callee.optional) return undefined;
	if (getMemberPropertyName(call.callee) !== "executeScript") return undefined;
	const scripting = call.callee.object;
	if (scripting.type !== "MemberExpression" || scripting.computed || scripting.optional) return undefined;
	if (getMemberPropertyName(scripting) !== "scripting") return undefined;
	if (scripting.object.type !== "Identifier" || !SCRIPTING_OBJECTS.has(scripting.object.name)) return undefined;
	return scripting.object.name;
}

function getExecuteScriptPropertyReason(node: ESTree.Node): string | undefined {
	const property = node.parent;
	if (
		property?.type !== "Property" ||
		property.kind !== "init" ||
		property.value !== node ||
		getObjectPropertyName(property) !== "func"
	) {
		return undefined;
	}
	const objectExpression = property.parent;
	/* v8 ignore next -- Property parents in this path are ObjectExpression nodes. @preserve */
	if (objectExpression.type !== "ObjectExpression") return undefined;
	const call = objectExpression.parent;
	if (call.type !== "CallExpression" || call.arguments[0] !== objectExpression) return undefined;
	const scriptingObjectName = getScriptingObjectName(call);
	if (scriptingObjectName === undefined) return undefined;
	return `property "func" passed to "${scriptingObjectName}.scripting.executeScript"`;
}

function isCallArgument(call: ESTree.CallExpression, node: ESTree.Node): boolean {
	for (const argument of call.arguments) {
		if (argument === node) return true;
	}
	/* v8 ignore next -- IIFE callees are ParenthesizedExpression parents, not bare CallExpression callees. @preserve */
	return false;
}

function getConfiguredFunctionReason(node: ESTree.Node, functions: ReadonlySet<string>): string | undefined {
	if (functions.size === 0) return undefined;
	const { parent } = node;
	if (parent?.type !== "CallExpression" || !isCallArgument(parent, node)) return undefined;
	if (parent.callee.type !== "Identifier" || !functions.has(parent.callee.name)) return undefined;
	return `callee of function named ${JSON.stringify(parent.callee.name)}`;
}

function canCommentApplyToParent(node: ESTree.Node, parent: ESTree.Node | null): boolean {
	if (parent === null || !COMMENTABLE_PARENT_TYPES.has(parent.type)) return false;
	if (parent.type === "Property" || parent.type === "MethodDefinition") return parent.value === node;
	return true;
}

function normalizeCommentValue(value: string): string {
	return value.replace(LEADING_JSDOC_STAR_PATTERN, "").trim().toLowerCase();
}

function findLeadingCommentValue(sourceCode: SourceCode, node: ESTree.Node): string | undefined {
	let commentableNode = node;
	while (true) {
		const comments = sourceCode.getCommentsBefore(commentableNode);
		const lastComment = comments.at(-1);
		if (lastComment !== undefined) return lastComment.value;
		const { parent } = commentableNode;
		if (parent === null || !canCommentApplyToParent(commentableNode, parent)) return undefined;
		commentableNode = parent;
	}
}

function getCommentReason(
	sourceCode: SourceCode,
	node: ESTree.Node,
	comments: ReadonlyArray<string>,
): string | undefined {
	if (comments.length === 0) return undefined;
	const rawComment = findLeadingCommentValue(sourceCode, node);
	if (rawComment === undefined) return undefined;
	const previousComment = normalizeCommentValue(rawComment);
	for (const comment of comments) {
		if (
			previousComment === comment ||
			previousComment.startsWith(`${comment} - `) ||
			previousComment.startsWith(`${comment} -- `)
		) {
			return `follows comment ${JSON.stringify(comment)}`;
		}
	}
	return undefined;
}

function reasonForIsolatedFunction(
	sourceCode: SourceCode,
	node: ESTree.Node,
	options: RuleOptions,
): string | undefined {
	return (
		getCommentReason(sourceCode, node, options.comments) ??
		getConfiguredFunctionReason(node, options.functions) ??
		getDefaultArgumentCallReason(node) ??
		getExecuteScriptPropertyReason(node)
	);
}

function isTypePositionIdentifier(identifier: ESTree.Node): boolean {
	const { parent } = identifier;
	return parent !== null && (parent.type === "TSTypeReference" || parent.type === "TSTypeQuery");
}

function isScopeInside(inner: Scope, outer: Scope): boolean {
	let current: Scope | null = inner;
	while (current !== null) {
		if (current === outer) return true;
		current = current.upper;
	}
	return false;
}

function isExternalReference(functionScope: Scope, reference: Reference): boolean {
	const { resolved } = reference;
	if (resolved?.scope === undefined) return true;
	return !isScopeInside(resolved.scope, functionScope);
}

function collectExternalReferences(functionScope: Scope): Array<Reference> {
	const external = new Array<Reference>();
	const scopes = [functionScope];
	for (const scope of scopes) {
		pushChildScopes(scopes, scope);
		for (const reference of scope.references) {
			if (isExternalReference(functionScope, reference)) external.push(reference);
		}
	}
	return external;
}

function getAllowedGlobalMode(
	sourceCode: SourceCode,
	reference: Reference,
	options: RuleOptions,
): GlobalMode | undefined {
	const { identifier } = reference;
	const { name } = identifier;
	const override = options.overrideGlobals.get(name);
	if (override !== undefined) {
		if (override === "off") return "off";
		if (reference.resolved !== null && !sourceCode.isGlobalReference(identifier)) return undefined;
		return override;
	}
	if (!sourceCode.isGlobalReference(identifier)) return undefined;
	return "readonly";
}

function reportExternalReferences(context: Context, node: FunctionNode, reason: string, options: RuleOptions): void {
	const functionScope = context.sourceCode.getScope(node);
	for (const reference of collectExternalReferences(functionScope)) {
		const { identifier } = reference;
		if (isTypePositionIdentifier(identifier)) continue;

		const allowedGlobal = getAllowedGlobalMode(context.sourceCode, reference, options);
		let problemReason = reason;

		if (allowedGlobal !== undefined && allowedGlobal !== "off") {
			if (reference.isReadOnly()) continue;
			if (allowedGlobal === "writable") continue;
			problemReason = `${reason} (global variable is not writable)`;
		}

		context.report({
			data: { name: identifier.name, reason: problemReason },
			messageId: "externallyScopedVariable",
			node: identifier,
		});
	}
}

function pushChildNodes(sourceCode: SourceCode, node: ESTree.Node, worklist: Array<ESTree.Node>): void {
	/* v8 ignore next -- every visited ESTree type has visitor keys in the parser tables. @preserve */
	const keys = sourceCode.visitorKeys[node.type] ?? [];
	for (const key of keys) {
		/* v8 ignore next -- parser-produced ESTree nodes are always records. @preserve */
		if (!isRecord(node)) break;
		const value = node[key];
		if (Array.isArray(value)) {
			/* v8 ignore next -- visitor-key arrays only contain nodes or null holes already filtered. @preserve */
			for (const item of value) if (isNode(item)) worklist.push(item);
		} else if (isNode(value)) {
			worklist.push(value);
		}
	}
}

function pushClassBoundaryChildren(node: ESTree.Node, worklist: Array<ESTree.Node>): void {
	/* v8 ignore next -- only invoked for ClassDeclaration/ClassExpression nodes. @preserve */
	if (node.type !== "ClassDeclaration" && node.type !== "ClassExpression") return;
	if (node.superClass !== null) worklist.push(node.superClass);
	for (const element of node.body.body) {
		if ("computed" in element && element.computed) worklist.push(element.key);
	}
}

function shouldSkipNestedNode(node: ESTree.Node, root: FunctionNode, worklist: Array<ESTree.Node>): boolean {
	if (node === root) return false;
	if (NESTED_FUNCTION_CUTOFF_TYPES.has(node.type)) return true;
	if (!CLASS_TYPES.has(node.type)) return false;
	pushClassBoundaryChildren(node, worklist);
	return true;
}

function reportThisAndSuper(context: Context, root: FunctionNode, reason: string): void {
	const worklist: Array<ESTree.Node> = [root];
	for (const node of worklist) {
		if (shouldSkipNestedNode(node, root, worklist)) continue;
		if (node.type === "ThisExpression") {
			context.report({ data: { reason }, messageId: "thisExpression", node });
			continue;
		}
		if (node.type === "Super") {
			context.report({ data: { reason }, messageId: "super", node });
			continue;
		}
		pushChildNodes(context.sourceCode, node, worklist);
	}
}

function reportIsolatedFunction(
	context: Context,
	node: FunctionNode,
	reason: string,
	options: RuleOptions,
	checked: WeakSet<ESTree.Node>,
): void {
	/* v8 ignore next -- selector + default visitors may both match the same function. @preserve */
	if (checked.has(node)) return;
	checked.add(node);
	reportExternalReferences(context, node, reason, options);
	reportThisAndSuper(context, node, reason);
}

const isolatedFunctions = createRule("isolated-functions", "general", {
	create(context): Visitor {
		const options = parseOptions(context.options[0]);
		const checked = new WeakSet<ESTree.Node>();

		function checkFunctionNode(node: ESTree.Node): void {
			/* v8 ignore next -- registered only on function visitor keys. @preserve */
			if (!isFunctionNode(node)) return;
			const reason = reasonForIsolatedFunction(context.sourceCode, node, options);
			if (reason === undefined) return;
			reportIsolatedFunction(context, node, reason, options, checked);
		}

		const visitor: Record<string, (node: ESTree.Node) => void> = {
			ArrowFunctionExpression: checkFunctionNode,
			FunctionDeclaration: checkFunctionNode,
			FunctionExpression: checkFunctionNode,
		};

		for (const selector of options.selectors) {
			const reason = `matches selector ${JSON.stringify(selector)}`;
			visitor[selector] = (node: ESTree.Node): void => {
				/* v8 ignore next -- selectors may match non-function nodes. @preserve */
				if (!isFunctionNode(node)) return;
				reportIsolatedFunction(context, node, reason, options, checked);
			};
		}

		return visitor;
	},
	meta: {
		docs: {
			description: "Prevent usage of variables from outside the scope of isolated functions.",
			recommended: true,
		},
		messages: {
			externallyScopedVariable:
				"Variable {{name}} not defined in scope of isolated function. Function is isolated because: {{reason}}.",
			super: "Unexpected `super` in isolated function. Function is isolated because: {{reason}}.",
			thisExpression: "Unexpected `this` in isolated function. Function is isolated because: {{reason}}.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					comments: {
						description: "Comment patterns that mark a function as isolated.",
						items: { type: "string" },
						type: "array",
						uniqueItems: true,
					},
					functions: {
						description: "Function names that mark argument callbacks as isolated.",
						items: { type: "string" },
						type: "array",
						uniqueItems: true,
					},
					overrideGlobals: {
						additionalProperties: {
							anyOf: [
								{ type: "boolean" },
								{ enum: ["off", "readonly", "writable", "writeable"], type: "string" },
							],
						},
						description: "Override which global variables are allowed inside isolated scopes.",
						type: "object",
					},
					selectors: {
						description: "AST selectors that mark matched function nodes as isolated.",
						items: { type: "string" },
						type: "array",
						uniqueItems: true,
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default isolatedFunctions;
