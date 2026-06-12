import { lstat } from "node:fs/promises";
import { type } from "arktype";

const isNodeSystemError = type.instanceOf(Error).and({
	"code?": "string | undefined",
	"errno?": "number | undefined",
	"path?": "string | undefined",
	"syscall?": "string | undefined",
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
