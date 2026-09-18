import { access, constants, lstat } from "node:fs/promises";
import { isMaybeNumber, isMaybeString } from "@small-rules/arktype-utilities";
import { type } from "arktype";

import type { PathLike } from "node:fs";

const isNodeSystemError = type.instanceOf(Error).and({
	"code?": isMaybeString,
	"errno?": isMaybeNumber,
	"path?": isMaybeString,
	"syscall?": isMaybeString,
});

export async function existsAsync(fsPath: string): Promise<boolean> {
	try {
		await lstat(fsPath);
		return true;
	} catch (error) {
		if (isNodeSystemError.allows(error) && error.code === "ENOENT") return false;
		throw error;
	}
}

export async function isFileAccessibleAsync(pathLike: PathLike): Promise<boolean> {
	try {
		await access(pathLike, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}
