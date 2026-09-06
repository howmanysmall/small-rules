import { lstat } from "node:fs/promises";
import { type } from "arktype";

import { isMaybeNumber, isMaybeString } from "./arktype-utilities";

const isNodeSystemError = type.instanceOf(Error).and({
	"code?": isMaybeString,
	"errno?": isMaybeNumber,
	"path?": isMaybeString,
	"syscall?": isMaybeString,
});

export async function existsAsync(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (isNodeSystemError.allows(error) && error.code === "ENOENT") return false;
		throw error;
	}
}
