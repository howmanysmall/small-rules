import { readFileSync } from "node:fs";
import nodePath from "node:path";

export const repositoryRoot = nodePath.resolve(import.meta.dirname, "../../..");

export function readRepositoryFile(relativePath: string): string {
	try {
		return readFileSync(nodePath.resolve(repositoryRoot, relativePath), "utf8");
	} catch {
		return "";
	}
}
