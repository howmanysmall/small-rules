#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";

const path = "CHANGELOG.md";
const content = readFileSync(path, "utf8");
const header = "All notable changes to `@pobammer-ts/small-rules` are documented here.";

if (content.includes("## [Unreleased]") || content.includes("## Unreleased")) {
	console.log("CHANGELOG.md already contains Unreleased section");
} else {
	const replaced = content.replace(header, `${header}\n\n## [Unreleased]`);
	if (replaced !== content) {
		writeFileSync(path, replaced);
		console.log("Inserted ## [Unreleased] into CHANGELOG.md");
	}
}
