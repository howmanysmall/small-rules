import { Predicate } from "effect";

import type { ESTree, FixFunction } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";

export type FixReturn = ReturnType<FixFunction>;
export type NodeType = ESTree.Node["type"];

const IMPORT_DECLARATION = "ImportDeclaration" as const satisfies NodeType;
const METHOD_DEFINITION = "MethodDefinition" as const satisfies NodeType;
export const PRIVATE_IDENTIFIER = "PrivateIdentifier" as const satisfies NodeType;
const STATIC_BLOCK = "StaticBlock" as const satisfies NodeType;
const TS_ENUM_DECLARATION = "TSEnumDeclaration" as const satisfies NodeType;
const TS_GLOBAL_DECLARATION = "TSModuleDeclaration" as const satisfies NodeType;
const TS_IMPORT_EQUALS_DECLARATION = "TSImportEqualsDeclaration" as const satisfies NodeType;
const TS_MODULE_BLOCK = "TSModuleBlock" as const satisfies NodeType;
const TS_MODULE_DECLARATION = "TSModuleDeclaration" as const satisfies NodeType;
const TS_TYPE_ALIAS_DECLARATION = "TSTypeAliasDeclaration" as const satisfies NodeType;
const TS_TYPE_ANNOTATION = "TSTypeAnnotation" as const satisfies NodeType;
const TS_TYPE_PARAMETER = "TSTypeParameter" as const satisfies NodeType;

