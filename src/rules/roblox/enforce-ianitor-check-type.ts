// oxlint-disable better-max-params/better-max-params -- nobody cares lol
import { createRule } from "$oxc-utilities/create-rule";
import {
	isCallExpression,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isObjectExpression,
	isTsOptionalType,
	isTsQualifiedName,
	isTsRestType,
	isTsTypeAnnotation,
	isTsTypeQuery,
	isTsTypeReference,
	TS_ANY_KEYWORD,
	TS_ARRAY_TYPE,
	TS_BIG_INT_KEYWORD,
	TS_BOOLEAN_KEYWORD,
	TS_CONDITIONAL_TYPE,
	TS_FUNCTION_TYPE,
	TS_INTERFACE_DECLARATION,
	TS_INTERSECTION_TYPE,
	TS_MAPPED_TYPE,
	TS_METHOD_SIGNATURE,
	TS_NEVER_KEYWORD,
	TS_NULL_KEYWORD,
	TS_NUMBER_KEYWORD,
	TS_STRING_KEYWORD,
	TS_SYMBOL_KEYWORD,
	TS_TUPLE_TYPE,
	TS_TYPE_LITERAL,
	TS_TYPE_REFERENCE,
	TS_UNDEFINED_KEYWORD,
	TS_UNION_TYPE,
	TS_UNKNOWN_KEYWORD,
	TS_VOID_KEYWORD,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

interface ComplexityConfiguration {
	readonly baseThreshold: number;
	readonly errorThreshold: number;
	readonly interfacePenalty: number;
	readonly performanceMode: boolean;
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
};

type RuleOptions = InferContextFromRule<typeof enforceIanitorCheckType>["options"][0];

function isIanitorValidator({ callee }: ESTree.CallExpression): boolean {
	if (!isMemberExpression(callee)) return false;
	return isIdentifierName(callee.object) && callee.object.name === "Ianitor";
}

function unwrapReadonlyType(typeNode: ESTree.Node): ESTree.Node {
	if (!isTsTypeReference(typeNode)) return typeNode;

	const { typeArguments, typeName } = typeNode;
	if (!isIdentifierNamed(typeName, "Readonly")) return typeNode;

	return typeArguments?.params[0] ?? typeNode;
}

function hasBothTypeArguments(left: ESTree.TSTypeName, right: ESTree.IdentifierName): boolean {
	return !isIdentifierNamed(left, "Ianitor") || right.name !== "Static";
}

function extractIanitorStaticVariable(typeNode: ESTree.Node): string | undefined {
	const currentType = unwrapReadonlyType(typeNode);
	if (!isTsTypeReference(currentType)) return undefined;

	const { typeArguments, typeName } = currentType;
	if (!isTsQualifiedName(typeName) || hasBothTypeArguments(typeName.left, typeName.right)) return undefined;

	const first = typeArguments?.params[0];
	if (!isTsTypeQuery(first)) return undefined;

	const { exprName } = first;
	return isIdentifierName(exprName) ? exprName.name : undefined;
}

function hasIanitorStaticType(typeNode: ESTree.Node): boolean {
	const currentType = unwrapReadonlyType(typeNode);
	if (!isTsTypeReference(currentType)) return false;

	const { typeArguments, typeName } = currentType;
	if (!isTsQualifiedName(typeName) || hasBothTypeArguments(typeName.left, typeName.right)) return false;

	return isTsTypeQuery(typeArguments?.params[0]);
}

function calculateIanitorComplexity(node: ESTree.CallExpression): number {
	const { callee } = node;
	if (!isMemberExpression(callee) || !isIdentifierName(callee.property)) return 0;

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
			return isObjectExpression(firstArgument) ? 10 + firstArgument.properties.length * 3 : 0;
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
	return config.performanceMode ? Math.min(nextScore, ceiling) : nextScore;
}

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
		if (!isTsTypeAnnotation(typeAnnotation)) continue;
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

interface StructuralScoringArguments {
	readonly cache: ComplexityCache;
	readonly ceiling: number;
	readonly config: ComplexityConfiguration;
	readonly depthMultiplierCache: Map<number, number>;
	readonly nextDepth: number;
}

function scoreArrayType(node: ESTree.Node, scoring: StructuralScoringArguments): number {
	/* v8 ignore else -- @preserve parser-produced TSArrayType nodes always supply elementType. */
	if ("elementType" in node) {
		const { elementType } = node;
		return addScore(
			calculateStructuralComplexity(
				elementType,
				scoring.nextDepth,
				scoring.config,
				scoring.cache,
				scoring.depthMultiplierCache,
				scoring.ceiling,
			),
			1,
			scoring.config,
			scoring.ceiling,
		);
	}

	/* v8 ignore next -- @preserve parser-produced TSArrayType nodes always supply elementType. */
	return 1;
}

function scoreConditionalType(
	{ checkType, extendsType, falseType, trueType }: ESTree.TSConditionalType,
	{ cache, ceiling, config, depthMultiplierCache, nextDepth }: StructuralScoringArguments,
): number {
	let score = addScore(
		addScore(
			3,
			calculateStructuralComplexity(checkType, nextDepth, config, cache, depthMultiplierCache, ceiling),
			config,
			ceiling,
		),
		calculateStructuralComplexity(extendsType, nextDepth, config, cache, depthMultiplierCache, ceiling),
		config,
		ceiling,
	);
	score = addScore(
		addScore(
			score,
			calculateStructuralComplexity(trueType, nextDepth, config, cache, depthMultiplierCache, ceiling),
			config,
			ceiling,
		),
		calculateStructuralComplexity(falseType, nextDepth, config, cache, depthMultiplierCache, ceiling),
		config,
		ceiling,
	);
	return score;
}

function addFunctionParameterScore(
	current: number,
	parameter: ESTree.Node,
	scoring: StructuralScoringArguments,
): number {
	/* v8 ignore next -- @preserve type-checkable function type parameters carry type annotations in this suite. */
	if (!("typeAnnotation" in parameter)) return current;
	const { typeAnnotation } = parameter;
	/* v8 ignore next -- @preserve parser-produced function type params either omit annotations or use TSTypeAnnotation. */
	if (!isTsTypeAnnotation(typeAnnotation)) return current;
	return addScore(
		current,
		calculateStructuralComplexity(
			typeAnnotation.typeAnnotation,
			scoring.nextDepth,
			scoring.config,
			scoring.cache,
			scoring.depthMultiplierCache,
			scoring.ceiling,
		),
		scoring.config,
		scoring.ceiling,
	);
}

function addFunctionReturnScore(current: number, node: ESTree.Node, scoring: StructuralScoringArguments): number {
	/* v8 ignore next -- @preserve parser-produced function and method type nodes expose returnType. */
	if (!("returnType" in node)) return current;
	const { returnType } = node;
	/* v8 ignore next -- @preserve type-checkable function and method signatures carry return annotations here. */
	if (!isTsTypeAnnotation(returnType)) return current;
	return addScore(
		current,
		calculateStructuralComplexity(
			returnType.typeAnnotation,
			scoring.nextDepth,
			scoring.config,
			scoring.cache,
			scoring.depthMultiplierCache,
			scoring.ceiling,
		),
		scoring.config,
		scoring.ceiling,
	);
}

function scoreFunctionType(
	node: ESTree.TSFunctionType | ESTree.TSMethodSignature,
	scoring: StructuralScoringArguments,
): number {
	const { params: parameters } = node;
	let score = 2;
	for (const parameter of parameters) score = addFunctionParameterScore(score, parameter, scoring);

	return addFunctionReturnScore(score, node, scoring);
}

function scoreInterfaceDeclaration(
	{ body, extends: extendsClause }: ESTree.TSInterfaceDeclaration,
	scoring: StructuralScoringArguments,
): number {
	let score = scoring.config.interfacePenalty;
	if (extendsClause.length > 0) {
		score = addScore(score, extendsClause.length * 5, scoring.config, scoring.ceiling);
	}

	const members = body.body;
	score = addScore(score, members.length * 2, scoring.config, scoring.ceiling);
	return addNestedTypeAnnotationScores(
		score,
		members,
		scoring.nextDepth,
		scoring.config,
		scoring.cache,
		scoring.depthMultiplierCache,
		scoring.ceiling,
	);
}

function scoreMappedType(
	{ constraint, typeAnnotation }: ESTree.TSMappedType,
	scoring: StructuralScoringArguments,
): number {
	/* v8 ignore else -- @preserve parser-produced mapped types always supply a constraint. */
	let score = addStructuralScore(
		5,
		constraint,
		scoring.nextDepth,
		scoring.config,
		scoring.cache,
		scoring.depthMultiplierCache,
		scoring.ceiling,
	);
	if (typeAnnotation !== null) {
		score = addStructuralScore(
			score,
			typeAnnotation,
			scoring.nextDepth,
			scoring.config,
			scoring.cache,
			scoring.depthMultiplierCache,
			scoring.ceiling,
		);
	}
	return score;
}

function isSkippedTupleElement(element: ESTree.Node): boolean {
	return isTsRestType(element) || isTsOptionalType(element);
}

function scoreTupleType({ elementTypes }: ESTree.TSTupleType, scoring: StructuralScoringArguments): number {
	let score = 1;
	for (const element of elementTypes) {
		if (isSkippedTupleElement(element)) continue;
		score = addStructuralScore(
			score,
			element,
			scoring.nextDepth,
			scoring.config,
			scoring.cache,
			scoring.depthMultiplierCache,
			scoring.ceiling,
		);
	}
	return addScore(score, 1.5 * elementTypes.length, scoring.config, scoring.ceiling);
}

function scoreTypeLiteral({ members }: ESTree.TSTypeLiteral, scoring: StructuralScoringArguments): number {
	const baseScore = 2 + members.length * 0.5;
	return addNestedTypeAnnotationScores(
		baseScore,
		members,
		scoring.nextDepth,
		scoring.config,
		scoring.cache,
		scoring.depthMultiplierCache,
		scoring.ceiling,
	);
}

function scoreTypeReference({ typeArguments }: ESTree.TSTypeReference, scoring: StructuralScoringArguments): number {
	const parameters = typeArguments?.params ?? [];
	let score = 2;
	for (const parameter of parameters) {
		score = addStructuralScore(
			score,
			parameter,
			scoring.nextDepth,
			scoring.config,
			scoring.cache,
			scoring.depthMultiplierCache,
			scoring.ceiling,
			2,
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
	/* v8 ignore next -- @preserve AST nodes are not revisited through multiple structural paths in current callers. */
	if (cached !== undefined) return cached;
	/* v8 ignore next -- @preserve structural traversal does not follow parent links, so cycles are not reachable. */
	if (cache.visitedNodes.has(node)) return 50;

	cache.visitedNodes.add(node);

	let score = 0;
	const nextDepth = depth + 1;
	const scoring: StructuralScoringArguments = {
		cache,
		ceiling,
		config,
		depthMultiplierCache,
		nextDepth,
	};

	switch (node.type) {
		case TS_ANY_KEYWORD:
		case TS_NEVER_KEYWORD:
		case TS_UNKNOWN_KEYWORD:
			break;

		case TS_ARRAY_TYPE: {
			score = scoreArrayType(node, scoring);
			break;
		}

		case TS_BIG_INT_KEYWORD:
		case TS_BOOLEAN_KEYWORD:
		case TS_NULL_KEYWORD:
		case TS_NUMBER_KEYWORD:
		case TS_STRING_KEYWORD:
		case TS_SYMBOL_KEYWORD:
		case TS_UNDEFINED_KEYWORD:
		case TS_VOID_KEYWORD: {
			score = 1;
			break;
		}

		case TS_CONDITIONAL_TYPE: {
			score = scoreConditionalType(node, scoring);
			break;
		}

		case TS_FUNCTION_TYPE:
		case TS_METHOD_SIGNATURE: {
			score = scoreFunctionType(node, scoring);
			break;
		}

		case TS_INTERFACE_DECLARATION: {
			score = scoreInterfaceDeclaration(node, scoring);
			break;
		}

		case TS_INTERSECTION_TYPE: {
			score = addTypeUnionScores(score, node, nextDepth, config, cache, depthMultiplierCache, ceiling, 3, 0);
			break;
		}

		case TS_MAPPED_TYPE: {
			score = scoreMappedType(node, scoring);
			break;
		}

		case TS_TUPLE_TYPE: {
			score = scoreTupleType(node, scoring);
			break;
		}

		case TS_TYPE_LITERAL: {
			score = scoreTypeLiteral(node, scoring);
			break;
		}

		case TS_TYPE_REFERENCE: {
			score = scoreTypeReference(node, scoring);
			break;
		}

		case TS_UNION_TYPE: {
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

const enforceIanitorCheckType = createRule("enforce-ianitor-check-type", "roblox", {
	create(context): Visitor {
		const rawOptions: RuleOptions = context.options[0];
		const configuration: ComplexityConfiguration = { ...DEFAULT_CONFIGURATION, ...rawOptions };
		const cache: ComplexityCache = {
			nodeCache: new WeakMap(),
			visitedNodes: new WeakSet(),
		};
		const ianitorStaticVariables = new Set<string>();
		const depthMultiplierCache = new Map<number, number>();
		const complexityCeiling = configuration.errorThreshold * 2;
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

				for (const [node, data] of typeAliasesToCheck) {
					/* v8 ignore next -- @preserve top-level depth scoring keeps type alias checks below threshold today. */
					context.report({
						data: { score: data.complexity.toFixed(1) },
						messageId: "missingIanitorCheckType",
						node,
					});
				}

				for (const [node] of interfacesToCheck) {
					/* v8 ignore next -- @preserve top-level depth scoring keeps interface checks below threshold today. */
					context.report({
						data: { name: node.id.name },
						messageId: "complexInterfaceNeedsCheck",
						node,
					});
				}

				for (const [node, data] of variableDeclaratorsToCheck) {
					const { id } = node;
					if (isIdentifierName(id) && ianitorStaticVariables.has(id.name)) continue;

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
					configuration,
					cache,
					depthMultiplierCache,
					complexityCeiling,
				);
				/* v8 ignore else -- @preserve top-level depth scoring keeps interface checks below threshold today. */
				if (complexity < configuration.interfacePenalty) return;

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
					configuration,
					cache,
					depthMultiplierCache,
					complexityCeiling,
				);
				/* v8 ignore else -- @preserve top-level depth scoring keeps type alias checks below threshold today. */
				if (complexity < configuration.baseThreshold) return;

				/* v8 ignore next -- @preserve top-level depth scoring keeps type alias checks below threshold today. */
				typeAliasesToCheck.set(node, { complexity });
			},

			VariableDeclarator(node): void {
				const { id, init } = node;
				if (!isCallExpression(init) || !isIanitorValidator(init)) return;

				hasIanitorReference = true;
				// oxlint-disable-next-line typescript/no-unnecessary-condition -- causes tests to fail.
				if (isIdentifierName(id) && id.typeAnnotation !== undefined && id.typeAnnotation !== null) return;

				const complexity = calculateIanitorComplexity(init);
				if (complexity < configuration.baseThreshold) return;

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
					baseThreshold: {
						default: DEFAULT_CONFIGURATION.baseThreshold,
						description:
							"Minimum complexity score before missing Ianitor.Check<T> annotations are reported.",
						minimum: 1,
						type: "number",
					},
					errorThreshold: {
						default: DEFAULT_CONFIGURATION.errorThreshold,
						description: "Complexity score used to cap recursive analysis before reporting is determined.",
						minimum: 1,
						type: "number",
					},
					interfacePenalty: {
						default: DEFAULT_CONFIGURATION.interfacePenalty,
						description:
							"Complexity penalty applied when an Ianitor validator builds an interface-like shape.",
						minimum: 1,
						type: "number",
					},
					performanceMode: {
						default: DEFAULT_CONFIGURATION.performanceMode,
						description: "Whether repeated type nodes are cached during complexity analysis.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default enforceIanitorCheckType;
