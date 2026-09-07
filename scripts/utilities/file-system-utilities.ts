import { lstat } from "node:fs/promises";
import { isMaybeNumber, isMaybeString } from "@small-rules/arktype-utilities";
import { type } from "arktype";

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