export const ACCESSOR_PROPERTY = "AccessorProperty" as const satisfies NodeType;
export const ARRAY_EXPRESSION = "ArrayExpression" as const satisfies NodeType;
export const ARRAY_PATTERN = "ArrayPattern" as const satisfies NodeType;
export const ARROW_FUNCTION_EXPRESSION = "ArrowFunctionExpression" as const satisfies NodeType;
export const ASSIGNMENT_EXPRESSION = "AssignmentExpression" as const satisfies NodeType;
export const ASSIGNMENT_PATTERN = "AssignmentPattern" as const satisfies NodeType;
export const AWAIT_EXPRESSION = "AwaitExpression" as const satisfies NodeType;
export const BINARY_EXPRESSION = "BinaryExpression" as const satisfies NodeType;
export const BLOCK_STATEMENT = "BlockStatement" as const satisfies NodeType;
export const BREAK_STATEMENT = "BreakStatement" as const satisfies NodeType;
export const CALL_EXPRESSION = "CallExpression" as const satisfies NodeType;
export const CATCH_CLAUSE = "CatchClause" as const satisfies NodeType;
export const CHAIN_EXPRESSION = "ChainExpression" as const satisfies NodeType;
export const CLASS_DECLARATION = "ClassDeclaration" as const satisfies NodeType;
export const CLASS_EXPRESSION = "ClassExpression" as const satisfies NodeType;
export const CONDITIONAL_EXPRESSION = "ConditionalExpression" as const satisfies NodeType;
export const DO_WHILE_STATEMENT = "DoWhileStatement" as const satisfies NodeType;
export const EXPRESSION_STATEMENT = "ExpressionStatement" as const satisfies NodeType;
export const FOR_IN_STATEMENT = "ForInStatement" as const satisfies NodeType;
export const FOR_OF_STATEMENT = "ForOfStatement" as const satisfies NodeType;
export const FOR_STATEMENT = "ForStatement" as const satisfies NodeType;
export const FUNCTION_DECLARATION = "FunctionDeclaration" as const satisfies NodeType;
export const FUNCTION_EXPRESSION = "FunctionExpression" as const satisfies NodeType;
export const IDENTIFIER = "Identifier" as const satisfies NodeType;
export const IF_STATEMENT = "IfStatement" as const satisfies NodeType;
export const JSX_ELEMENT = "JSXElement" as const satisfies NodeType;
export const JSX_EMPTY_EXPRESSION = "JSXEmptyExpression" as const satisfies NodeType;
export const JSX_EXPRESSION_CONTAINER = "JSXExpressionContainer" as const satisfies NodeType;
export const JSX_FRAGMENT = "JSXFragment" as const satisfies NodeType;
export const LABELED_STATEMENT = "LabeledStatement" as const satisfies NodeType;
export const LITERAL = "Literal" as const satisfies NodeType;
export const LOGICAL_EXPRESSION = "LogicalExpression" as const satisfies NodeType;
export const MEMBER_EXPRESSION = "MemberExpression" as const satisfies NodeType;
export const NEW_EXPRESSION = "NewExpression" as const satisfies NodeType;
export const OBJECT_EXPRESSION = "ObjectExpression" as const satisfies NodeType;
export const OBJECT_PATTERN = "ObjectPattern" as const satisfies NodeType;
export const PARENTHESIZED_EXPRESSION = "ParenthesizedExpression" as const satisfies NodeType;
export const PROPERTY = "Property" as const satisfies NodeType;
export const PROPERTY_DEFINITION = "PropertyDefinition" as const satisfies NodeType;
export const REST_ELEMENT = "RestElement" as const satisfies NodeType;
export const RETURN_STATEMENT = "ReturnStatement" as const satisfies NodeType;
export const SEQUENCE_EXPRESSION = "SequenceExpression" as const satisfies NodeType;
export const SPREAD_ELEMENT = "SpreadElement" as const satisfies NodeType;
export const SUPER = "Super" as const satisfies NodeType;
export const SWITCH_CASE = "SwitchCase" as const satisfies NodeType;
export const SWITCH_STATEMENT = "SwitchStatement" as const satisfies NodeType;
export const TAGGED_TEMPLATE_EXPRESSION = "TaggedTemplateExpression" as const satisfies NodeType;
export const TEMPLATE_LITERAL = "TemplateLiteral" as const satisfies NodeType;
export const THIS_EXPRESSION = "ThisExpression" as const satisfies NodeType;
export const THROW_STATEMENT = "ThrowStatement" as const satisfies NodeType;
export const TRY_STATEMENT = "TryStatement" as const satisfies NodeType;
export const TS_ANY_KEYWORD = "TSAnyKeyword" as const satisfies NodeType;
export const TS_ARRAY_TYPE = "TSArrayType" as const satisfies NodeType;
export const TS_AS_EXPRESSION = "TSAsExpression" as const satisfies NodeType;
export const TS_BIG_INT_KEYWORD = "TSBigIntKeyword" as const satisfies NodeType;
export const TS_BOOLEAN_KEYWORD = "TSBooleanKeyword" as const satisfies NodeType;
export const TS_CONDITIONAL_TYPE = "TSConditionalType" as const satisfies NodeType;
export const TS_CONSTRUCTOR_TYPE = "TSConstructorType" as const satisfies NodeType;
export const TS_DECLARE_FUNCTION = "TSDeclareFunction" as const satisfies NodeType;
export const TS_EMPTY_BODY_FUNCTION_EXPRESSION = "TSEmptyBodyFunctionExpression" as const satisfies NodeType;
export const TS_FUNCTION_TYPE = "TSFunctionType" as const satisfies NodeType;
export const TS_INSTANTIATION_EXPRESSION = "TSInstantiationExpression" as const satisfies NodeType;
export const TS_INTERFACE_DECLARATION = "TSInterfaceDeclaration" as const satisfies NodeType;
export const TS_INTERSECTION_TYPE = "TSIntersectionType" as const satisfies NodeType;
export const TS_MAPPED_TYPE = "TSMappedType" as const satisfies NodeType;
export const TS_METHOD_SIGNATURE = "TSMethodSignature" as const satisfies NodeType;
export const TS_NEVER_KEYWORD = "TSNeverKeyword" as const satisfies NodeType;
export const TS_NON_NULL_EXPRESSION = "TSNonNullExpression" as const satisfies NodeType;
export const TS_NULL_KEYWORD = "TSNullKeyword" as const satisfies NodeType;
export const TS_NUMBER_KEYWORD = "TSNumberKeyword" as const satisfies NodeType;
export const TS_OBJECT_KEYWORD = "TSObjectKeyword" as const satisfies NodeType;
export const TS_SATISFIES_EXPRESSION = "TSSatisfiesExpression" as const satisfies NodeType;
export const TS_STRING_KEYWORD = "TSStringKeyword" as const satisfies NodeType;
export const TS_SYMBOL_KEYWORD = "TSSymbolKeyword" as const satisfies NodeType;
export const TS_TUPLE_TYPE = "TSTupleType" as const satisfies NodeType;
export const TS_TYPE_ASSERTION = "TSTypeAssertion" as const satisfies NodeType;
export const TS_TYPE_LITERAL = "TSTypeLiteral" as const satisfies NodeType;
export const TS_TYPE_OPERATOR = "TSTypeOperator" as const satisfies NodeType;
export const TS_TYPE_REFERENCE = "TSTypeReference" as const satisfies NodeType;
export const TS_UNDEFINED_KEYWORD = "TSUndefinedKeyword" as const satisfies NodeType;
export const TS_UNION_TYPE = "TSUnionType" as const satisfies NodeType;
export const TS_UNKNOWN_KEYWORD = "TSUnknownKeyword" as const satisfies NodeType;
export const TS_VOID_KEYWORD = "TSVoidKeyword" as const satisfies NodeType;
export const UNARY_EXPRESSION = "UnaryExpression" as const satisfies NodeType;
export const UPDATE_EXPRESSION = "UpdateExpression" as const satisfies NodeType;
export const VARIABLE_DECLARATION = "VariableDeclaration" as const satisfies NodeType;
export const VARIABLE_DECLARATOR = "VariableDeclarator" as const satisfies NodeType;
export const WHILE_STATEMENT = "WhileStatement" as const satisfies NodeType;
export const WITH_STATEMENT = "WithStatement" as const satisfies NodeType;
export const YIELD_EXPRESSION = "YieldExpression" as const satisfies NodeType;
const COMPONENT_NAME_PATTERN = /^[A-Z]/v;
const KEY_OF_NODE = new Set(["end", "loc", "parent", "range", "start", "type"]);

