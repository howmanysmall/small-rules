import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

interface ComplexityConfiguration {
	readonly baseThreshold: number;
	readonly errorThreshold: number;
	readonly interfacePenalty: number;
	readonly performanceMode: boolean;
	readonly warnThreshold: number;
}

interface ComplexityCache {
	readonly nodeCache: WeakMap<object, number>;
	readonly visitedNodes: WeakSet<object>;
}

const DEFAULT_CONFIGURATION: ComplexityConfiguration = {
	baseThreshold: 10,
	errorThreshold: 25,
	interfacePenalty: 20,
	performanceMode: true,
	warnThreshold: 15,
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null;
}

function isNode(value: unknown): value is ESTree.Node {
	return isRecord(value) && typeof value.type === "string";
}

function getRecordValue(record: Readonly<Record<string, unknown>>, key: string): unknown {
	return key in record ? record[key] : undefined;
}

function getNodeValue(record: Readonly<Record<string, unknown>>, key: string): ESTree.Node | undefined {
	const value = getRecordValue(record, key);
	return isNode(value) ? value : undefined;
}

function getNodeArrayValue(
	record: Readonly<Record<string, unknown>>,
	key: string,
): ReadonlyArray<ESTree.Node> | undefined {
	const value = getRecordValue(record, key);
	if (!Array.isArray(value)) return undefined;
	return value.every(isNode) ? value : undefined;
}

function getNestedTypeAnnotation(node: ESTree.Node): ESTree.Node | undefined {
	if (!isRecord(node)) return undefined;
	const typeAnnotation = getNodeValue(node, "typeAnnotation");
	if (typeAnnotation === undefined || !isRecord(typeAnnotation)) return undefined;
	return getNodeValue(typeAnnotation, "typeAnnotation");
}

function getReturnTypeAnnotation(node: ESTree.Node): ESTree.Node | undefined {
	if (!isRecord(node)) return undefined;
	const returnType = getNodeValue(node, "returnType");
	if (returnType === undefined || !isRecord(returnType)) return undefined;
	return getNodeValue(returnType, "typeAnnotation");
}

function hasTypeAnnotation(node: ESTree.VariableDeclarator): boolean {
	const { id } = node;
	if (id.type !== "Identifier") return false;
	if (!isRecord(id)) return false;
	return getRecordValue(id, "typeAnnotation") !== undefined;
}

function isIanitorValidator(node: ESTree.CallExpression): boolean {
	const { callee } = node;
	if (callee.type !== "MemberExpression") return false;
	return callee.object.type === "Identifier" && callee.object.name === "Ianitor";
}

function unwrapReadonlyType(typeNode: ESTree.Node): ESTree.Node {
	if (typeNode.type !== "TSTypeReference" || !isRecord(typeNode)) return typeNode;

	const typeName = getNodeValue(typeNode, "typeName");
	if (typeName?.type !== "Identifier" || typeName.name !== "Readonly") return typeNode;

	const typeArguments = getNodeValue(typeNode, "typeArguments");
	if (typeArguments === undefined || !isRecord(typeArguments)) return typeNode;

	const parameters = getNodeArrayValue(typeArguments, "params");
	const first = parameters?.[0];
	return first ?? typeNode;
}

function extractIanitorStaticVariable(typeNode: ESTree.Node): string | undefined {
	const currentType = unwrapReadonlyType(typeNode);
	if (currentType.type !== "TSTypeReference" || !isRecord(currentType)) return undefined;

	const typeName = getNodeValue(currentType, "typeName");
	if (typeName?.type !== "TSQualifiedName" || !isRecord(typeName)) return undefined;

	const left = getNodeValue(typeName, "left");
	const right = getNodeValue(typeName, "right");
	if (left?.type !== "Identifier" || left.name !== "Ianitor") return undefined;
	if (right?.type !== "Identifier" || right.name !== "Static") return undefined;

	const typeArguments = getNodeValue(currentType, "typeArguments");
	if (typeArguments === undefined || !isRecord(typeArguments)) return undefined;

	const first = getNodeArrayValue(typeArguments, "params")?.[0];
	if (first?.type !== "TSTypeQuery" || !isRecord(first)) return undefined;

	const expressionName = getNodeValue(first, "exprName");
	return expressionName?.type === "Identifier" ? expressionName.name : undefined;
}

