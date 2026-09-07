import { isBoolean, isMaybeString, isNumber, isReadonlyArrayOfNumbers, isString } from "@small-rules/arktype-utilities";
import { type } from "arktype";

const isInfinite = type("'inf' | '-inf'");

const isCanonicalPropertyValue = isBoolean
	.or(isNumber)
	.or(isReadonlyArrayOfNumbers)
	.or(isString)
	.or(type([isInfinite, isInfinite]).readonly());
type CanonicalPropertyValue = typeof isCanonicalPropertyValue.infer;

const isCanonicalDefaultProperty = type({
	"enumType?": isMaybeString,
	type: isString,
	value: isCanonicalPropertyValue,
}).readonly();
type CanonicalDefaultProperty = typeof isCanonicalDefaultProperty.infer;

const isCanonicalDefaultProperties = type({
	classes: type.Record(isString, type.Record(isString, isCanonicalDefaultProperty)).readonly(),
}).readonly();

type EncodedDefaultValue = ReadonlyArray<CanonicalPropertyValue | number>;

interface CompactDefaultProperties {
	readonly classes: Readonly<Record<string, ReadonlyArray<number>>>;
	readonly properties: ReadonlyArray<string>;
	readonly values: ReadonlyArray<EncodedDefaultValue>;
	readonly version: 1;
}

const COMPACT_VERSION = 1;

const valueTypeIndexes: ReadonlyMap<string, number> = new Map(
	["Enum", "bool", "CFrame", "Color3", "number", "Rect", "string", "UDim2", "UDim", "Vector2", "Vector3"].map(
		(valueType, index) => [valueType, index],
	),
);

function encodeValue(value: CanonicalDefaultProperty): EncodedDefaultValue {
	const valueTypeIndex = valueTypeIndexes.get(value.type);
	if (valueTypeIndex === undefined) throw new TypeError(`Unknown canonical default property type: ${value.type}`);
	if (value.type === "Enum") {
		if (value.enumType === undefined) throw new TypeError("Invalid canonical enum default property value.");
		return [valueTypeIndex, value.enumType, value.value];
	}
	return [valueTypeIndex, value.value];
}

// oxlint-disable-next-line small-rules/no-unknown-parameters -- Validates extracted reflection values before encoding the catalog.
export function compactDefaultProperties(value: unknown): CompactDefaultProperties {
	const defaultProperties = isCanonicalDefaultProperties(value);
	if (defaultProperties instanceof type.errors) throw new TypeError(defaultProperties.summary);

	const propertyNames = [...new Set(Object.values(defaultProperties.classes).flatMap(Object.keys))].toSorted();
	const encodedBySerialized = new Map<string, EncodedDefaultValue>();
	for (const properties of Object.values(defaultProperties.classes)) {
		for (const property of Object.values(properties)) {
			const encoded = encodeValue(property);
			const serialized = JSON.stringify(encoded);
			encodedBySerialized.set(serialized, encoded);
		}
	}
	const sortedValues = [...encodedBySerialized].toSorted(([left], [right]) => {
		if (left === right) return 0;
		return left < right ? -1 : 1;
	});
	const serializedValues = sortedValues.map(([serialized]) => serialized);
	const propertyIndexes = new Map(propertyNames.map((propertyName, index) => [propertyName, index]));
	const valueIndexes = new Map(serializedValues.map((serialized, index) => [serialized, index]));

	const classes: Record<string, Array<number>> = {};
	for (const [className, properties] of Object.entries(defaultProperties.classes)) {
		const entries = new Array<number>();
		let size = 0;
		for (const [propertyName, property] of Object.entries(properties)) {
			const propertyIndex = propertyIndexes.get(propertyName);
			if (propertyIndex === undefined) throw new Error("Failed to index default property.");

			const valueIndex = valueIndexes.get(JSON.stringify(encodeValue(property)));
			if (valueIndex === undefined) throw new Error("Failed to index default value.");

			entries[size++] = propertyIndex;
			entries[size++] = valueIndex;
		}
		classes[className] = entries;
	}

	return {
		classes,
		properties: propertyNames,
		values: sortedValues.map(([, encoded]) => encoded),
		version: COMPACT_VERSION,
	};
}