export function isNode(value: unknown): value is ESTree.Node {
	return Predicate.isObject(value) && Predicate.isString(value.type);
}

export type KeyOfNode = "end" | "loc" | "parent" | "range" | "start" | "type";

export function isKeyOfNode(key: string): key is KeyOfNode {
	return KEY_OF_NODE.has(key);
}

export function isComponentName(name: string): boolean {
	return COMPONENT_NAME_PATTERN.test(name);
}

export function isTsArrayType(node: ESTree.Node): node is ESTree.TSArrayType {
	return node.type === TS_ARRAY_TYPE;
}
export function isTsInferType(node: ESTree.Node): node is ESTree.TSInferType {
	return node.type === "TSInferType";
}
export function isTsTypeOperator(node: ESTree.Node): node is ESTree.TSTypeOperator {
	return node.type === TS_TYPE_OPERATOR;
}
export function isTsConditionalType(node: ESTree.Node): node is ESTree.TSConditionalType {
	return node.type === TS_CONDITIONAL_TYPE;
}
export function isTsRestType(node: ESTree.Node): node is ESTree.TSRestType {
	return node.type === "TSRestType";
}
export function isTsTupleType(node: ESTree.Node): node is ESTree.TSTupleType {
	return node.type === TS_TUPLE_TYPE;
}

export function isVariableDeclarator(node?: ESTree.Node | null): node is ESTree.VariableDeclarator {
	return node?.type === VARIABLE_DECLARATOR;
}

export function getTypeAnnotationFromBinding(binding: ESTree.BindingPattern): ESTree.TSTypeAnnotation | undefined {
	return isTsTypeAnnotationUnknown(binding.typeAnnotation) ? binding.typeAnnotation : undefined;
}

export function isTsTypeAnnotation(value?: ESTree.Node | null): value is ESTree.TSTypeAnnotation {
	return value?.type === TS_TYPE_ANNOTATION;
}
export function isTsTypeAnnotationUnknown(value: unknown): value is ESTree.TSTypeAnnotation {
	return Predicate.isObject(value) && value.type === TS_TYPE_ANNOTATION;
}
export function isTsTypeQuery(node?: ESTree.Node | null): node is ESTree.TSTypeQuery {
	return node?.type === "TSTypeQuery";
}
export function isTsIndexSignature(node?: ESTree.Node | null): node is ESTree.TSIndexSignature {
	return node?.type === "TSIndexSignature";
}

export function isTsNumberKeyword(value: ESTree.Node): value is ESTree.TSNumberKeyword {
	return value.type === TS_NUMBER_KEYWORD;
}
export function isTsStringKeyword(value: ESTree.Node): value is ESTree.TSStringKeyword {
	return value.type === TS_STRING_KEYWORD;
}
export function isTsSymbolKeyword(value: ESTree.Node): value is ESTree.TSSymbolKeyword {
	return value.type === TS_SYMBOL_KEYWORD;
}

export function isIdentifierNamed(node: ESTree.Node | null | undefined, name: string): node is ESTree.IdentifierName {
	return node?.type === IDENTIFIER && node.name === name;
}

export function getNamespacedCallNames(
	callee: ESTree.Expression,
): undefined | { readonly objectName: string; readonly propertyName: string } {
	if (
		!isMemberExpression(callee) ||
		callee.computed ||
		callee.object.type !== IDENTIFIER ||
		callee.property.type !== IDENTIFIER
	) {
		return undefined;
	}

	return { objectName: callee.object.name, propertyName: callee.property.name };
}

export function isReactNamedCall(
	node: ESTree.CallExpression,
	identifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
	name: string,
): boolean {
	if (node.callee.type === IDENTIFIER) return identifiers.has(node.callee.name);
	if (!isMemberExpression(node.callee) || node.callee.object.type !== IDENTIFIER) return false;
	return reactNamespaces.has(node.callee.object.name) && getMemberPropertyName(node.callee) === name;
}

export function isUseMemoCall(
	node: ESTree.CallExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	return isReactNamedCall(node, memoIdentifiers, reactNamespaces, "useMemo");
}

export function getImportedName({ imported }: ESTree.ImportSpecifier): string | undefined {
	return imported.type === IDENTIFIER ? imported.name : imported.value;
}

export function hasName(
	node: ESTree.Node,
): node is ESTree.BindingIdentifier | ESTree.IdentifierName | ESTree.IdentifierReference {
	return node.type === IDENTIFIER && Predicate.isString(node.name);
}

export function isIdentifierName(node?: ESTree.Node | null): node is ESTree.IdentifierName {
	return node?.type === IDENTIFIER;
}

