import { lstat } from "node:fs/promises";
import { type } from "arktype";

const isMaybeString = type("string | undefined");
const isNodeSystemError = type.instanceOf(Error).and({
	"code?": isMaybeString,
	"errno?": "number | undefined",
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
