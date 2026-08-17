#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { argv, platform, stdin } from "node:process";

const outputPath = nodePath.resolve(argv[2] === "--open" ? "reports/dupes.html" : (argv[2] ?? "reports/dupes.html"));
const shouldOpen = argv.includes("--open");
const template = await readFile(new URL("dupes-viewer.html", import.meta.url), "utf8");
const chunks = new Array<string>();
for await (const chunk of stdin) chunks.push(String(chunk));
const report = chunks.join("").replaceAll("\u001B[36m", "").replaceAll("\u001B[0m", "");

if (report.trim().length === 0) {
	throw new Error("No similarity-ts report was provided on stdin.");
}

const encodedReport = Buffer.from(report, "utf8").toString("base64");
const html = template.replace(
	'window.__DUPE_REPORT__ = "";',
	() => `window.__DUPE_REPORT__ = decodeReport("${encodedReport}");`,
);

await mkdir(nodePath.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Wrote ${outputPath}`);

if (shouldOpen) {
	if (platform === "darwin") execFile("open", [outputPath]);
	else if (platform === "win32") execFile("cmd", ["/c", "start", "", outputPath]);
	else execFile("xdg-open", [outputPath]);
}