export function isJsxIdentifier(node: ESTree.Node): node is ESTree.JSXIdentifier {
	return node.type === "JSXIdentifier" && "name" in node;
}
export function isJsxElement(node?: ESTree.Node | null): node is ESTree.JSXElement {
	return node?.type === JSX_ELEMENT;
}
export function isJsxFragment(node: ESTree.Node): node is ESTree.JSXFragment {
	return node.type === JSX_FRAGMENT;
}
export function isJsxOpeningElement(node: ESTree.Node): node is ESTree.JSXOpeningElement {
	return node.type === "JSXOpeningElement";
}
export function isJsxMemberExpression(node: ESTree.Node): node is ESTree.JSXMemberExpression {
	return node.type === "JSXMemberExpression";
}
export function isJsxSpreadAttribute(node: ESTree.Node): node is ESTree.JSXSpreadAttribute {
	return node.type === "JSXSpreadAttribute";
}
export function isJsxExpressionContainer(node?: ESTree.Node | null): node is ESTree.JSXExpressionContainer {
	return node?.type === JSX_EXPRESSION_CONTAINER;
}
export function isJsxAttribute(node: ESTree.Node): node is ESTree.JSXAttribute {
	return node.type === "JSXAttribute";
}
export function isJsxEmptyExpression(node?: ESTree.Node | null): node is ESTree.JSXEmptyExpression {
	return node?.type === JSX_EMPTY_EXPRESSION;
}
export function isJsxText(node: ESTree.Node): node is ESTree.JSXText {
	return node.type === "JSXText";
}

export function isImportDeclaration(node?: ESTree.Node | null): node is ESTree.ImportDeclaration {
	return node?.type === IMPORT_DECLARATION;
}

type Literal =
	| ESTree.BigIntLiteral
	| ESTree.BooleanLiteral
	| ESTree.NullLiteral
	| ESTree.NumericLiteral
	| ESTree.RegExpLiteral
	| ESTree.StringLiteral;

export function isLiteral(node: ESTree.Node): node is ESTree.TSLiteral {
	return node.type === LITERAL;
}
export function isAnyLiteral(node?: ESTree.Node | null): node is Literal {
	return node?.type === LITERAL;
}
export function isBooleanLiteral(node?: ESTree.Node | null): node is ESTree.BooleanLiteral {
	return isAnyLiteral(node) && Predicate.isBoolean(node.value);
}
export function isNumericLiteral(node: ESTree.Node): node is ESTree.NumericLiteral {
	return isAnyLiteral(node) && Predicate.isNumber(node.value);
}
export function isStringLiteral(node?: ESTree.Node | null): node is ESTree.StringLiteral {
	return isAnyLiteral(node) && Predicate.isString(node.value);
}

export function isCallExpression(node?: ESTree.Node | null): node is ESTree.CallExpression {
	return node?.type === CALL_EXPRESSION;
}

export function isImportSpecifier(node: ESTree.Node): node is ESTree.ImportSpecifier {
	return node.type === "ImportSpecifier";
}

export function isExportSpecifier(node: ESTree.Node): node is ESTree.ExportSpecifier {
	return node.type === "ExportSpecifier";
}

export function isProperty(node: ESTree.Node): node is ESTree.ObjectProperty {
	return node.type === PROPERTY;
}

export function isMemberExpression(node: ESTree.Node): node is ESTree.MemberExpression {
	return node.type === MEMBER_EXPRESSION;
}

export function isAssignmentExpression(node: ESTree.Node): node is ESTree.AssignmentExpression {
	return node.type === ASSIGNMENT_EXPRESSION;
}

export function isUnaryExpression(node?: ESTree.Node | null): node is ESTree.UnaryExpression {
	return node?.type === UNARY_EXPRESSION;
}

export function isSpreadElement(node?: ESTree.Node | null): node is ESTree.SpreadElement {
	return node?.type === SPREAD_ELEMENT;
}

export function isBinaryExpression(node: ESTree.Node): node is ESTree.BinaryExpression {
	return node.type === BINARY_EXPRESSION;
}

export function isLogicalExpression(node: ESTree.Node): node is ESTree.LogicalExpression {
	return node.type === LOGICAL_EXPRESSION;
}

export function isConditionalExpression(node: ESTree.Node): node is ESTree.ConditionalExpression {
	return node.type === CONDITIONAL_EXPRESSION;
}

export function isSequenceExpression(node: ESTree.Node): node is ESTree.SequenceExpression {
	return node.type === SEQUENCE_EXPRESSION;
}

export function isTsUnknownKeyword(node: ESTree.Node): node is ESTree.TSUnknownKeyword {
	return node.type === TS_UNKNOWN_KEYWORD;
}
export function isTsAnyKeyword(node: ESTree.Node): node is ESTree.TSAnyKeyword {
	return node.type === TS_ANY_KEYWORD;
}
export function isTsNeverKeyword(node: ESTree.Node): node is ESTree.TSNeverKeyword {
	return node.type === TS_NEVER_KEYWORD;
}
export function isAccessorProperty(
	node: ESTree.Node,
): node is ESTree.AccessorProperty & { type: typeof ACCESSOR_PROPERTY } {
	return node.type === ACCESSOR_PROPERTY;
}

