import { isBoolean, isString } from "@small-rules/arktype-utilities";
import { type } from "arktype";
import { Predicate } from "effect";

import defaultProperties from "$oxc-generated/default-properties.json";
import { createRule } from "$oxc-utilities/create-rule";
import {
	IDENTIFIER,
	isAnyLiteral,
	isAssignmentExpression,
	isBooleanLiteral,
	isCallExpression,
	isExpressionStatement,
	isIdentifierName,
	isIdentifierNamed,
	isJsxEmptyExpression,
	isJsxExpressionContainer,
	isJsxIdentifier,
	isJsxSpreadAttribute,
	isMemberExpression,
	isNewExpression,
	isNumericLiteral,
	isReturnStatement,
	isSpreadElement,
	isStringLiteral,
	isUnaryExpression,
	isVariableDeclaration,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Fix, Fixer, Visitor } from "oxlint-plugin-utilities";
import type { JsonArray, JsonObject, JsonValue } from "type-fest";

const isCanonicalNumericComponent = type("'-inf' | 'inf' | number");
type CanonicalNumericComponent = typeof isCanonicalNumericComponent.infer;

const isCanonicalValue = type({
	enumType: isString,
	type: "'Enum'",
	value: isString,
})
	.or({
		type: "'bool'",
		value: isBoolean,
	})
	.or({
		type: "'CFrame'",
		value: type([
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
		]).readonly(),
	})
	.or({
		type: "'Color3' | 'Vector3'",
		value: type([isCanonicalNumericComponent, isCanonicalNumericComponent, isCanonicalNumericComponent]).readonly(),
	})
	.or({
		type: "'number'",
		value: isCanonicalNumericComponent,
	})
	.or({
		type: "'Rect' | 'UDim2'",
		value: type([
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
			isCanonicalNumericComponent,
		]).readonly(),
	})
	.or({
		type: "'string'",
		value: isString,
	})
	.or({
		type: "'UDim' | 'Vector2'",
		value: type([isCanonicalNumericComponent, isCanonicalNumericComponent]).readonly(),
	})
	.readonly();

// oxlint-disable-next-line jsdoc/empty-tags -- worthless rule.
/** @internal Exported only because it appears in `isDefaultValue`'s signature; not part of the published surface. */
export type CanonicalValue = typeof isCanonicalValue.infer;

const ignoredJsxPropertyNames = new Set(["Name", "Parent"]);
const ignoredJsxPropertyNamesLowercase = new Set(
	Array.from(ignoredJsxPropertyNames, (propertyName) => propertyName.toLowerCase()),
);
const intrinsicClassNamesByTagName = new Map(
	Object.entries(defaultProperties.classes).map(([className]) => [className.toLowerCase(), className]),
);

function createDefaultPropertyLookupEntries(
	properties: Readonly<Record<string, CanonicalValue>>,
): ReadonlyMap<string, DefaultPropertyMatch> {
	const propertyLookupEntries = new Map<string, DefaultPropertyMatch>();

	for (const [propertyName, propertyValue] of Object.entries(properties)) {
		/* v8 ignore next -- @preserve generated default-properties entries are canonical value records. */
		if (!isCanonicalValue.allows(propertyValue)) continue;
		const lowercasePropertyName = propertyName.toLowerCase();
		/* v8 ignore next -- @preserve generated default-properties do not contain duplicate property names differing only by case. */
		if (propertyLookupEntries.has(lowercasePropertyName)) continue;

		propertyLookupEntries.set(lowercasePropertyName, { propertyName, value: propertyValue });
	}

	return propertyLookupEntries;
}

const canonicalValueTypes = [
	"Enum",
	"bool",
	"CFrame",
	"Color3",
	"number",
	"Rect",
	"string",
	"UDim2",
	"UDim",
	"Vector2",
	"Vector3",
] as const;

function decodeCanonicalValue(encodedValue: ReadonlyArray<unknown>): CanonicalValue | undefined {
	const [valueTypeIndex] = encodedValue;
	/* v8 ignore next -- @preserve generated compact values always start with a numeric type index. */
	if (!Predicate.isNumber(valueTypeIndex)) return undefined;

	const valueType = canonicalValueTypes[valueTypeIndex];
	/* v8 ignore next -- @preserve the generator only emits indexes from canonicalValueTypes. */
	if (valueType === undefined) return undefined;

	const candidate =
		valueType === "Enum"
			? { enumType: encodedValue[1], type: valueType, value: encodedValue[2] }
			: { type: valueType, value: encodedValue[1] };
	/* v8 ignore next -- @preserve generated compact values originate from validated canonical values. */
	return isCanonicalValue.allows(candidate) ? candidate : undefined;
}