function hasIanitorStaticType(typeNode: ESTree.Node): boolean {
	const currentType = unwrapReadonlyType(typeNode);
	if (currentType.type !== "TSTypeReference" || !isRecord(currentType)) return false;

	const typeName = getNodeValue(currentType, "typeName");
	if (typeName?.type !== "TSQualifiedName" || !isRecord(typeName)) return false;

	const left = getNodeValue(typeName, "left");
	const right = getNodeValue(typeName, "right");
	if (left?.type !== "Identifier" || left.name !== "Ianitor") return false;
	if (right?.type !== "Identifier" || right.name !== "Static") return false;

	const typeArguments = getNodeValue(currentType, "typeArguments");
	if (typeArguments === undefined || !isRecord(typeArguments)) return false;

	const first = getNodeArrayValue(typeArguments, "params")?.[0];
	return first?.type === "TSTypeQuery";
}

function calculateIanitorComplexity(node: ESTree.CallExpression): number {
	const { callee } = node;
	if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return 0;

	const method = callee.property.name;
	switch (method) {
		case "array":
		case "instanceIsA":
		case "instanceOf":
		case "optional":
			return 2;
		case "boolean":
		case "number":
		case "string":
			return 1;
		case "interface":
		case "strictInterface": {
			const [firstArgument] = node.arguments;
			return firstArgument?.type === "ObjectExpression" ? 10 + firstArgument.properties.length * 3 : 0;
		}
		case "intersection":
		case "union":
			return node.arguments.length * 2;
		case "map":
		case "record":
			return 3;
		default:
			return 1;
	}
}

function addScore(current: number, addition: number, config: ComplexityConfiguration, ceiling: number): number {
	const nextScore = current + addition;
	if (!config.performanceMode) return nextScore;
	return Math.min(nextScore, ceiling);
}

function addNestedTypeAnnotationScores(
	current: number,
	members: ReadonlyArray<ESTree.Node>,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	let score = current;
	for (const member of members) {
		const typeAnnotation = getNestedTypeAnnotation(member);
		if (typeAnnotation === undefined) continue;
		score = addScore(
			score,
			calculateStructuralComplexity(typeAnnotation, depth, config, cache, depthMultiplierCache, ceiling),
			config,
			ceiling,
		);
	}
	return score;
}

function getDepthMultiplier(depth: number, cache: Map<number, number>): number {
	const cached = cache.get(depth);
	if (cached !== undefined) return cached;
	const computed = Math.max(1, Math.log2(depth + 1));
	cache.set(depth, computed);
	return computed;
}

function calculateChildComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	return calculateStructuralComplexity(node, depth, config, cache, depthMultiplierCache, ceiling);
}

function addChildComplexity(
	score: number,
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	return addScore(
		score,
		calculateChildComplexity(node, depth, config, cache, depthMultiplierCache, ceiling),
		config,
		ceiling,
	);
}

function getDefinedNodes(nodes: ReadonlyArray<ESTree.Node | undefined>): ReadonlyArray<ESTree.Node> {
	return nodes.filter((node): node is ESTree.Node => node !== undefined);
}

function addChildComplexities(
	score: number,
	nodes: ReadonlyArray<ESTree.Node>,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	let nextScore = score;
	for (const child of nodes) {
		nextScore = addChildComplexity(nextScore, child, depth, config, cache, depthMultiplierCache, ceiling);
	}
	return nextScore;
}

function calculateArrayTypeComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 1;

	const elementType = getNodeValue(node, "elementType");
	if (elementType === undefined) return 1;

	return addScore(
		calculateChildComplexity(elementType, depth, config, cache, depthMultiplierCache, ceiling),
		1,
		config,
		ceiling,
	);
}

function calculateConditionalTypeComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 3;

	const childTypes = getDefinedNodes([
		getNodeValue(node, "checkType"),
		getNodeValue(node, "extendsType"),
		getNodeValue(node, "trueType"),
		getNodeValue(node, "falseType"),
	]);
	return addChildComplexities(3, childTypes, depth, config, cache, depthMultiplierCache, ceiling);
}

function calculateFunctionTypeComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 2;

	const parameterTypes = getNodeArrayValue(node, "params")?.map(getNestedTypeAnnotation) ?? [];
	const childTypes = getDefinedNodes([...parameterTypes, getReturnTypeAnnotation(node)]);
	return addChildComplexities(2, childTypes, depth, config, cache, depthMultiplierCache, ceiling);
}

function calculateInterfaceComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return config.interfacePenalty;

	const extendsLength = getNodeArrayValue(node, "extends")?.length ?? 0;
	const body = getNodeValue(node, "body");
	const members = body !== undefined && isRecord(body) ? (getNodeArrayValue(body, "body") ?? []) : [];
	let score = config.interfacePenalty;
	if (extendsLength > 0) score = addScore(score, extendsLength * 5, config, ceiling);
	score = addScore(score, members.length * 2, config, ceiling);
	return addNestedTypeAnnotationScores(score, members, depth, config, cache, depthMultiplierCache, ceiling);
}

function calculateTypeListComplexity(
	node: ESTree.Node,
	depth: number,
	typePenalty: (typeCount: number) => number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 0;

	const types = getNodeArrayValue(node, "types") ?? [];
	const score = addChildComplexities(0, types, depth, config, cache, depthMultiplierCache, ceiling);
	return addScore(score, typePenalty(types.length), config, ceiling);
}

function calculateMappedTypeComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 5;

	const childTypes = getDefinedNodes([getNodeValue(node, "constraint"), getNodeValue(node, "typeAnnotation")]);
	return addChildComplexities(5, childTypes, depth, config, cache, depthMultiplierCache, ceiling);
}

function calculateTupleTypeComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 0;

	const elementTypes = getNodeArrayValue(node, "elementTypes") ?? [];
	const requiredElements = elementTypes.filter(
		(element) => element.type !== "TSRestType" && element.type !== "TSOptionalType",
	);
	const score = addChildComplexities(1, requiredElements, depth, config, cache, depthMultiplierCache, ceiling);
	return addScore(score, 1.5 * elementTypes.length, config, ceiling);
}

function calculateTypeLiteralComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 0;

	const members = getNodeArrayValue(node, "members") ?? [];
	const score = 2 + members.length * 0.5;
	return addNestedTypeAnnotationScores(score, members, depth, config, cache, depthMultiplierCache, ceiling);
}

function calculateTypeReferenceComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	if (!isRecord(node)) return 2;

	const typeArguments = getNodeValue(node, "typeArguments");
	const parameters =
		typeArguments !== undefined && isRecord(typeArguments)
			? (getNodeArrayValue(typeArguments, "params") ?? [])
			: [];
	let score = 2;
	for (const parameter of parameters) {
		score = addScore(
			score,
			calculateChildComplexity(parameter, depth, config, cache, depthMultiplierCache, ceiling) + 2,
			config,
			ceiling,
		);
	}
	return score;
}

