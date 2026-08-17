import { type } from "arktype";

export const isBoolean = type("boolean");
export const isString = type("string");
export const isUndefined = type("undefined");

export const isArrayOfStrings = isString.array();
export const isReadonlyArrayOfStrings = isArrayOfStrings.readonly();
