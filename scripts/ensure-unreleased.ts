#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { consola } from "consola";

import { getScriptName } from "$script-functions/get-script-name";

const name = getScriptName(true);
const log = consola.withTag(name);

const path = "CHANGELOG.md";
const content = readFileSync(path, "utf8");
const header = "All notable changes to `@pobammer-ts/small-rules` are documented here.";

if (content.includes("## [Unreleased]") || content.includes("## Unreleased")) {
	log.info("CHANGELOG.md already contains Unreleased section");
} else {
	const replaced = content.replace(header, () => `${header}\n\n## [Unreleased]`);
	if (replaced !== content) {
		writeFileSync(path, replaced);
		log.success("Inserted ## [Unreleased] into CHANGELOG.md");
	}
}