export function isMethodDefinitionRaw(node?: ESTree.Node | null): node is ESTree.MethodDefinition {
	return node?.type === METHOD_DEFINITION;
}
export function isMethodDefinition(node: ESTree.Node): node is ESTree.MethodDefinition {
	return node.type === METHOD_DEFINITION || node.type === "TSAbstractMethodDefinition";
}

export function isPropertyDefinitionRaw(node?: ESTree.Node | null): node is ESTree.PropertyDefinition {
	return node?.type === PROPERTY_DEFINITION;
}
export function isPropertyDefinition(node: ESTree.Node): node is ESTree.PropertyDefinition {
	return node.type === PROPERTY_DEFINITION || node.type === "TSAbstractPropertyDefinition";
}

export function isTsParenthesizedType(node: ESTree.Node): node is ESTree.TSParenthesizedType {
	return node.type === "TSParenthesizedType";
}
export function isTsOptionalType(node: ESTree.Node): node is ESTree.TSOptionalType {
	return node.type === "TSOptionalType";
}
export function isTsIntersectionType(node: ESTree.Node): node is ESTree.TSIntersectionType {
	return node.type === TS_INTERSECTION_TYPE;
}
export function isTsUnionType(node: ESTree.Node): node is ESTree.TSUnionType {
	return node.type === TS_UNION_TYPE;
}

export function isTsTypePredicate(node?: ESTree.Node | null): node is ESTree.TSTypePredicate {
	return node?.type === "TSTypePredicate";
}
export function isTsTypeParameter(node: ESTree.Node): node is ESTree.TSTypeParameter {
	return node.type === TS_TYPE_PARAMETER;
}

export function isProgram(node?: ESTree.Node | null): node is ESTree.Program {
	return node?.type === "Program";
}

export function isTsMappedType(node: ESTree.Node): node is ESTree.TSMappedType {
	return node.type === TS_MAPPED_TYPE;
}
export function isTsModuleBlock(node: ESTree.Node): node is ESTree.TSModuleBlock {
	return node.type === TS_MODULE_BLOCK;
}
export function isTsModuleDeclaration(node: ESTree.Node): node is ESTree.TSModuleDeclaration {
	return node.type === TS_MODULE_DECLARATION && !node.global;
}
export function isTsGlobalDeclaration(node: ESTree.Node): node is ESTree.TSGlobalDeclaration {
	return node.type === TS_GLOBAL_DECLARATION && node.global;
}
export function isTsTypeLiteral(node: ESTree.Node): node is ESTree.TSTypeLiteral {
	return node.type === TS_TYPE_LITERAL;
}

export function isSuper(node: ESTree.Node): node is ESTree.Super {
	return node.type === SUPER;
}

export function isV8IntrinsicExpression(node: ESTree.Node): node is ESTree.V8IntrinsicExpression {
	return node.type === "V8IntrinsicExpression";
}

export function isTsObjectKeyword(node: ESTree.Node): node is ESTree.TSObjectKeyword {
	return node.type === TS_OBJECT_KEYWORD;
}
export function isImportDefaultSpecifier(node: ESTree.Node): node is ESTree.ImportDefaultSpecifier {
	return node.type === "ImportDefaultSpecifier";
}
export function isTsImportEqualsDeclaration(node: ESTree.Node): node is ESTree.TSImportEqualsDeclaration {
	return node.type === TS_IMPORT_EQUALS_DECLARATION;
}
export function isTsUndefinedKeyword(node: ESTree.Node): node is ESTree.TSUndefinedKeyword {
	return node.type === TS_UNDEFINED_KEYWORD;
}
export function isTsNullKeyword(node: ESTree.Node): node is ESTree.TSNullKeyword {
	return node.type === TS_NULL_KEYWORD;
}
export function isTsTypeAliasDeclaration(node?: ESTree.Node | null): node is ESTree.TSTypeAliasDeclaration {
	return node?.type === TS_TYPE_ALIAS_DECLARATION;
}

export function isParenthesizedExpression(node?: ESTree.Node | null): node is ESTree.ParenthesizedExpression {
	return node?.type === PARENTHESIZED_EXPRESSION;
}

export function isChainExpression(node: ESTree.Node): node is ESTree.ChainExpression {
	return node.type === "ChainExpression";
}
export function isTsInstantiationExpression(node: ESTree.Node): node is ESTree.TSInstantiationExpression {
	return node.type === "TSInstantiationExpression";
}

export function isImportNamespaceSpecifier(node: ESTree.Node): node is ESTree.ImportNamespaceSpecifier {
	return node.type === "ImportNamespaceSpecifier";
}

