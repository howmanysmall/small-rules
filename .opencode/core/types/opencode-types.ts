import { isString } from "@small-rules/arktype-utilities";
import { type } from "arktype";

export const isFilePathInput = type({
	"+": "ignore",
	filePath: isString,
}).readonly();
