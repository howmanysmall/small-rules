import {
	isCallbackFunction,
	isCallExpression,
	isIdentifier,
	isTsParenthesizedType,
	isTsTypeAnnotation,
	isTsTypeLiteral,
	isTsTypeReference,
	isVariableDeclarator,
	TS_ARRAY_TYPE,
	TS_INTERSECTION_TYPE,
	TS_NAMED_TUPLE_MEMBER,
	TS_OPTIONAL_TYPE,
	TS_REST_TYPE,
	TS_TUPLE_TYPE,
	TS_TYPE_OPERATOR,
	TS_UNION_TYPE,
} from "@small-rules/oxlint-utilities";

import {
	getFunctionParameterBindingName,
	getFunctionParameterTypeAnnotation,
} from "$oxc-utilities/anti-slop/function-parameters";
import { isComponentDeclaration, isReactComponentHigherOrderCall } from "$oxc-utilities/component-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isUppercaseName } from "$oxc-utilities/string-utilities";

import type { ESTree, VisitorWithHooks } from "oxlint-plugin-utilities";

type ParameterOwner =
	| ESTree.ArrowFunctionExpression
	| ESTree.Function
	| ESTree.TSCallSignatureDeclaration
	| ESTree.TSConstructorType
	| ESTree.TSConstructSignatureDeclaration
	| ESTree.TSFunctionType
	| ESTree.TSMethodSignature;

type CheckedFunctions = "all" | "components";

type LiteralPosition = "anywhere" | "bare" | "wrapped";

type TypeNode = ESTree.TSTupleElement;

const DEFAULT_FUNCTIONS: CheckedFunctions = "all";
const DEFAULT_POSITION: LiteralPosition = "anywhere";

function isComponentFunction(owner: ParameterOwner): boolean {
	if (isComponentDeclaration(owner)) return true;
	if (!isCallbackFunction(owner)) return false;

	const { parent } = owner;
	if (isCallExpression(parent)) return isReactComponentHigherOrderCall(parent);
	return isVariableDeclarator(parent) && isIdentifier(parent.id) && isUppercaseName(parent.id.name);
}

/**
 * Queue the types a literal may hide behind at the configured position.
 *
 * @param current - The type being inspected.
 * @param position - How far past the annotation's top level to look.
 * @param pending - The worklist to append to.
 */
function enqueueNestedTypes(current: TypeNode, position: LiteralPosition, pending: Array<TypeNode>): void {
	if (isTsParenthesizedType(current)) {
		pending.push(current.typeAnnotation);
		return;
	}

	if (position === "bare") return;

	if (isTsTypeReference(current)) {
		if (current.typeArguments === null) return;

		for (const argument of current.typeArguments.params) {
			pending.push(argument);
		}

		return;
	}

	if (position === "wrapped") return;

	switch (current.type) {
		case TS_ARRAY_TYPE: {
			pending.push(current.elementType);
			break;
		}

		case TS_INTERSECTION_TYPE:
		case TS_UNION_TYPE: {
			for (const member of current.types) {
				pending.push(member);
			}

			break;
		}

		case TS_NAMED_TUPLE_MEMBER: {
			pending.push(current.elementType);
			break;
		}

		case TS_OPTIONAL_TYPE:
		case TS_REST_TYPE:
		case TS_TYPE_OPERATOR: {
			pending.push(current.typeAnnotation);
			break;
		}

		case TS_TUPLE_TYPE: {
			for (const element of current.elementTypes) {
				pending.push(element);
			}

			break;
		}

		default:
			break;
	}
}

const noInlineParameterTypes = createRule("no-inline-parameter-types", "naming", {
	createOnce(context): VisitorWithHooks {
		let functions: CheckedFunctions = DEFAULT_FUNCTIONS;
		let position: LiteralPosition = DEFAULT_POSITION;

		function checkParameters(owner: ParameterOwner): void {
			if (functions === "components" && !isComponentFunction(owner)) return;

			for (const parameter of owner.params) {
				const annotation = getFunctionParameterTypeAnnotation(parameter);
				if (!isTsTypeAnnotation(annotation)) continue;

				const pending: Array<TypeNode> = [annotation.typeAnnotation];
				for (const current of pending) {
					if (!isTsTypeLiteral(current)) {
						enqueueNestedTypes(current, position, pending);
						continue;
					}

					context.report({
						data: { parameter: getFunctionParameterBindingName(parameter, context.sourceCode) },
						messageId: "inlineParameterType",
						node: current,
					});
				}
			}
		}

		return {
			ArrowFunctionExpression: checkParameters,
			before(): void {
				const [options] = context.options;
				functions = options?.functions ?? DEFAULT_FUNCTIONS;
				position = options?.position ?? DEFAULT_POSITION;
			},
			FunctionDeclaration: checkParameters,
			FunctionExpression: checkParameters,
			TSCallSignatureDeclaration: checkParameters,
			TSConstructorType: checkParameters,
			TSConstructSignatureDeclaration: checkParameters,
			TSDeclareFunction: checkParameters,
			TSEmptyBodyFunctionExpression: checkParameters,
			TSFunctionType: checkParameters,
			TSMethodSignature: checkParameters,
		};
	},
	meta: {
		docs: {
			description: "Disallow inline object types in parameter annotations; declare a named interface instead.",
		},
		messages: {
			inlineParameterType:
				"Parameter `{{parameter}}` uses an inline object type. Declare a named interface and reference it instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					functions: {
						default: DEFAULT_FUNCTIONS,
						description:
							"Which functions to check: `all` checks every function and signature; `components` checks only PascalCase function components",
						enum: ["all", "components"] satisfies ReadonlyArray<CheckedFunctions>,
						type: "string",
					},
					position: {
						default: DEFAULT_POSITION,
						description:
							"Where an inline object type is reported: `bare` only as the whole annotation, `wrapped` also inside generic type arguments such as `Readonly<{...}>`, `anywhere` also inside unions, intersections, arrays, and tuples",
						enum: ["anywhere", "bare", "wrapped"] satisfies ReadonlyArray<LiteralPosition>,
						type: "string",
					},
				},
				type: "object",
			},
		] as const,
		type: "suggestion",
	},
});

export default noInlineParameterTypes;
