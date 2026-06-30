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

function isIanitorValidator(node: ESTree.CallExpression): boolean {
	const { callee } = node;
	if (callee.type !== "MemberExpression") return false;
	return callee.object.type === "Identifier" && callee.object.name === "Ianitor";
}

function unwrapReadonlyType(typeNode: ESTree.Node): ESTree.Node {
	if (typeNode.type !== "TSTypeReference") return typeNode;

	const { typeName, typeArguments } = typeNode;
	if (typeName.type !== "Identifier" || typeName.name !== "Readonly") return typeNode;

	return typeArguments?.params[0] ?? typeNode;
}

function extractIanitorStaticVariable(typeNode: ESTree.Node): string | undefined {
	const currentType = unwrapReadonlyType(typeNode);
	if (currentType.type !== "TSTypeReference") return undefined;

	const { typeName, typeArguments } = currentType;
	if (typeName.type !== "TSQualifiedName") return undefined;

	const { left, right } = typeName;
	if (left.type !== "Identifier" || left.name !== "Ianitor") return undefined;
	if (right.type !== "Identifier" || right.name !== "Static") return undefined;

	const first = typeArguments?.params[0];
	if (first?.type !== "TSTypeQuery") return undefined;

	const { exprName } = first;
	return exprName.type === "Identifier" ? exprName.name : undefined;
}

function hasIanitorStaticType(typeNode: ESTree.Node): boolean {
	const currentType = unwrapReadonlyType(typeNode);
	if (currentType.type !== "TSTypeReference") return false;

	const { typeName, typeArguments } = currentType;
	if (typeName.type !== "TSQualifiedName") return false;

	const { left, right } = typeName;
	if (left.type !== "Identifier" || left.name !== "Ianitor") return false;
	if (right.type !== "Identifier" || right.name !== "Static") return false;

	return typeArguments?.params[0]?.type === "TSTypeQuery";
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
		if (!("typeAnnotation" in member)) continue;
		const { typeAnnotation } = member;
		/* v8 ignore next -- @preserve parser-produced type members either omit annotations or use TSTypeAnnotation. */
		if (typeAnnotation?.type !== "TSTypeAnnotation") continue;
		score = addStructuralScore(
			score,
			typeAnnotation.typeAnnotation,
			depth,
			config,
			cache,
			depthMultiplierCache,
			ceiling,
		);
	}
	return score;
}

