import { mkdir, writeFile } from "node:fs/promises";
import nodePath from "node:path";

import type { ConsolaInstance } from "consola";

export async function writeGeneratedFileAsync(output: string, contents: string, log: ConsolaInstance): Promise<void> {
	await mkdir(nodePath.dirname(output), { recursive: true });
	await writeFile(output, contents, "utf8");
	log.success(`Wrote ${contents.length} bytes to ${output}`);
}