const intrinsicJsxDefaultOverrides = new Map<string, ReadonlyMap<string, DefaultPropertyMatch>>([
	[
		"TextLabel",
		new Map<string, DefaultPropertyMatch>([
			["text", { propertyName: "Text", value: { type: "string", value: "" } }],
		]),
	],
	[
		"UICorner",
		new Map<string, DefaultPropertyMatch>([
			["cornerradius", { propertyName: "CornerRadius", value: { type: "UDim", value: [0, 0] } }],
		]),
	],
]);

function createClassDefaultPropertyLookups(): ReadonlyMap<string, ReadonlyMap<string, DefaultPropertyMatch>> {
	const lookups = new Map<string, ReadonlyMap<string, DefaultPropertyMatch>>();
	for (const [className, entries] of Object.entries(defaultProperties.classes)) {
		const properties: Record<string, CanonicalValue> = {};
		for (let index = 0; index < entries.length; index += 2) {
			const propertyIndex = entries[index];
			const valueIndex = entries[index + 1];
			/* v8 ignore next -- @preserve the generator emits complete property/value index pairs. */
			if (propertyIndex === undefined || valueIndex === undefined) continue;

			const propertyName = defaultProperties.properties[propertyIndex];
			const encodedValue = defaultProperties.values[valueIndex];
			/* v8 ignore next -- @preserve generated indexes always reference existing dictionary entries. */
			const value = encodedValue === undefined ? undefined : decodeCanonicalValue(encodedValue);
			/* v8 ignore next -- @preserve generated indexes and values are validated during generation. */
			if (propertyName !== undefined && value !== undefined) properties[propertyName] = value;
		}
		lookups.set(className, createDefaultPropertyLookupEntries(properties));
	}
	return lookups;
}

const classDefaultPropertyLookups = createClassDefaultPropertyLookups();

interface TrackedInstance {
	readonly className: string;
}

interface DefaultPropertyMatch {
	readonly propertyName: string;
	readonly value: CanonicalValue;
}

function getIntrinsicClassName(node: ESTree.JSXElementName): string | undefined {
	if (!isJsxIdentifier(node)) return undefined;

	const className = intrinsicClassNamesByTagName.get(node.name.toLowerCase());
	if (className === undefined || node.name === className) return undefined;

	return className;
}

function getJsxAttributeName(node: ESTree.JSXAttributeName): string | undefined {
	return isJsxIdentifier(node) ? node.name : undefined;
}

function getJsxAttributeExpression({ value }: ESTree.JSXAttribute): ESTree.Expression | undefined {
	if (value === null) return undefined;
	if (isAnyLiteral(value)) return value;
	/* v8 ignore next -- @preserve Oxc only produces JSXEmptyExpression here for rejected parse-error cases. */
	if (!isJsxExpressionContainer(value) || isJsxEmptyExpression(value.expression)) return undefined;
	return value.expression;
}

function getPropertyMatch(className: string, propertyName: string): DefaultPropertyMatch | undefined {
	const lowercasePropertyName = propertyName.toLowerCase();

	const intrinsicJsxOverride = intrinsicJsxDefaultOverrides.get(className)?.get(lowercasePropertyName);
	if (intrinsicJsxOverride !== undefined) return intrinsicJsxOverride;

	const classDefaults = classDefaultPropertyLookups.get(className);
	if (classDefaults === undefined) return undefined;

	return classDefaults.get(lowercasePropertyName);
}

function isIgnoredPropertyName(propertyName: string): boolean {
	return ignoredJsxPropertyNamesLowercase.has(propertyName.toLowerCase());
}

function getTrackedInstanceClassName(node: ESTree.Expression): string | undefined {
	const expression = unwrapExpression(node);
	if (!isNewExpression(expression) || !isIdentifierNamed(expression.callee, "Instance")) return undefined;

	const [firstArgument] = expression.arguments;
	if (firstArgument === undefined || isSpreadElement(firstArgument) || !isStringLiteral(firstArgument)) {
		return undefined;
	}

	return firstArgument.value;
}

type IdentifierSearchValue = ESTree.Node | JsonValue | undefined;