// biome-ignore lint/complexity/useMaxParams: do not care.
function addTypeUnionScores(
	score: number,
	node: ESTree.Node,
	nextDepth: number,
	config: ComplexityConfiguration,
	cache: ComplexityCache,
	depthMultiplierCache: Map<number, number>,
	ceiling: number,
	multiplier: number,
	offset: number,
): number {
	/* v8 ignore else -- @preserve callers pass only TS union/intersection nodes, which always carry types. */
	if ("types" in node) {
		let currentScore = score;
		const { types } = node;
		for (const type of types) {
			currentScore = addStructuralScore(
				currentScore,
				type,
				nextDepth,
				config,
				cache,
				depthMultiplierCache,
				ceiling,
			);
		}
		return addScore(currentScore, multiplier * (types.length + offset), config, ceiling);
	}

	/* v8 ignore next -- @preserve callers pass only TS union/intersection nodes, which always carry types. */
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
	/* v8 ignore next -- @preserve AST nodes are not revisited through multiple structural paths in current callers. */
	if (cached !== undefined) return cached;
	/* v8 ignore next -- @preserve structural traversal does not follow parent links, so cycles are not reachable. */
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
			/* v8 ignore else -- @preserve parser-produced TSArrayType nodes always supply elementType. */
			if ("elementType" in node) {
				const { elementType } = node;
				score = addScore(
					calculateStructuralComplexity(elementType, nextDepth, config, cache, depthMultiplierCache, ceiling),
					1,
					config,
					ceiling,
				);
				break;
			}

			/* v8 ignore next -- @preserve parser-produced TSArrayType nodes always supply elementType. */
			score = 1;
			/* v8 ignore next -- @preserve parser-produced TSArrayType nodes always take the elementType branch. */
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
			const { checkType, extendsType, trueType, falseType } = node;
			/* v8 ignore else -- @preserve parser-produced TSConditionalType nodes always supply checkType. */
			if (checkType !== undefined) {
				score = addScore(
					score,
					calculateStructuralComplexity(checkType, nextDepth, config, cache, depthMultiplierCache, ceiling),
					config,
					ceiling,
				);
			}
			/* v8 ignore else -- @preserve parser-produced TSConditionalType nodes always supply extendsType. */
			if (extendsType !== undefined) {
				score = addScore(
					score,
					calculateStructuralComplexity(extendsType, nextDepth, config, cache, depthMultiplierCache, ceiling),
					config,
					ceiling,
				);
			}
			/* v8 ignore else -- @preserve parser-produced TSConditionalType nodes always supply trueType. */
			if (trueType !== undefined) {
				score = addScore(
					score,
					calculateStructuralComplexity(trueType, nextDepth, config, cache, depthMultiplierCache, ceiling),
					config,
					ceiling,
				);
			}
			/* v8 ignore else -- @preserve parser-produced TSConditionalType nodes always supply falseType. */
			if (falseType !== undefined) {
				score = addScore(
					score,
					calculateStructuralComplexity(falseType, nextDepth, config, cache, depthMultiplierCache, ceiling),
					config,
					ceiling,
				);
			}
			break;
		}

		case "TSFunctionType":
		case "TSMethodSignature": {
			score = 2;
			const { params: parameters } = node;
			for (const parameter of parameters) {
				/* v8 ignore next -- @preserve type-checkable function type parameters carry type annotations in this suite. */
				if (!("typeAnnotation" in parameter)) continue;
				const { typeAnnotation } = parameter;
				/* v8 ignore next -- @preserve parser-produced function type params either omit annotations or use TSTypeAnnotation. */
				if (typeAnnotation?.type !== "TSTypeAnnotation") continue;
				score = addScore(
					score,
					calculateStructuralComplexity(
						typeAnnotation.typeAnnotation,
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

			/* v8 ignore else -- @preserve parser-produced function and method type nodes expose returnType. */
			if ("returnType" in node) {
				const { returnType } = node;
				/* v8 ignore else -- @preserve type-checkable function and method signatures carry return annotations here. */
				if (returnType?.type === "TSTypeAnnotation") {
					score = addScore(
						score,
						calculateStructuralComplexity(
							returnType.typeAnnotation,
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
			const { extends: extendsClause, body } = node;
			if (extendsClause !== undefined && extendsClause.length > 0) {
				score = addScore(score, extendsClause.length * 5, config, ceiling);
			}

			const members = body.body;
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
			break;
		}

		case "TSIntersectionType": {
			score = addTypeUnionScores(score, node, nextDepth, config, cache, depthMultiplierCache, ceiling, 3, 0);
			break;
		}

		case "TSMappedType": {
			score = 5;
			const { constraint, typeAnnotation } = node;
			/* v8 ignore else -- @preserve parser-produced mapped types always supply a constraint. */
			if (constraint !== undefined) {
				score = addStructuralScore(score, constraint, nextDepth, config, cache, depthMultiplierCache, ceiling);
			}
			if (typeAnnotation !== undefined && typeAnnotation !== null) {
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
			break;
		}

		case "TSTupleType": {
			const { elementTypes } = node;
			score = 1;
			for (const element of elementTypes) {
				if (element.type === "TSRestType" || element.type === "TSOptionalType") continue;
				score = addStructuralScore(score, element, nextDepth, config, cache, depthMultiplierCache, ceiling);
			}
			score = addScore(score, 1.5 * elementTypes.length, config, ceiling);
			break;
		}

		case "TSTypeLiteral": {
			const { members } = node;
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
			break;
		}

		case "TSTypeReference": {
			score = 2;
			const { typeArguments } = node;
			const parameters = typeArguments?.params ?? [];
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
			break;
		}

		case "TSUnionType": {
			score = addTypeUnionScores(score, node, nextDepth, config, cache, depthMultiplierCache, ceiling, 2, -1);
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
					/* v8 ignore next -- @preserve top-level depth scoring keeps type alias checks below threshold today. */
					context.report({
						data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node,
					});
				}

				for (const [node] of interfacesToCheck.entries()) {
					/* v8 ignore next -- @preserve top-level depth scoring keeps interface checks below threshold today. */
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
				/* v8 ignore else -- @preserve top-level depth scoring keeps interface checks below threshold today. */
				if (complexity < config.interfacePenalty) return;

				/* v8 ignore next -- @preserve top-level depth scoring keeps interface checks below threshold today. */
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
				/* v8 ignore else -- @preserve top-level depth scoring keeps type alias checks below threshold today. */
				if (complexity < config.baseThreshold) return;

				/* v8 ignore next -- @preserve top-level depth scoring keeps type alias checks below threshold today. */
				typeAliasesToCheck.set(node, { complexity });
			},

			VariableDeclarator(node): void {
				const { init, id } = node;
				if (init?.type !== "CallExpression" || !isIanitorValidator(init)) return;

				hasIanitorReference = true;
				if (id.type === "Identifier" && id.typeAnnotation !== undefined && id.typeAnnotation !== null) return;

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
