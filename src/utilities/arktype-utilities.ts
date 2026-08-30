import { type } from "arktype";

export const isBoolean = type("boolean");
export const isString = type("string");
export const isUndefined = type("undefined");

export const isReadonlyArrayOfStrings = isString.array().readonly();

export const isReadonlyRecordOfStrings = type("Record<string, string>").readonly();