function isIdentifierSearchArray(value: IdentifierSearchValue): value is JsonArray {
	return Array.isArray(value);
}

function isIdentifierSearchObject(value: IdentifierSearchValue): value is JsonObject {
	return Predicate.isObject(value);
}

function containsIdentifierReference(
	value: IdentifierSearchValue,
	identifierName: string,
	visitedValues: WeakSet<object> = new WeakSet<object>(),
): boolean {
	if (isIdentifierSearchArray(value)) {
		for (const element of value) {
			if (containsIdentifierReference(element, identifierName, visitedValues)) return true;
		}
		return false;
	}

	if (!isIdentifierSearchObject(value) || visitedValues.has(value)) return false;

	visitedValues.add(value);
	if (value.type === IDENTIFIER && value.name === identifierName) return true;

	for (const nestedValue of Object.values(value)) {
		if (containsIdentifierReference(nestedValue, identifierName, visitedValues)) return true;
	}

	return false;
}

function getMemberPath(node: ESTree.Expression): ReadonlyArray<string> | undefined {
	const path = new Array<string>();
	let current: ESTree.Expression = node;

	while (isMemberExpression(current)) {
		if (current.computed || !isIdentifierName(current.property)) return undefined;

		path.unshift(current.property.name);

		const { object } = current;
		if (isIdentifierName(object)) {
			path.unshift(object.name);
			return path;
		}

		/* v8 ignore next -- @preserve member paths inspected by default-value matching are identifier-rooted member chains. */
		if (!isMemberExpression(object)) return undefined;
		current = object;
	}

	if (isIdentifierName(current)) {
		path.unshift(current.name);
		return path;
	}

	return undefined;
}

function isMathHuge(node: ESTree.Expression): boolean {
	const path = getMemberPath(node);
	return path?.length === 2 && path[0] === "math" && path[1] === "huge";
}

function normalizeCanonicalNumber(component: CanonicalNumericComponent): number {
	if (component === "inf") return Number.POSITIVE_INFINITY;
	if (component === "-inf") return Number.NEGATIVE_INFINITY;
	return component;
}

function matchesComponentValue(expected: CanonicalNumericComponent, actual: number): boolean {
	return normalizeCanonicalNumber(expected) === actual;
}

function matchesTuple(expected: ReadonlyArray<CanonicalNumericComponent>, actual: ReadonlyArray<number>): boolean {
	/* v8 ignore next -- @preserve tuple extractors only produce tuples with the same arity as their canonical defaults. */
	if (expected.length !== actual.length) return false;

	for (const [index, expectedComponent] of expected.entries()) {
		const actualComponent = actual[index];
		/* v8 ignore next -- @preserve tuple iteration over canonical defaults and extracted tuples yields defined components. */
		if (actualComponent === undefined || !matchesComponentValue(expectedComponent, actualComponent)) return false;
	}

	return true;
}

function extractNumberValue(node: ESTree.Expression): number | undefined {
	if (isNumericLiteral(node)) return node.value;
	if (isMathHuge(node)) return Number.POSITIVE_INFINITY;

	if (!isUnaryExpression(node)) return undefined;
	if (node.operator !== "+" && node.operator !== "-") return undefined;

	const argumentValue = extractNumberValue(node.argument);
	if (argumentValue === undefined) return undefined;

	return node.operator === "+" ? argumentValue : -argumentValue;
}

function extractPair(
	argumentsList: ReadonlyArray<ESTree.Expression | ESTree.SpreadElement>,
): readonly [first: ESTree.Expression, second: ESTree.Expression] | undefined {
	if (argumentsList.length !== 2) return undefined;

	const [first, second] = argumentsList;
	if (first === undefined || second === undefined || isSpreadElement(first) || isSpreadElement(second)) {
		return undefined;
	}

	return [first, second];
}

function extractTriple(
	argumentsList: ReadonlyArray<ESTree.Expression | ESTree.SpreadElement>,
): readonly [first: ESTree.Expression, second: ESTree.Expression, third: ESTree.Expression] | undefined {
	if (argumentsList.length !== 3) return undefined;

	const [first, second, third] = argumentsList;
	if (
		first === undefined ||
		second === undefined ||
		third === undefined ||
		isSpreadElement(first) ||
		isSpreadElement(second) ||
		isSpreadElement(third)
	) {
		return undefined;
	}

	return [first, second, third];
}

