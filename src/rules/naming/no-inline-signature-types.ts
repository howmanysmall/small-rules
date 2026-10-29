import {
	isCallbackFunction,
	isCallExpression,
	isIdentifier,
	isTsParenthesizedType,
	isTsTypeAnnotation,
	isTsTypeLiteral,
	isTsTypePredicate,
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

import type { FunctionParameter } from "$oxc-utilities/anti-slop/function-parameters";

type SignatureOwner =
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
const DEFAULT_RETURN_TYPES = true;

function isComponentFunction(owner: SignatureOwner): boolean {
	if (isComponentDeclaration(owner)) return true;
	if (!isCallbackFunction(owner)) return false;

	const { parent } = owner;
	if (isCallExpression(parent)) return isReactComponentHigherOrderCall(parent);
	return isVariableDeclarator(parent) && isIdentifier(parent.id) && isUppercaseName(parent.id.name);
}

/**
 * Return the declared return type, looking through a type predicate to the
 * type it narrows to.
 *
 * @param owner - The function or signature.
 * @returns The return type, or `undefined` when there is none to check.
 */
function getReturnType({ returnType }: SignatureOwner): ESTree.TSType | undefined {
	if (!isTsTypeAnnotation(returnType)) return undefined;

	const type = returnType.typeAnnotation;
	if (!isTsTypePredicate(type)) return type;
	return type.typeAnnotation?.typeAnnotation;
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

const noInlineSignatureTypes = createRule("no-inline-signature-types", "naming", {
	createOnce(context): VisitorWithHooks {
		let functions: CheckedFunctions = DEFAULT_FUNCTIONS;
		let position: LiteralPosition = DEFAULT_POSITION;
		let returnTypes = DEFAULT_RETURN_TYPES;

		/**
		 * Report every inline object type in an annotation at the configured
		 * position.
		 *
		 * @param root - The annotated type.
		 * @param parameter - The parameter it annotates, or `undefined` for a
		 *   return type.
		 */
		function checkAnnotation(root: TypeNode, parameter?: FunctionParameter): void {
			const pending: Array<TypeNode> = [root];
			for (const current of pending) {
				if (!isTsTypeLiteral(current)) {
					enqueueNestedTypes(current, position, pending);
					continue;
				}

				if (parameter === undefined) {
					context.report({ messageId: "inlineReturnType", node: current });
					continue;
				}

				context.report({
					data: { parameter: getFunctionParameterBindingName(parameter, context.sourceCode) },
					messageId: "inlineParameterType",
					node: current,
				});
			}
		}

		function checkSignature(owner: SignatureOwner): void {
			if (functions === "components" && !isComponentFunction(owner)) return;

			for (const parameter of owner.params) {
				const annotation = getFunctionParameterTypeAnnotation(parameter);
				if (!isTsTypeAnnotation(annotation)) continue;
				checkAnnotation(annotation.typeAnnotation, parameter);
			}

			if (!returnTypes) return;

			const returnType = getReturnType(owner);
			if (returnType === undefined) return;
			checkAnnotation(returnType);
		}

		return {
			ArrowFunctionExpression: checkSignature,
			before(): void {
				const [options] = context.options;
				functions = options?.functions ?? DEFAULT_FUNCTIONS;
				position = options?.position ?? DEFAULT_POSITION;
				returnTypes = options?.returnTypes ?? DEFAULT_RETURN_TYPES;
			},
			FunctionDeclaration: checkSignature,
			FunctionExpression: checkSignature,
			TSCallSignatureDeclaration: checkSignature,
			TSConstructorType: checkSignature,
			TSConstructSignatureDeclaration: checkSignature,
			TSDeclareFunction: checkSignature,
			TSEmptyBodyFunctionExpression: checkSignature,
			TSFunctionType: checkSignature,
			TSMethodSignature: checkSignature,
		};
	},
	meta: {
		docs: {
			description:
				"Disallow inline object types in parameter and return type annotations; declare a named interface instead.",
		},
		messages: {
			inlineParameterType:
				"Parameter `{{parameter}}` uses an inline object type. Declare a named interface and reference it instead.",
			inlineReturnType:
				"The return type uses an inline object type. Declare a named interface and reference it instead.",
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
					returnTypes: {
						default: DEFAULT_RETURN_TYPES,
						description:
							"Whether to also check return types, including the type in a `value is ...` or `asserts value is ...` predicate",
						type: "boolean",
					},
				},
				type: "object",
			},
		] as const,
		type: "suggestion",
	},
});

export default noInlineSignatureTypes;