function calculateStructuralComplexity(
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
): number {
	const cached = cache.nodeCache.get(node);
	if (cached !== undefined) return cached;
	if (cache.visitedNodes.has(node)) return 50;

	cache.visitedNodes.add(node);

	let score = 0;
	const nextDepth = depth + 1;

	switch (node.type) {
		case "TSAnyKeyword":
		case "TSNeverKeyword":
		case "TSUnknownKeyword":
			break;

		case "TSArrayType": {
			score = calculateArrayTypeComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSBigIntKeyword":
		case "TSBooleanKeyword":
		case "TSNullKeyword":
		case "TSNumberKeyword":
		case "TSStringKeyword":
		case "TSSymbolKeyword":
		case "TSUndefinedKeyword":
		case "TSVoidKeyword": {
			score = 1;
			break;
		}
		case "TSConditionalType": {
			score = calculateConditionalTypeComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSFunctionType":
		case "TSMethodSignature": {
			score = calculateFunctionTypeComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSInterfaceDeclaration": {
			score = calculateInterfaceComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSIntersectionType": {
			score = calculateTypeListComplexity(
				node,
				nextDepth,
				(typeCount) => 3 * typeCount,
				config,
				cache,
				depthMultiplierCache,
				ceiling,
			);
			break;
		}
		case "TSMappedType": {
			score = calculateMappedTypeComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSTupleType": {
			score = calculateTupleTypeComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSTypeLiteral": {
			score = calculateTypeLiteralComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSTypeReference": {
			score = calculateTypeReferenceComplexity(node, nextDepth, config, cache, depthMultiplierCache, ceiling);
			break;
		}
		case "TSUnionType": {
			score = calculateTypeListComplexity(
				node,
				nextDepth,
				(typeCount) => 2 * (typeCount - 1),
				config,
				cache,
				depthMultiplierCache,
				ceiling,
			);
			break;
		}
		default:
			score = 1;
	}

	score *= getDepthMultiplier(depth, depthMultiplierCache);
	cache.nodeCache.set(node, score);
	cache.visitedNodes.delete(node);
	return score;
}

const enforceIanitorCheckType = defineRule({
	create(context): Visitor {
		const rawOptions = (context.options[0] ?? {}) as Partial<ComplexityConfiguration>;
		const config: ComplexityConfiguration = { ...DEFAULT_CONFIGURATION, ...rawOptions };
		const cache: ComplexityCache = {
			nodeCache: new WeakMap(),
			visitedNodes: new WeakSet(),
		};
		const ianitorStaticVariables = new Set<string>();
		const depthMultiplierCache = new Map<number, number>();
		const complexityCeiling = config.errorThreshold * 2;
		let hasIanitorReference = false;
		const interfacesToCheck = new Map<ESTree.TSInterfaceDeclaration, { complexity: number }>();
		const typeAliasesToCheck = new Map<ESTree.TSTypeAliasDeclaration, { complexity: number }>();
		const variableDeclaratorsToCheck = new Map<ESTree.VariableDeclarator, { complexity: number }>();

		return {
			Identifier(node): void {
				if (node.name === "Ianitor") hasIanitorReference = true;
			},

			"Program:exit"(): void {
				if (!hasIanitorReference) return;

				for (const [node, data] of typeAliasesToCheck.entries()) {
					context.report({
						data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node,
					});
				}

				for (const [node] of interfacesToCheck.entries()) {
					context.report({
						data: { name: node.id.name },
						messageId: "complexInterfaceNeedsCheck",
						node,
					});
				}

				for (const [node, data] of variableDeclaratorsToCheck.entries()) {
					const { id } = node;
					if (id.type === "Identifier" && ianitorStaticVariables.has(id.name)) continue;

					context.report({
						data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node: id,
					});
				}
			},
			TSInterfaceDeclaration(node): void {
				const complexity = calculateStructuralComplexity(
					node,
					0,
					config,
					cache,
					depthMultiplierCache,
					complexityCeiling,
				);
				if (complexity < config.interfacePenalty) return;

				interfacesToCheck.set(node, { complexity });
			},

			TSTypeAliasDeclaration(node): void {
				const variableName = extractIanitorStaticVariable(node.typeAnnotation);
				if (variableName !== undefined) {
					hasIanitorReference = true;
					ianitorStaticVariables.add(variableName);
				}
				if (hasIanitorStaticType(node.typeAnnotation)) return;

				const complexity = calculateStructuralComplexity(
					node.typeAnnotation,
					0,
					config,
					cache,
					depthMultiplierCache,
					complexityCeiling,
				);
				if (complexity < config.baseThreshold) return;

				typeAliasesToCheck.set(node, { complexity });
			},

			VariableDeclarator(node): void {
				const { init } = node;
				if (init?.type !== "CallExpression") return;
				if (!isIanitorValidator(init)) return;
				hasIanitorReference = true;
				if (hasTypeAnnotation(node)) return;

				const complexity = calculateIanitorComplexity(init);
				if (complexity < config.baseThreshold) return;

				variableDeclaratorsToCheck.set(node, { complexity });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Enforce Ianitor.Check<T> type annotations on complex TypeScript types",
			recommended: true,
		},
		messages: {
			complexInterfaceNeedsCheck:
				"Interface '{{name}}' requires Ianitor.Check<T> annotation (interfaces always need explicit checking)",
			missingIanitorCheckType:
				"Complex type (score: {{score}}) requires Ianitor.Check<T> annotation for type safety",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					baseThreshold: { minimum: 1, type: "number" },
					errorThreshold: { minimum: 1, type: "number" },
					interfacePenalty: { minimum: 1, type: "number" },
					performanceMode: { type: "boolean" },
					warnThreshold: { minimum: 1, type: "number" },
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default enforceIanitorCheckType;