function extractQuadruple(
	argumentsList: ReadonlyArray<ESTree.Expression | ESTree.SpreadElement>,
):
	| readonly [
			first: ESTree.Expression,
			second: ESTree.Expression,
			third: ESTree.Expression,
			fourth: ESTree.Expression,
	  ]
	| undefined {
	if (argumentsList.length !== 4) return undefined;

	const [first, second, third, fourth] = argumentsList;
	if (
		first === undefined ||
		second === undefined ||
		third === undefined ||
		fourth === undefined ||
		isSpreadElement(first) ||
		isSpreadElement(second) ||
		isSpreadElement(third) ||
		isSpreadElement(fourth)
	) {
		return undefined;
	}

	return [first, second, third, fourth];
}

function extractVectorComponents<TValue extends ReadonlyArray<number>>(
	node: ESTree.Expression,
	className: string,
	zeroValue: TValue,
	extractor: (parameters: ESTree.NewExpression["arguments"]) => TValue | undefined,
): TValue | undefined {
	if (isMemberExpression(node)) {
		const path = getMemberPath(node);
		if (path?.length === 2 && path[0] === className && path[1] === "zero") return zeroValue;
		return undefined;
	}

	if (!isNewExpression(node) || !isIdentifierNamed(node.callee, className)) return undefined;
	if (node.arguments.length === 0) return zeroValue;

	return extractor(node.arguments);
}

function extractVector2Value(node: ESTree.Expression): readonly [x: number, y: number] | undefined {
	return extractVectorComponents(node, "Vector2", [0, 0], extractNumberPair);
}

function extractNumberPair(
	argumentsList: ESTree.NewExpression["arguments"],
): readonly [first: number, second: number] | undefined {
	const components = extractPair(argumentsList);
	if (components === undefined) return undefined;

	const [firstNode, secondNode] = components;
	const first = extractNumberValue(firstNode);
	const second = extractNumberValue(secondNode);
	if (first === undefined || second === undefined) return undefined;

	return [first, second];
}

function extractNumberTriple(
	argumentsList: ESTree.NewExpression["arguments"],
): readonly [x: number, y: number, z: number] | undefined {
	const components = extractTriple(argumentsList);
	if (components === undefined) return undefined;

	const [xNode, yNode, zNode] = components;
	const x = extractNumberValue(xNode);
	const y = extractNumberValue(yNode);
	const z = extractNumberValue(zNode);
	if (x === undefined || y === undefined || z === undefined) return undefined;

	return [x, y, z];
}

function extractVector3Value(node: ESTree.Expression): readonly [x: number, y: number, z: number] | undefined {
	return extractVectorComponents(node, "Vector3", [0, 0, 0], extractNumberTriple);
}

function extractUDimValue(node: ESTree.Expression): readonly [scale: number, offset: number] | undefined {
	if (!isNewExpression(node) || !isIdentifierNamed(node.callee, "UDim")) return undefined;
	if (node.arguments.length === 0) return [0, 0];

	return extractNumberPair(node.arguments);
}

function extractNumberQuadruple(
	argumentsList: ESTree.NewExpression["arguments"],
): readonly [first: number, second: number, third: number, fourth: number] | undefined {
	const components = extractQuadruple(argumentsList);
	if (components === undefined) return undefined;

	const [firstNode, secondNode, thirdNode, fourthNode] = components;
	const first = extractNumberValue(firstNode);
	const second = extractNumberValue(secondNode);
	const third = extractNumberValue(thirdNode);
	const fourth = extractNumberValue(fourthNode);
	if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
		return undefined;
	}

	return [first, second, third, fourth];
}

function extractUDim2Value(
	node: ESTree.Expression,
): readonly [scaleX: number, offsetX: number, scaleY: number, offsetY: number] | undefined {
	if (isCallExpression(node)) {
		const path = getMemberPath(node.callee);
		const components = extractNumberPair(node.arguments);
		if (path === undefined || components === undefined) return undefined;

		const [first, second] = components;
		if (path.length === 2 && path[0] === "UDim2" && path[1] === "fromOffset") return [0, first, 0, second];
		if (path.length === 2 && path[0] === "UDim2" && path[1] === "fromScale") return [first, 0, second, 0];
		return undefined;
	}

	if (!isNewExpression(node) || !isIdentifierNamed(node.callee, "UDim2")) return undefined;
	if (node.arguments.length === 0) return [0, 0, 0, 0];

	return extractNumberQuadruple(node.arguments);
}

