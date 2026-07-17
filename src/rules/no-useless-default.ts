import { isNumericLiteral, isStringLiteral } from "$oxc-utilities/oxc-utilities";
import { isNumberRaw, isRecord, isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import defaultProperties from "../generated/default-properties.json";
import { unwrapExpression } from "../utilities/ast-utilities";

import type { ESTree, Fix, Fixer, Visitor } from "oxlint-plugin-utilities";

type CanonicalNumericComponent = "-inf" | "inf" | number;

type Vector2CanonicalValue = readonly [x: CanonicalNumericComponent, y: CanonicalNumericComponent];
type Vector3CanonicalValue = readonly [
	x: CanonicalNumericComponent,
	y: CanonicalNumericComponent,
	z: CanonicalNumericComponent,
];
type UDimCanonicalValue = readonly [scale: CanonicalNumericComponent, offset: CanonicalNumericComponent];
type UDim2CanonicalValue = readonly [
	scaleX: CanonicalNumericComponent,
	offsetX: CanonicalNumericComponent,
	scaleY: CanonicalNumericComponent,
	offsetY: CanonicalNumericComponent,
];
type RectCanonicalValue = readonly [
	minimumX: CanonicalNumericComponent,
	minimumY: CanonicalNumericComponent,
	maximumX: CanonicalNumericComponent,
	maximumY: CanonicalNumericComponent,
];
type Color3CanonicalValue = readonly [red: number, green: number, blue: number];
type CFrameCanonicalValue = readonly [
	x: CanonicalNumericComponent,
	y: CanonicalNumericComponent,
	z: CanonicalNumericComponent,
	r00: CanonicalNumericComponent,
	r01: CanonicalNumericComponent,
	r02: CanonicalNumericComponent,
	r10: CanonicalNumericComponent,
	r11: CanonicalNumericComponent,
	r12: CanonicalNumericComponent,
	r20: CanonicalNumericComponent,
	r21: CanonicalNumericComponent,
	r22: CanonicalNumericComponent,
];

export type CanonicalValue =
	| { readonly enumType: string; readonly type: "Enum"; readonly value: string }
	| { readonly type: "bool"; readonly value: boolean }
	| { readonly type: "CFrame"; readonly value: CFrameCanonicalValue }
	| { readonly type: "Color3"; readonly value: Color3CanonicalValue }
	| { readonly type: "number"; readonly value: CanonicalNumericComponent }
	| { readonly type: "Rect"; readonly value: RectCanonicalValue }
	| { readonly type: "string"; readonly value: string }
	| { readonly type: "UDim2"; readonly value: UDim2CanonicalValue }
	| { readonly type: "UDim"; readonly value: UDimCanonicalValue }
	| { readonly type: "Vector2"; readonly value: Vector2CanonicalValue }
	| { readonly type: "Vector3"; readonly value: Vector3CanonicalValue };

const ignoredJsxPropertyNames = new Set(["Name", "Parent"]);
const ignoredJsxPropertyNamesLowercase = new Set(
	Array.from(ignoredJsxPropertyNames, (propertyName) => propertyName.toLowerCase()),
);
const intrinsicClassNamesByTagName = new Map(
	Object.entries(defaultProperties.classes).map(([className]) => [className.toLowerCase(), className]),
);

interface DefaultPropertyLookupEntry {
	readonly propertyName: string;
	readonly value: CanonicalValue;
}

function createDefaultPropertyLookupEntries(
	properties: Readonly<Record<string, unknown>>,
): ReadonlyMap<string, DefaultPropertyLookupEntry> {
	const propertyLookupEntries = new Map<string, DefaultPropertyLookupEntry>();

	for (const [propertyName, propertyValue] of Object.entries(properties)) {
		/* v8 ignore next -- @preserve generated default-properties entries are canonical value records. */
		if (!isCanonicalValue(propertyValue)) continue;
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
	if (typeof valueTypeIndex !== "number") return undefined;
	const valueType = canonicalValueTypes[valueTypeIndex];
	/* v8 ignore next -- @preserve the generator only emits indexes from canonicalValueTypes. */
	if (valueType === undefined) return undefined;
	const candidate =
		valueType === "Enum"
			? { enumType: encodedValue[1], type: valueType, value: encodedValue[2] }
			: { type: valueType, value: encodedValue[1] };
	/* v8 ignore next -- @preserve generated compact values originate from validated canonical values. */
	return isCanonicalValue(candidate) ? candidate : undefined;
}

const intrinsicJsxDefaultOverrides = new Map<string, ReadonlyMap<string, DefaultPropertyLookupEntry>>([
	[
		"TextLabel",
		new Map<string, DefaultPropertyLookupEntry>([
			["text", { propertyName: "Text", value: { type: "string", value: "" } }],
		]),
	],
	[
		"UICorner",
		new Map<string, DefaultPropertyLookupEntry>([
			["cornerradius", { propertyName: "CornerRadius", value: { type: "UDim", value: [0, 0] } }],
		]),
	],
]);

function createClassDefaultPropertyLookups(): ReadonlyMap<string, ReadonlyMap<string, DefaultPropertyLookupEntry>> {
	const lookups = new Map<string, ReadonlyMap<string, DefaultPropertyLookupEntry>>();
	for (const [className, entries] of Object.entries(defaultProperties.classes)) {
		const properties: Record<string, unknown> = {};
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

function isIdentifierNamed(
	node: ESTree.Node,
	name: string,
): node is ESTree.Node & { readonly name: string; readonly type: "Identifier" } {
	return node.type === "Identifier" && node.name === name;
}

function isBooleanLiteral(node: ESTree.Expression): node is ESTree.BooleanLiteral {
	return node.type === "Literal" && typeof node.value === "boolean";
}

function getIntrinsicClassName(node: ESTree.JSXElementName): string | undefined {
	if (node.type !== "JSXIdentifier") return undefined;

	const className = intrinsicClassNamesByTagName.get(node.name.toLowerCase());
	if (className === undefined || node.name === className) return undefined;

	return className;
}

function getJsxAttributeName(node: ESTree.JSXAttributeName): string | undefined {
	if (node.type !== "JSXIdentifier") return undefined;
	return node.name;
}

function getJsxAttributeExpression(node: ESTree.JSXAttribute): ESTree.Expression | undefined {
	const { value } = node;
	if (value === null) return undefined;
	if (value.type === "Literal") return value;
	/* v8 ignore next -- @preserve Oxc only produces JSXEmptyExpression here for rejected parse-error cases. */
	if (value.type !== "JSXExpressionContainer" || value.expression.type === "JSXEmptyExpression") return undefined;
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

function isCanonicalNumericComponent(value: unknown): value is CanonicalNumericComponent {
	return isNumberRaw(value) || value === "inf" || value === "-inf";
}

function isCanonicalValue(value: unknown): value is CanonicalValue {
	/* v8 ignore next -- @preserve generated default-properties entries are canonical value records. */
	if (!(isRecord(value) && isStringRaw(value.type) && "value" in value)) return false;

	switch (value.type) {
		case "bool":
			return typeof value.value === "boolean";

		case "CFrame": {
			return (
				Array.isArray(value.value) &&
				value.value.length === 12 &&
				value.value.every(isCanonicalNumericComponent)
			);
		}

		case "Color3": {
			return Array.isArray(value.value) && value.value.length === 3 && value.value.every(isNumberRaw);
		}

		case "Enum":
			return isStringRaw(value.enumType) && isStringRaw(value.value);

		case "number":
			return isCanonicalNumericComponent(value.value);

		case "Rect":
		case "UDim2": {
			return (
				Array.isArray(value.value) && value.value.length === 4 && value.value.every(isCanonicalNumericComponent)
			);
		}

		case "string":
			return isStringRaw(value.value);

		case "UDim":
		case "Vector2": {
			return (
				Array.isArray(value.value) && value.value.length === 2 && value.value.every(isCanonicalNumericComponent)
			);
		}

		case "Vector3": {
			return (
				Array.isArray(value.value) && value.value.length === 3 && value.value.every(isCanonicalNumericComponent)
			);
		}
	}
	/* v8 ignore next -- generated default-properties JSON only contains the canonical type tags handled above. @preserve */
	return false;
}

function getTrackedInstanceClassName(node: ESTree.Expression): string | undefined {
	const expression = unwrapExpression(node);
	if (expression.type !== "NewExpression" || !isIdentifierNamed(expression.callee, "Instance")) return undefined;

	const [firstArgument] = expression.arguments;
	if (firstArgument === undefined || firstArgument.type === "SpreadElement" || !isStringLiteral(firstArgument)) {
		return undefined;
	}

	return firstArgument.value;
}

function containsIdentifierReference(
	value: unknown,
	identifierName: string,
	visitedValues: WeakSet<object> = new WeakSet<object>(),
): boolean {
	if (Array.isArray(value)) {
		for (const element of value) {
			if (containsIdentifierReference(element, identifierName, visitedValues)) return true;
		}
		return false;
	}

	if (!isRecord(value) || visitedValues.has(value)) return false;

	visitedValues.add(value);
	if (value.type === "Identifier" && value.name === identifierName) return true;

	for (const nestedValue of Object.values(value)) {
		if (containsIdentifierReference(nestedValue, identifierName, visitedValues)) return true;
	}

	return false;
}

function getMemberPath(node: ESTree.Expression): ReadonlyArray<string> | undefined {
	const path = new Array<string>();
	let current: ESTree.Expression = node;

	while (current.type === "MemberExpression") {
		if (current.computed || current.property.type !== "Identifier") return undefined;

		path.unshift(current.property.name);

		const { object } = current;
		if (object.type === "Identifier") {
			path.unshift(object.name);
			return path;
		}

		/* v8 ignore next -- @preserve member paths inspected by default-value matching are identifier-rooted member chains. */
		if (object.type !== "MemberExpression") return undefined;
		current = object;
	}

	if (current.type === "Identifier") {
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
		if (expectedComponent === undefined || actualComponent === undefined) return false;
		if (!matchesComponentValue(expectedComponent, actualComponent)) return false;
	}

	return true;
}

function extractNumberValue(node: ESTree.Expression): number | undefined {
	if (isNumericLiteral(node)) return node.value;
	if (isMathHuge(node)) return Number.POSITIVE_INFINITY;

	if (node.type !== "UnaryExpression") return undefined;
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
	if (
		first === undefined ||
		second === undefined ||
		first.type === "SpreadElement" ||
		second.type === "SpreadElement"
	) {
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
		first.type === "SpreadElement" ||
		second.type === "SpreadElement" ||
		third.type === "SpreadElement"
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
		first.type === "SpreadElement" ||
		second.type === "SpreadElement" ||
		third.type === "SpreadElement" ||
		fourth.type === "SpreadElement"
	) {
		return undefined;
	}

	return [first, second, third, fourth];
}

function extractVector2Value(node: ESTree.Expression): readonly [x: number, y: number] | undefined {
	if (node.type === "MemberExpression") {
		const path = getMemberPath(node);
		if (path?.length === 2 && path[0] === "Vector2" && path[1] === "zero") return [0, 0];
		return undefined;
	}

	if (node.type !== "NewExpression" || !isIdentifierNamed(node.callee, "Vector2")) return undefined;
	if (node.arguments.length === 0) return [0, 0];

	return extractNumberPair(node.arguments);
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
	if (node.type === "MemberExpression") {
		const path = getMemberPath(node);
		if (path?.length === 2 && path[0] === "Vector3" && path[1] === "zero") return [0, 0, 0];
		return undefined;
	}

	if (node.type !== "NewExpression" || !isIdentifierNamed(node.callee, "Vector3")) return undefined;
	if (node.arguments.length === 0) return [0, 0, 0];

	return extractNumberTriple(node.arguments);
}

function extractUDimValue(node: ESTree.Expression): readonly [scale: number, offset: number] | undefined {
	if (node.type !== "NewExpression" || !isIdentifierNamed(node.callee, "UDim")) return undefined;
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
	if (node.type === "CallExpression") {
		const path = getMemberPath(node.callee);
		const components = extractNumberPair(node.arguments);
		if (path === undefined || components === undefined) return undefined;

		const [first, second] = components;
		if (path.length === 2 && path[0] === "UDim2" && path[1] === "fromOffset") return [0, first, 0, second];
		if (path.length === 2 && path[0] === "UDim2" && path[1] === "fromScale") return [first, 0, second, 0];
		return undefined;
	}

	if (node.type !== "NewExpression" || !isIdentifierNamed(node.callee, "UDim2")) return undefined;
	if (node.arguments.length === 0) return [0, 0, 0, 0];

	return extractNumberQuadruple(node.arguments);
}

function extractRectValue(
	node: ESTree.Expression,
): readonly [minimumX: number, minimumY: number, maximumX: number, maximumY: number] | undefined {
	if (node.type !== "NewExpression" || !isIdentifierNamed(node.callee, "Rect")) return undefined;
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
	if (node.type === "CallExpression") {
		const path = getMemberPath(node.callee);
		const components = extractTriple(node.arguments);
		if (path?.length !== 2 || path[0] !== "Color3" || path[1] !== "fromRGB" || components === undefined) {
			return undefined;
		}

		const rgb = extractRGBFromComponents(components);
		if (rgb === undefined) return undefined;

		const [red, green, blue] = rgb;
		return [Math.fround(red / 255), Math.fround(green / 255), Math.fround(blue / 255)];
	}

	if (node.type !== "NewExpression" || !isIdentifierNamed(node.callee, "Color3")) return undefined;
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
	if (node.type !== "NewExpression" || !isIdentifierNamed(node.callee, "CFrame")) return undefined;
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

export function isDefaultValue(node: ESTree.Expression, canonicalValue: CanonicalValue): boolean {
	switch (canonicalValue.type) {
		case "bool":
			return isBooleanLiteral(node) && node.value === canonicalValue.value;

		case "CFrame": {
			const actual = extractCFrameValue(node);
			return actual !== undefined && matchesTuple(canonicalValue.value, actual);
		}

		case "Color3": {
			const actual = extractColor3Value(node);
			return (
				actual !== undefined &&
				actual[0] === canonicalValue.value[0] &&
				actual[1] === canonicalValue.value[1] &&
				actual[2] === canonicalValue.value[2]
			);
		}

		case "Enum": {
			const actual = extractEnumValue(node);
			return (
				actual !== undefined &&
				actual.enumType === canonicalValue.enumType &&
				actual.value === canonicalValue.value
			);
		}

		case "number": {
			const actual = extractNumberValue(node);
			return actual !== undefined && matchesComponentValue(canonicalValue.value, actual);
		}

		case "Rect": {
			const actual = extractRectValue(node);
			return actual !== undefined && matchesTuple(canonicalValue.value, actual);
		}

		case "string":
			return isStringLiteral(node) && node.value === canonicalValue.value;

		case "UDim": {
			const actual = extractUDimValue(node);
			return actual !== undefined && matchesTuple(canonicalValue.value, actual);
		}

		case "UDim2": {
			const actual = extractUDim2Value(node);
			return actual !== undefined && matchesTuple(canonicalValue.value, actual);
		}

		case "Vector2": {
			const actual = extractVector2Value(node);
			return actual !== undefined && matchesTuple(canonicalValue.value, actual);
		}

		case "Vector3": {
			const actual = extractVector3Value(node);
			return actual !== undefined && matchesTuple(canonicalValue.value, actual);
		}

		default:
			return false;
	}
}

const noUselessDefault = defineRule({
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
			if (
				node.attributes.some((openingElementAttribute) => openingElementAttribute.type === "JSXSpreadAttribute")
			) {
				return undefined;
			}

			const previousToken = sourceCode.getTokenBefore(attribute);
			const nextToken = sourceCode.getTokenAfter(attribute);
			/* v8 ignore next -- @preserve JSX attributes always have a preceding token in their opening element. */
			if (previousToken === null) return undefined;
			if (hasCommentsAroundNode(attribute)) return undefined;
			/* v8 ignore next -- @preserve SourceCode reports adjacent JSX comments through getCommentsBefore before this defensive token-between check. */
			if (sourceCode.commentsExistBetween(previousToken, attribute)) return undefined;
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
				assignmentExpression.left.type !== "MemberExpression" ||
				assignmentExpression.left.computed ||
				assignmentExpression.left.object.type !== "Identifier" ||
				assignmentExpression.left.property.type !== "Identifier"
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
					if (argument.type === "SpreadElement") continue;
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
			if (
				assignmentExpression.left.type !== "Identifier" &&
				assignmentExpression.left.type !== "MemberExpression"
			) {
				return;
			}

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

			for (const statementNode of statementNodes) {
				inspectStatementNode(statementNode, trackedInstances);
			}
		}

		function inspectStatementNode(
			statementNode: ESTree.Node,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			if (statementNode.type === "ExpressionStatement") {
				inspectExpressionStatement(statementNode, trackedInstances);
				return;
			}

			if (statementNode.type === "ReturnStatement") {
				clearTrackedInstancesForReturnStatement(statementNode, trackedInstances);
				return;
			}

			if (statementNode.type === "VariableDeclaration") trackConstInstances(statementNode, trackedInstances);
		}

		function inspectExpressionStatement(
			statementNode: ESTree.ExpressionStatement,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			const expression = unwrapExpression(statementNode.expression);

			if (expression.type === "AssignmentExpression") {
				reportUselessDefaultAssignment(statementNode, expression, trackedInstances);
				clearTrackedInstancesForEscapeAssignment(expression, trackedInstances);
				return;
			}

			if (expression.type === "CallExpression") {
				clearTrackedInstancesForCallExpression(expression, trackedInstances);
			}
		}

		function trackConstInstances(
			statementNode: ESTree.VariableDeclaration,
			trackedInstances: Map<string, TrackedInstance>,
		): void {
			if (statementNode.kind !== "const") return;

			for (const declaration of statementNode.declarations) {
				if (declaration.id.type !== "Identifier" || declaration.init === null) continue;

				const className = getTrackedInstanceClassName(declaration.init);
				if (className === undefined) continue;

				trackedInstances.set(declaration.id.name, { className });
			}
		}

		return {
			BlockStatement(node): void {
				inspectStatementNodes(node.body);
			},
			JSXOpeningElement(node): void {
				const className = getIntrinsicClassName(node.name);
				if (className === undefined) return;

				for (const attribute of node.attributes) {
					if (attribute.type === "JSXSpreadAttribute") continue;

					const propertyName = getJsxAttributeName(attribute.name);
					if (propertyName === undefined || isIgnoredPropertyName(propertyName)) continue;

					const propertyMatch = getPropertyMatch(className, propertyName);
					if (propertyMatch === undefined) continue;

					const expression = getJsxAttributeExpression(attribute);
					const isBooleanShorthandMatch =
						attribute.value === null && propertyMatch.value.type === "bool" && propertyMatch.value.value;
					if (
						!isBooleanShorthandMatch &&
						(expression === undefined || !isDefaultValue(expression, propertyMatch.value))
					) {
						continue;
					}

					const fix = createJsxAttributeRemovalFix(node, attribute);
					if (fix === undefined) {
						context.report({
							data: { className, propertyName: propertyMatch.propertyName },
							messageId: "uselessDefault",
							node: attribute,
						});
						continue;
					}

					context.report({
						data: { className, propertyName: propertyMatch.propertyName },
						fix,
						messageId: "uselessDefault",
						node: attribute,
					});
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
