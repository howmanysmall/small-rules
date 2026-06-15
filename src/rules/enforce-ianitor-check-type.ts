// oxlint-disable max-params -- nobody cares lol
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

// biome-ignore lint/complexity/useMaxParams: do not care.
function addStructuralScore(
	current: number,
	node: ESTree.Node,
	depth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
	bonus = 0,
): number {
	return addScore(
		current,
		calculateStructuralComplexity(node, depth, config, cache, depthMultiplierCache, ceiling) + bonus,
		config,
		ceiling,
	);
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
		score = addStructuralScore(score, typeAnnotation, depth, config, cache, depthMultiplierCache, ceiling);
	}
	return score;
}

function getDepthMultiplier(depth: number, cache: Map<number, number>): number {
	const cached = cache.get(depth);
	if (cached !== undefined) return cached;
	const computed = Math.log2(depth + 1);
	cache.set(depth, computed);
	return computed;
}

// oxlint-disable-next-line sonar/cognitive-complexity -- do not care.
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
			if (isRecord(node)) {
				const elementType = getNodeValue(node, "elementType");
				if (elementType !== undefined) {
					score = addScore(
						calculateStructuralComplexity(
							elementType,
							nextDepth,
							config,
							cache,
							depthMultiplierCache,
							ceiling,
						),
						1,
						config,
						ceiling,
					);
					break;
				}
			}
			score = 1;
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
			score = 3;
			if (isRecord(node)) {
				const checkType = getNodeValue(node, "checkType");
				const extendsType = getNodeValue(node, "extendsType");
				const trueType = getNodeValue(node, "trueType");
				const falseType = getNodeValue(node, "falseType");
				if (checkType !== undefined) {
					score = addScore(
						score,
						calculateStructuralComplexity(
							checkType,
							nextDepth,
							config,
							cache,
							depthMultiplierCache,
							ceiling,
						),
						config,
						ceiling,
					);
				}
				if (extendsType !== undefined) {
					score = addScore(
						score,
						calculateStructuralComplexity(
							extendsType,
							nextDepth,
							config,
							cache,
							depthMultiplierCache,
							ceiling,
						),
						config,
						ceiling,
					);
				}
				if (trueType !== undefined) {
					score = addScore(
						score,
						calculateStructuralComplexity(
							trueType,
							nextDepth,
							config,
							cache,
							depthMultiplierCache,
							ceiling,
						),
						config,
						ceiling,
					);
				}
				if (falseType !== undefined) {
					score = addScore(
						score,
						calculateStructuralComplexity(
							falseType,
							nextDepth,
							config,
							cache,
							depthMultiplierCache,
							ceiling,
						),
						config,
						ceiling,
					);
				}
			}
			break;
		}
		case "TSFunctionType":
		case "TSMethodSignature": {
			score = 2;
			if (isRecord(node)) {
				const parameters = getNodeArrayValue(node, "params") ?? [];
				for (const parameter of parameters) {
					const typeAnnotation = getNestedTypeAnnotation(parameter);
					if (typeAnnotation === undefined) continue;
					score = addScore(
						score,
						calculateStructuralComplexity(
							typeAnnotation,
							nextDepth,
							config,
							cache,
							depthMultiplierCache,
							ceiling,
						),
						config,
						ceiling,
					);
				}
				const returnType = getReturnTypeAnnotation(node);
				if (returnType !== undefined) {
					score = addScore(
						score,
						calculateStructuralComplexity(
							returnType,
							nextDepth,
							config,
							cache,
							depthMultiplierCache,
							ceiling,
						),
						config,
						ceiling,
					);
				}
			}
			break;
		}
		case "TSInterfaceDeclaration": {
			score = config.interfacePenalty;
			if (isRecord(node)) {
				const extendsLength = getNodeArrayValue(node, "extends")?.length;
				if (extendsLength !== undefined && extendsLength > 0) {
					score = addScore(score, extendsLength * 5, config, ceiling);
				}

				const body = getNodeValue(node, "body");
				const members = body !== undefined && isRecord(body) ? (getNodeArrayValue(body, "body") ?? []) : [];
				score = addScore(score, members.length * 2, config, ceiling);
				score = addNestedTypeAnnotationScores(
					score,
					members,
					nextDepth,
					config,
					cache,
					depthMultiplierCache,
					ceiling,
				);
			}
			break;
		}
		case "TSIntersectionType": {
			if (isRecord(node)) {
				const types = getNodeArrayValue(node, "types") ?? [];
				for (const type of types) {
					score = addStructuralScore(score, type, nextDepth, config, cache, depthMultiplierCache, ceiling);
				}
				score = addScore(score, 3 * types.length, config, ceiling);
			}
			break;
		}
		case "TSMappedType": {
			score = 5;
			if (isRecord(node)) {
				const constraint = getNodeValue(node, "constraint");
				if (constraint !== undefined) {
					score = addStructuralScore(
						score,
						constraint,
						nextDepth,
						config,
						cache,
						depthMultiplierCache,
						ceiling,
					);
				}
				const typeAnnotation = getNodeValue(node, "typeAnnotation");
				if (typeAnnotation !== undefined) {
					score = addStructuralScore(
						score,
						typeAnnotation,
						nextDepth,
						config,
						cache,
						depthMultiplierCache,
						ceiling,
					);
				}
			}
			break;
		}
		case "TSTupleType": {
			if (isRecord(node)) {
				const elementTypes = getNodeArrayValue(node, "elementTypes") ?? [];
				score = 1;
				for (const element of elementTypes) {
					if (element.type === "TSRestType" || element.type === "TSOptionalType") continue;
					score = addStructuralScore(score, element, nextDepth, config, cache, depthMultiplierCache, ceiling);
				}
				score = addScore(score, 1.5 * elementTypes.length, config, ceiling);
			}
			break;
		}
		case "TSTypeLiteral": {
			if (isRecord(node)) {
				const members = getNodeArrayValue(node, "members") ?? [];
				score = 2 + members.length * 0.5;
				score = addNestedTypeAnnotationScores(
					score,
					members,
					nextDepth,
					config,
					cache,
					depthMultiplierCache,
					ceiling,
				);
			}
			break;
		}
		case "TSTypeReference": {
			score = 2;
			if (isRecord(node)) {
				const typeArguments = getNodeValue(node, "typeArguments");
				const parameters =
					typeArguments !== undefined && isRecord(typeArguments)
						? (getNodeArrayValue(typeArguments, "params") ?? [])
						: [];
				for (const parameter of parameters) {
					score = addStructuralScore(
						score,
						parameter,
						nextDepth,
						config,
						cache,
						depthMultiplierCache,
						ceiling,
						2,
					);
				}
			}
			break;
		}
		case "TSUnionType": {
			if (isRecord(node)) {
				const types = getNodeArrayValue(node, "types") ?? [];
				for (const type of types) {
					score = addStructuralScore(score, type, nextDepth, config, cache, depthMultiplierCache, ceiling);
				}
				score = addScore(score, 2 * (types.length - 1), config, ceiling);
			}
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