function extractRectValue(
	node: ESTree.Expression,
): readonly [minimumX: number, minimumY: number, maximumX: number, maximumY: number] | undefined {
	if (!isNewExpression(node) || !isIdentifierNamed(node.callee, "Rect")) return undefined;
	if (node.arguments.length === 0) return [0, 0, 0, 0];

	return extractNumberQuadruple(node.arguments);
}

function extractRGBFromComponents(
	components: readonly [ESTree.Expression, ESTree.Expression, ESTree.Expression],
): readonly [red: number, green: number, blue: number] | undefined {
	const [redNode, greenNode, blueNode] = components;
	const red = extractNumberValue(redNode);
	const green = extractNumberValue(greenNode);
	const blue = extractNumberValue(blueNode);
	if (red === undefined || green === undefined || blue === undefined) return undefined;

	return [red, green, blue];
}

function extractColor3Value(node: ESTree.Expression): readonly [red: number, green: number, blue: number] | undefined {
	if (isCallExpression(node)) {
		const path = getMemberPath(node.callee);
		const components = extractTriple(node.arguments);
		if (components === undefined || path?.length !== 2 || path[0] !== "Color3" || path[1] !== "fromRGB") {
			return undefined;
		}

		const rgb = extractRGBFromComponents(components);
		if (rgb === undefined) return undefined;

		const [red, green, blue] = rgb;
		return [Math.fround(red / 255), Math.fround(green / 255), Math.fround(blue / 255)];
	}

	if (!isNewExpression(node) || !isIdentifierNamed(node.callee, "Color3")) return undefined;
	if (node.arguments.length === 0) return [0, 0, 0];

	const components = extractTriple(node.arguments);
	if (components === undefined) return undefined;

	return extractRGBFromComponents(components);
}

function extractCFrameValue(
	node: ESTree.Expression,
):
	| readonly [
			x: number,
			y: number,
			z: number,
			r00: number,
			r01: number,
			r02: number,
			r10: number,
			r11: number,
			r12: number,
			r20: number,
			r21: number,
			r22: number,
	  ]
	| undefined {
	if (!isNewExpression(node) || !isIdentifierNamed(node.callee, "CFrame")) return undefined;
	if (node.arguments.length === 0) return [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];

	const position = extractNumberTriple(node.arguments);
	if (position === undefined) return undefined;
	const [x, y, z] = position;
	return [x, y, z, 1, 0, 0, 0, 1, 0, 0, 0, 1];
}

function extractEnumValue(node: ESTree.Expression): undefined | { readonly enumType: string; readonly value: string } {
	const path = getMemberPath(node);
	if (path?.length !== 3 || path[0] !== "Enum") return undefined;

	const [, enumType, value] = path;
	/* v8 ignore next -- @preserve length-three enum member paths always contain enum type and value segments. */
	if (enumType === undefined || value === undefined) return undefined;

	return { enumType, value };
}

type GetCanonicalValue<TType extends CanonicalValue["type"]> = Extract<CanonicalValue, { type: TType }>;

type IsDefaultValues = {
	readonly [TType in CanonicalValue["type"]]: (
		node: ESTree.Expression,
		canonicalValue: GetCanonicalValue<TType>,
	) => boolean;
};
type CanonicalValue2d = GetCanonicalValue<"UDim" | "Vector2">;
type CanonicalValue3d = GetCanonicalValue<"Color3" | "Vector3">;
type CanonicalValue4d = GetCanonicalValue<"Rect" | "UDim2">;

