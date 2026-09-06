import { type } from "arktype";

import { isString } from "./arktype-types";

export const isFilePathInput = type({
	"+": "ignore",
	filePath: isString,
}).readonly();