export function isVariableDeclaration(node?: ESTree.Node | null): node is ESTree.VariableDeclaration {
	return node?.type === VARIABLE_DECLARATION;
}

export function isExportNamedDeclaration(node?: ESTree.Node | null): node is ESTree.ExportNamedDeclaration {
	return node?.type === "ExportNamedDeclaration";
}
export function isExportDefaultDeclaration(node: ESTree.Node): node is ESTree.ExportDefaultDeclaration {
	return node.type === "ExportDefaultDeclaration";
}

export function isNamedGlobalCall(node: ESTree.CallExpression | ESTree.NewExpression, name: string): boolean {
	return isIdentifierNamed(node.callee, name);
}
export function isClassExpression(node: ESTree.Node): node is ESTree.Class & { type: typeof CLASS_EXPRESSION } {
	return node.type === CLASS_EXPRESSION;
}
export function isClassBody(node: ESTree.Node): node is ESTree.ClassBody {
	return node.type === "ClassBody";
}
export function isClass(node: ESTree.Node): node is ESTree.Class {
	return node.type === "ClassDeclaration" || isClassExpression(node);
}
export function isClassDeclaration(node: ESTree.Node): node is ESTree.Class & { type: typeof CLASS_DECLARATION } {
	return node.type === CLASS_DECLARATION;
}
export function isTsPropertySignature(node: ESTree.Node): node is ESTree.TSPropertySignature {
	return node.type === "TSPropertySignature";
}
export function isTsInterfaceDeclaration(node: ESTree.Node): node is ESTree.TSInterfaceDeclaration {
	return node.type === TS_INTERFACE_DECLARATION;
}
export function isTsEnumDeclaration(node: ESTree.Node): node is ESTree.TSEnumDeclaration {
	return node.type === TS_ENUM_DECLARATION;
}

export function isArrowFunctionExpression(node?: ESTree.Node | null): node is ESTree.ArrowFunctionExpression {
	return node?.type === ARROW_FUNCTION_EXPRESSION;
}

export function isFunctionExpression(node?: ESTree.Node | null): node is ESTree.Function {
	return node?.type === FUNCTION_EXPRESSION;
}
export function isFunctionDeclarationRaw(node?: ESTree.Node | null): node is ESTree.Function {
	return node?.type === FUNCTION_DECLARATION;
}
export function isFunctionDeclaration(node?: ESTree.Node | null): node is ESTree.Function {
	return isFunctionDeclarationRaw(node) || isFunctionExpression(node);
}
export function isTsDeclareFunction(node: ESTree.Node): node is ESTree.Function & { type: "TSDeclareFunction" } {
	return node.type === TS_DECLARE_FUNCTION;
}

interface TSEmptyBodyFunctionExpression extends ESTree.Function {
	readonly type: typeof TS_EMPTY_BODY_FUNCTION_EXPRESSION;
}
export function isTsEmptyBodyFunctionExpression(node: ESTree.Node): node is TSEmptyBodyFunctionExpression {
	return node.type === TS_EMPTY_BODY_FUNCTION_EXPRESSION;
}

export function isFunctionLike(node: ESTree.Node): node is ESTree.ArrowFunctionExpression | ESTree.Function {
	return (
		isArrowFunctionExpression(node) ||
		isFunctionDeclaration(node) ||
		isTsDeclareFunction(node) ||
		isTsEmptyBodyFunctionExpression(node)
	);
}

export function isCallbackFunction(node?: ESTree.Node | null): node is CallbackFunction {
	return isArrowFunctionExpression(node) || isFunctionExpression(node);
}
export function isAnyFunction(node?: ESTree.Node | null): node is CallbackFunction {
	return isArrowFunctionExpression(node) || isFunctionDeclaration(node);
}

export function isTsQualifiedName(node: ESTree.Node): node is ESTree.TSQualifiedName {
	return node.type === "TSQualifiedName";
}
export function isTsImportType(node: ESTree.Node): node is ESTree.TSImportType {
	return node.type === "TSImportType";
}
export function isTsIndexedAccessType(node: ESTree.Node): node is ESTree.TSIndexedAccessType {
	return node.type === "TSIndexedAccessType";
}

export function isNewExpression(node?: ESTree.Node | null): node is ESTree.NewExpression {
	return node?.type === NEW_EXPRESSION;
}

export function isArrayExpression(node?: ESTree.Node | null): node is ESTree.ArrayExpression {
	return node?.type === ARRAY_EXPRESSION;
}

export function isObjectExpression(node?: ESTree.Node | null): node is ESTree.ObjectExpression {
	return node?.type === OBJECT_EXPRESSION;
}
export function isAwaitExpression(node: ESTree.Node): node is ESTree.AwaitExpression {
	return node.type === AWAIT_EXPRESSION;
}
export function isYieldExpression(node: ESTree.Node): node is ESTree.YieldExpression {
	return node.type === YIELD_EXPRESSION;
}