const IS_DEFAULT_VALUES = {
	bool(node: ESTree.Expression, canonicalValue: CanonicalValue): boolean {
		return isBooleanLiteral(node) && node.value === canonicalValue.value;
	},
	CFrame(node: ESTree.Expression, canonicalValue: GetCanonicalValue<"CFrame">): boolean {
		const actual = extractCFrameValue(node);
		return actual !== undefined && matchesTuple(canonicalValue.value, actual);
	},
	Color3(node: ESTree.Expression, canonicalValue: CanonicalValue3d): boolean {
		const actual = extractColor3Value(node);
		return (
			actual !== undefined &&
			actual[0] === canonicalValue.value[0] &&
			actual[1] === canonicalValue.value[1] &&
			actual[2] === canonicalValue.value[2]
		);
	},
	Enum(node: ESTree.Expression, canonicalValue: GetCanonicalValue<"Enum">): boolean {
		const actual = extractEnumValue(node);
		return (
			actual !== undefined && actual.enumType === canonicalValue.enumType && actual.value === canonicalValue.value
		);
	},
	number(node: ESTree.Expression, canonicalValue: GetCanonicalValue<"number">): boolean {
		const actual = extractNumberValue(node);
		return actual !== undefined && matchesComponentValue(canonicalValue.value, actual);
	},
	Rect(node: ESTree.Expression, canonicalValue: CanonicalValue4d): boolean {
		const actual = extractRectValue(node);
		return actual !== undefined && matchesTuple(canonicalValue.value, actual);
	},
	string(node: ESTree.Expression, canonicalValue: GetCanonicalValue<"string">): boolean {
		return isStringLiteral(node) && node.value === canonicalValue.value;
	},
	UDim(node: ESTree.Expression, canonicalValue: CanonicalValue2d): boolean {
		const actual = extractUDimValue(node);
		return actual !== undefined && matchesTuple(canonicalValue.value, actual);
	},
	UDim2(node: ESTree.Expression, canonicalValue: CanonicalValue4d): boolean {
		const actual = extractUDim2Value(node);
		return actual !== undefined && matchesTuple(canonicalValue.value, actual);
	},
	Vector2(node: ESTree.Expression, canonicalValue: CanonicalValue2d): boolean {
		const actual = extractVector2Value(node);
		return actual !== undefined && matchesTuple(canonicalValue.value, actual);
	},
	Vector3(node: ESTree.Expression, canonicalValue: CanonicalValue3d): boolean {
		const actual = extractVector3Value(node);
		return actual !== undefined && matchesTuple(canonicalValue.value, actual);
	},
} satisfies IsDefaultValues;

// oxlint-disable-next-line jsdoc-js/require-description jsdoc/empty-tags -- I hate you lol
/** @internal Exported for unit tests; not part of the published surface. */
// oxlint-disable-next-line jsdoc/require-returns jsdoc/require-param -- shut up
export function isDefaultValue(node: ESTree.Expression, canonicalValue: CanonicalValue): boolean {
	switch (canonicalValue.type) {
		case "bool":
			return IS_DEFAULT_VALUES.bool(node, canonicalValue);

		case "CFrame":
			return IS_DEFAULT_VALUES.CFrame(node, canonicalValue);

		case "Color3":
			return IS_DEFAULT_VALUES.Color3(node, canonicalValue);

		case "Enum":
			return IS_DEFAULT_VALUES.Enum(node, canonicalValue);

		case "number":
			return IS_DEFAULT_VALUES.number(node, canonicalValue);

		case "Rect":
			return IS_DEFAULT_VALUES.Rect(node, canonicalValue);

		case "string":
			return IS_DEFAULT_VALUES.string(node, canonicalValue);

		case "UDim":
			return IS_DEFAULT_VALUES.UDim(node, canonicalValue);

		case "UDim2":
			return IS_DEFAULT_VALUES.UDim2(node, canonicalValue);

		case "Vector2":
			return IS_DEFAULT_VALUES.Vector2(node, canonicalValue);

		case "Vector3":
			return IS_DEFAULT_VALUES.Vector3(node, canonicalValue);

		default:
			return false;
	}
}

function isBooleanShorthandDefault(attribute: ESTree.JSXAttribute, propertyMatch: DefaultPropertyMatch): boolean {
	return attribute.value === null && propertyMatch.value.type === "bool" && propertyMatch.value.value;
}

function isDefaultAttributeValue(attribute: ESTree.JSXAttribute, propertyMatch: DefaultPropertyMatch): boolean {
	const expression = getJsxAttributeExpression(attribute);
	return expression !== undefined && isDefaultValue(expression, propertyMatch.value);
}

function isUselessDefaultAttribute(attribute: ESTree.JSXAttribute, propertyMatch: DefaultPropertyMatch): boolean {
	return isBooleanShorthandDefault(attribute, propertyMatch) || isDefaultAttributeValue(attribute, propertyMatch);
}

