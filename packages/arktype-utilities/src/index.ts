import { type } from "arktype";

export const isBoolean = type("boolean");
export const isTrue = type("true");
export const isFalse = type("false");

export const isNumber = type("number");
export const isString = type("string");
export const isUndefined = type("undefined");
export const isUnknown = type("unknown");
export const isNull = type("null");

export const isInteger = type("number % 1");

export const isMaybeString = isString.or(isUndefined);
export const isNullableString = isString.or(isNull);

export const isMaybeBoolean = isBoolean.or(isUndefined);

export const isMaybeNumber = isNumber.or(isUndefined);

export const isMaybeNull = isNull.or(isUndefined);

export const isArrayOfStrings = isString.array();
export const isReadonlyArrayOfStrings = isArrayOfStrings.readonly();

export const isArrayOfNumbers = isNumber.array();
export const isReadonlyArrayOfNumbers = isArrayOfNumbers.readonly();

export const isMaybeReadonlyArrayOfStrings = isReadonlyArrayOfStrings.or(isUndefined);

export const isDictionaryOfUnknowns = type.Record(isString, isUnknown);
export const isReadonlyDictionaryOfUnknowns = type.Record(isString, isUnknown).readonly();

export const isDictionaryOfStrings = type.Record(isString, isString);
export const isReadonlyDictionaryOfStrings = isDictionaryOfStrings.readonly();
export const isMaybeReadonlyDictionaryOfStrings = isReadonlyDictionaryOfStrings.or(isUndefined);

// Unexported and redeclared ArkType types
export type UndeclaredKeyBehavior = "delete" | "ignore" | "reject";