export function isObjectPattern(node: ESTree.Node): node is ESTree.ObjectPattern {
	return node.type === OBJECT_PATTERN;
}

export function isTemplateLiteral(node?: ESTree.Node | null): node is ESTree.TemplateLiteral {
	return node?.type === TEMPLATE_LITERAL;
}

export function isExpressionStatement(node?: ESTree.Node | null): node is ESTree.ExpressionStatement {
	return node?.type === EXPRESSION_STATEMENT;
}

export function isTsTypeAssertion(node?: ESTree.Node | null): node is ESTree.TSTypeAssertion {
	return node?.type === TS_TYPE_ASSERTION;
}

export function isTsAsExpression(node?: ESTree.Node | null): node is ESTree.TSAsExpression {
	return node?.type === TS_AS_EXPRESSION;
}

export function isTsSatisfiesExpression(node: ESTree.Node): node is ESTree.TSSatisfiesExpression {
	return node.type === TS_SATISFIES_EXPRESSION;
}

export function isTsNonNullExpression(node: ESTree.Node): node is ESTree.TSNonNullExpression {
	return node.type === TS_NON_NULL_EXPRESSION;
}

export function isAssignmentPattern(node: ESTree.Node): node is ESTree.AssignmentPattern {
	return node.type === ASSIGNMENT_PATTERN;
}

export function isTsParameterProperty(node: ESTree.Node): node is ESTree.TSParameterProperty {
	return node.type === "TSParameterProperty";
}

type RestElement = ESTree.AssignmentTargetRest | ESTree.BindingRestElement | ESTree.FormalParameterRest;

export function isRestElement(node: ESTree.Node): node is RestElement {
	return node.type === REST_ELEMENT;
}

export function isArrayPattern(node?: ESTree.Node | null): node is ESTree.ArrayPattern {
	return node?.type === ARRAY_PATTERN;
}

export function isThisExpression(node: ESTree.Node): node is ESTree.ThisExpression {
	return node.type === THIS_EXPRESSION;
}

export function isUpdateExpression(node: ESTree.Node): node is ESTree.UpdateExpression {
	return node.type === UPDATE_EXPRESSION;
}

export function isStaticRequire(node: ESTree.Node): node is ESTree.CallExpression {
	if (!isCallExpression(node) || node.optional) return false;

	const { callee } = node;
	if (!isIdentifierName(callee) || callee.name !== "require" || node.arguments.length !== 1) return false;

	const [argument] = node.arguments;
	return argument !== undefined && isStringLiteral(argument);
}

export function isBindingIdentifier(node?: ESTree.Node | null): node is ESTree.BindingIdentifier {
	return node?.type === IDENTIFIER;
}

export function isPrivateIdentifier(node: ESTree.Node): node is ESTree.PrivateIdentifier {
	return node.type === PRIVATE_IDENTIFIER;
}

export function isExpressionNode(node: ESTree.Expression | ESTree.PrivateIdentifier): node is ESTree.Expression {
	return node.type !== PRIVATE_IDENTIFIER;
}

export type TypeAssertionExpression = ESTree.TSAsExpression | ESTree.TSTypeAssertion;
export function isTypeAssertionExpression(node: ESTree.Node): node is TypeAssertionExpression {
	return isTsAsExpression(node) || isTsTypeAssertion(node);
}

export function isTsTypeReference(node?: ESTree.Node | null): node is ESTree.TSTypeReference {
	return node?.type === TS_TYPE_REFERENCE;
}
export function isTsLiteralType(node?: ESTree.Node | null): node is ESTree.TSLiteralType {
	return node?.type === "TSLiteralType";
}

export function isIdentifierReference(node: ESTree.Node): node is ESTree.IdentifierReference {
	return node.type === IDENTIFIER;
}

export function isLabeledStatement(node: ESTree.Node): node is ESTree.LabeledStatement {
	return node.type === LABELED_STATEMENT;
}
export function isBlockStatement(node?: ESTree.Node | null): node is ESTree.BlockStatement {
	return node?.type === BLOCK_STATEMENT;
}
export function isStaticBlock(node: ESTree.Node): node is ESTree.StaticBlock {
	return node.type === STATIC_BLOCK;
}
export function isContinueStatement(node: ESTree.Node): node is ESTree.ContinueStatement {
	return node.type === "ContinueStatement";
}
export function isForOfStatement(node: ESTree.Node): node is ESTree.ForOfStatement {
	return node.type === FOR_OF_STATEMENT;
}
export function isBreakStatement(node: ESTree.Node): node is ESTree.BreakStatement {
	return node.type === BREAK_STATEMENT;
}
export function isSwitchStatement(node?: ESTree.Node | null): node is ESTree.SwitchStatement {
	return node?.type === SWITCH_STATEMENT;
}
export function isReturnStatement(node?: ESTree.Node | null): node is ESTree.ReturnStatement {
	return node?.type === RETURN_STATEMENT;
}
export function isThrowStatement(node: ESTree.Node): node is ESTree.ThrowStatement {
	return node.type === THROW_STATEMENT;
}
export function isIfStatement(node?: ESTree.Node | null): node is ESTree.IfStatement {
	return node?.type === IF_STATEMENT;
}
export function isTryStatement(node: ESTree.Node): node is ESTree.TryStatement {
	return node.type === TRY_STATEMENT;
}