const noUselessDefault = createRule("no-useless-default", "roblox", {
	create(context): Visitor {
		const { sourceCode } = context;

		function hasCommentsAroundNode(node: ESTree.Node): boolean {
			return (
				sourceCode.getCommentsBefore(node).length > 0 ||
				sourceCode.getCommentsAfter(node).length > 0 ||
				sourceCode.getCommentsInside(node).length > 0
			);
		}

		function createExpressionStatementRemovalFix(
			statementNode: ESTree.ExpressionStatement,
		): ((fixer: Fixer) => Fix) | undefined {
			const previousToken = sourceCode.getTokenBefore(statementNode);
			const nextToken = sourceCode.getTokenAfter(statementNode);
			if (hasCommentsAroundNode(statementNode)) return undefined;

			/* v8 ignore next 3 -- @preserve SourceCode reports adjacent comments through getCommentsBefore/After before this defensive token-between check. */
			if (previousToken !== null && sourceCode.commentsExistBetween(previousToken, statementNode)) {
				return undefined;
			}
			/* v8 ignore next -- @preserve SourceCode reports adjacent comments through getCommentsAfter before this defensive token-between check. */
			if (nextToken !== null && sourceCode.commentsExistBetween(statementNode, nextToken)) return undefined;

			let [start] = statementNode.range;
			while (start > 0) {
				const previousCharacter = sourceCode.text[start - 1];
				if (previousCharacter === " " || previousCharacter === "\t") {
					start -= 1;
					continue;
				}

				break;
			}

			return (fixer: Fixer): Fix => fixer.removeRange([start, statementNode.range[1]]);
		}

		function createJsxAttributeRemovalFix(
			node: ESTree.JSXOpeningElement,
			attribute: ESTree.JSXAttribute,
		): ((fixer: Fixer) => Fix) | undefined {
			if (node.attributes.some(isJsxSpreadAttribute)) return undefined;

			const previousToken = sourceCode.getTokenBefore(attribute);
			/* v8 ignore next -- @preserve JSX attributes always have a preceding token in their opening element. */
			if (previousToken === null || hasCommentsAroundNode(attribute)) return undefined;
			/* v8 ignore next -- @preserve SourceCode reports adjacent JSX comments through getCommentsBefore before this defensive token-between check. */
			if (sourceCode.commentsExistBetween(previousToken, attribute)) return undefined;

			const nextToken = sourceCode.getTokenAfter(attribute);
			/* v8 ignore next -- @preserve SourceCode reports adjacent JSX comments through getCommentsAfter before this defensive token-between check. */
			if (nextToken !== null && sourceCode.commentsExistBetween(attribute, nextToken)) return undefined;

			return (fixer: Fixer): Fix => fixer.removeRange([previousToken.range[1], attribute.range[1]]);
		}

		function reportUselessDefaultAssignment(
			statementNode: ESTree.ExpressionStatement,
			assignmentExpression: ESTree.AssignmentExpression,
			trackedInstances: ReadonlyMap<string, TrackedInstance>,
		): void {
			if (
				assignmentExpression.operator !== "=" ||
				!isMemberExpression(assignmentExpression.left) ||
				assignmentExpression.left.computed ||
				!isIdentifierName(assignmentExpression.left.object) ||
				!isIdentifierName(assignmentExpression.left.property)
			) {
				return;
			}

			const trackedInstance = trackedInstances.get(assignmentExpression.left.object.name);
			if (trackedInstance === undefined) return;

			const propertyName = assignmentExpression.left.property.name;
			if (isIgnoredPropertyName(propertyName)) return;

			const propertyMatch = getPropertyMatch(trackedInstance.className, propertyName);
			if (propertyMatch === undefined || !isDefaultValue(assignmentExpression.right, propertyMatch.value)) return;

			const fix = createExpressionStatementRemovalFix(statementNode);
			if (fix === undefined) {
				context.report({
					data: { className: trackedInstance.className, propertyName: propertyMatch.propertyName },
					messageId: "uselessDefault",
					node: assignmentExpression.left,
				});
				return;
			}

			context.report({
				data: { className: trackedInstance.className, propertyName: propertyMatch.propertyName },
				fix,
				messageId: "uselessDefault",
				node: assignmentExpression.left,
			});
		}

		function clearTrackedInstancesForCallExpression(
			callExpression: ESTree.CallExpression,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			for (const [identifierName] of trackedInstances) {
				for (const argument of callExpression.arguments) {
					if (isSpreadElement(argument)) continue;
					/* v8 ignore next -- @preserve call-expression escape checks are only needed for arguments that reference tracked instances. */
					if (!containsIdentifierReference(argument, identifierName)) continue;

					trackedInstances.delete(identifierName);
					break;
				}
			}
		}

		function clearTrackedInstancesForEscapeAssignment(
			assignmentExpression: ESTree.AssignmentExpression,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			if (!isIdentifierName(assignmentExpression.left) && !isMemberExpression(assignmentExpression.left)) return;

			for (const [identifierName] of trackedInstances) {
				/* v8 ignore next -- @preserve escape assignments only clear tracked instances when the right-hand side references them. */
				if (!containsIdentifierReference(assignmentExpression.right, identifierName)) continue;
				trackedInstances.delete(identifierName);
			}
		}

		function clearTrackedInstancesForReturnStatement(
			returnStatement: ESTree.ReturnStatement,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			if (returnStatement.argument === null) return;

			for (const [identifierName] of trackedInstances) {
				/* v8 ignore next -- @preserve return statements only clear tracked instances when returning the tracked value. */
				if (!containsIdentifierReference(returnStatement.argument, identifierName)) continue;
				trackedInstances.delete(identifierName);
			}
		}

		function inspectStatementNodes(statementNodes: ReadonlyArray<ESTree.Node>): void {
			const trackedInstances = new Map<string, TrackedInstance>();
			for (const statementNode of statementNodes) inspectStatementNode(statementNode, trackedInstances);
		}

		function inspectStatementNode(
			statementNode: ESTree.Node,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			if (isExpressionStatement(statementNode)) {
				inspectExpressionStatement(statementNode, trackedInstances);
				return;
			}

			if (isReturnStatement(statementNode)) {
				clearTrackedInstancesForReturnStatement(statementNode, trackedInstances);
				return;
			}

			if (isVariableDeclaration(statementNode)) trackConstInstances(statementNode, trackedInstances);
		}

		function inspectExpressionStatement(
			statementNode: ESTree.ExpressionStatement,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			const expression = unwrapExpression(statementNode.expression);

			if (isAssignmentExpression(expression)) {
				reportUselessDefaultAssignment(statementNode, expression, trackedInstances);
				clearTrackedInstancesForEscapeAssignment(expression, trackedInstances);
				return;
			}

			if (isCallExpression(expression)) clearTrackedInstancesForCallExpression(expression, trackedInstances);
		}

		function trackConstInstances(
			statementNode: ESTree.VariableDeclaration,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			if (statementNode.kind !== "const") return;

			for (const declaration of statementNode.declarations) {
				if (!isIdentifierName(declaration.id) || declaration.init === null) continue;

				const className = getTrackedInstanceClassName(declaration.init);
				if (className === undefined) continue;

				trackedInstances.set(declaration.id.name, { className });
			}
		}

		function getUselessPropertyMatch(
			attribute: ESTree.JSXAttribute,
			className: string,
		): DefaultPropertyMatch | undefined {
			const propertyName = getJsxAttributeName(attribute.name);
			if (propertyName === undefined || isIgnoredPropertyName(propertyName)) return undefined;

			const propertyMatch = getPropertyMatch(className, propertyName);
			if (propertyMatch === undefined || !isUselessDefaultAttribute(attribute, propertyMatch)) {
				return undefined;
			}

			return propertyMatch;
		}

		function reportUselessJsxAttribute(
			node: ESTree.JSXOpeningElement,
			attribute: ESTree.JSXAttribute,
			className: string,
		): void {
			const propertyMatch = getUselessPropertyMatch(attribute, className);
			if (propertyMatch === undefined) return;

			const fix = createJsxAttributeRemovalFix(node, attribute);
			if (fix === undefined) {
				context.report({
					data: { className, propertyName: propertyMatch.propertyName },
					messageId: "uselessDefault",
					node: attribute,
				});
				return;
			}

			context.report({
				data: { className, propertyName: propertyMatch.propertyName },
				fix,
				messageId: "uselessDefault",
				node: attribute,
			});
		}

		return {
			BlockStatement(node): void {
				inspectStatementNodes(node.body);
			},
			JSXOpeningElement(node): void {
				const className = getIntrinsicClassName(node.name);
				if (className === undefined) return;

				for (const attribute of node.attributes) {
					if (isJsxSpreadAttribute(attribute)) continue;
					reportUselessJsxAttribute(node, attribute, className);
				}
			},
			Program(node): void {
				inspectStatementNodes(node.body);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow Roblox JSX properties whose values already match the class defaults.",
		},
		fixable: "code",
		messages: {
			uselessDefault: 'Remove "{{propertyName}}" from {{className}}. It already matches the default value.',
		},
		schema: [],
		type: "suggestion",
	},
});

export default noUselessDefault;
