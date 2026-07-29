#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(
	process.argv[2] === "--open" ? "reports/dupes.html" : (process.argv[2] ?? "reports/dupes.html"),
);
const shouldOpen = process.argv.includes("--open");
const template = await readFile(new URL("dupes-viewer.html", import.meta.url), "utf8");
const chunks = new Array<string>();
for await (const chunk of process.stdin) chunks.push(String(chunk));
const report = chunks.join("").replaceAll("\u001B[36m", "").replaceAll("\u001B[0m", "");

if (report.trim().length === 0) {
	throw new Error("No similarity-ts report was provided on stdin.");
}

const encodedReport = Buffer.from(report, "utf8").toString("base64");
const html = template.replace(
	'window.__DUPE_REPORT__ = "";',
	`window.__DUPE_REPORT__ = decodeReport("${encodedReport}");`,
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Wrote ${outputPath}`);

if (shouldOpen) {
	if (process.platform === "darwin") {
		execFile("/usr/bin/open", [outputPath]);
	} else if (process.platform === "win32") {
		execFile(String.raw`C:\Windows\System32\cmd.exe`, ["/c", "start", "", outputPath]);
	} else {
		execFile("/usr/bin/xdg-open", [outputPath]);
	}
}