export function isSwitchCase(node: ESTree.Node): node is ESTree.SwitchCase {
	return node.type === SWITCH_CASE;
}
export function isCatchClause(node: ESTree.Node): node is ESTree.CatchClause {
	return node.type === CATCH_CLAUSE;
}

const LOOP_TYPES = new Set([DO_WHILE_STATEMENT, FOR_IN_STATEMENT, FOR_OF_STATEMENT, FOR_STATEMENT, WHILE_STATEMENT]);

export type LoopNode =
	| ESTree.DoWhileStatement
	| ESTree.ForInStatement
	| ESTree.ForOfStatement
	| ESTree.ForStatement
	| ESTree.WhileStatement;
export function isLoopNode(node: ESTree.Node): node is LoopNode {
	return LOOP_TYPES.has(node.type);
}

export function isConstAssertion({ typeAnnotation }: TypeAssertionExpression): boolean {
	return (
		isTsTypeReference(typeAnnotation) &&
		isIdentifierReference(typeAnnotation.typeName) &&
		typeAnnotation.typeName.name === "const"
	);
}

export function isEmptyObjectExpression(node: ESTree.Expression): boolean {
	return isObjectExpression(node) && node.properties.length === 0;
}

export function unwrapParenthesizedType(type: ESTree.TSType): ESTree.TSType {
	let current = type;
	while (isTsParenthesizedType(current)) current = current.typeAnnotation;
	return current;
}

export function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
	let current: ESTree.Expression = expression;

	while (true) {
		switch (current.type) {
			case CHAIN_EXPRESSION:
			case PARENTHESIZED_EXPRESSION:
			case TS_AS_EXPRESSION:
			case TS_INSTANTIATION_EXPRESSION:
			case TS_NON_NULL_EXPRESSION:
			case TS_SATISFIES_EXPRESSION:
			case TS_TYPE_ASSERTION: {
				current = current.expression;
				break;
			}

			default:
				return current;
		}
	}
}

export function isNotEmptyStatement(
	statement: ESTree.Statement,
): statement is Exclude<ESTree.Statement, ESTree.EmptyStatement> {
	return statement.type !== "EmptyStatement";
}

export function unwrapParenthesis(expression: ESTree.Expression): ESTree.Expression {
	let current = expression;
	while (isParenthesizedExpression(current)) current = current.expression;
	return current;
}

export function getMemberPropertyName(node: ESTree.MemberExpression): string | undefined {
	if (node.computed) return isStringLiteral(node.property) ? node.property.value : undefined;

	/* v8 ignore next -- @preserve non-computed member properties are parser-provided identifiers. */
	return isBindingIdentifier(node.property) ? node.property.name : undefined;
}

export type AnyImportSpecifier =
	| ESTree.ImportDefaultSpecifier
	| ESTree.ImportNamespaceSpecifier
	| ESTree.ImportSpecifier;
export function isAnyImportSpecifier(node: ESTree.Node): node is AnyImportSpecifier {
	return isImportDefaultSpecifier(node) || isImportNamespaceSpecifier(node) || isImportSpecifier(node);
}

const TRANSPARENT_EXPRESSION_TYPES = new Set<NodeType>([
	PARENTHESIZED_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_TYPE_ASSERTION,
	TS_NON_NULL_EXPRESSION,
] satisfies ReadonlyArray<NodeType>);

type TransparentExpressionNode =
	| ESTree.ParenthesizedExpression
	| ESTree.TSAsExpression
	| ESTree.TSNonNullExpression
	| ESTree.TSSatisfiesExpression
	| ESTree.TSTypeAssertion;
export function isTransparentExpressionNode(node: ESTree.Node): node is TransparentExpressionNode {
	return TRANSPARENT_EXPRESSION_TYPES.has(node.type);
}

const TRANSPARENT_DEPENDENCY_EXPRESSION_TYPES = new Set<NodeType>([
	CHAIN_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	TS_AS_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
] satisfies ReadonlyArray<NodeType>);

type TransparentDependencyExpression =
	| ESTree.ChainExpression
	| ESTree.ParenthesizedExpression
	| ESTree.TSAsExpression
	| ESTree.TSNonNullExpression
	| ESTree.TSSatisfiesExpression
	| ESTree.TSTypeAssertion;
export function isTransparentDependencyExpression(node: ESTree.Node): node is TransparentDependencyExpression {
	return TRANSPARENT_DEPENDENCY_EXPRESSION_TYPES.has(node.type);
}
