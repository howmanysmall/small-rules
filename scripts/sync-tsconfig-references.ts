#!/usr/bin/env bun

import { argv, cwd, exit } from "node:process";
import { consola } from "consola";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";
import { findStaleReferencesAsync, syncTsconfigReferencesAsync } from "$script-utilities/sync-tsconfig-references";

const name = getScriptName(true);
const log = consola.withTag(name);

const command = createBaseCommand(
	name,
	"1.0.0",
	"Derives the solution `tsconfig.json` project references from the workspace graph.",
)
	.option("-c, --check", "Report stale references and exit non-zero instead of rewriting them.", {
		default: false,
	})
	.example("Rewrite stale references", "bun run scripts/sync-tsconfig-references.ts")
	.example("Fail when references drift", "bun run scripts/sync-tsconfig-references.ts --check")
	.action(async ({ check }): Promise<void> => {
		const rootDirectory = cwd();

		if (check) {
			const staleReferences = await findStaleReferencesAsync(rootDirectory);
			for (const { actualReferences, expectedReferences, path } of staleReferences) {
				log.fail(`${path} references are stale`);
				log.info(`  expected: ${expectedReferences.join(", ") || "(none)"}`);
				log.info(`  actual:   ${actualReferences.join(", ") || "(none)"}`);
			}

			if (staleReferences.length === 0) {
				log.success("all tsconfig references are in sync");
				return;
			}

			log.fail(`${staleReferences.length} tsconfig file(s) out of sync; run \`nr references:sync\``);
			exit(1);
		}

		const staleReferences = await syncTsconfigReferencesAsync(rootDirectory);
		if (staleReferences.length === 0) {
			log.success("all tsconfig references are in sync");
			return;
		}

		for (const { path } of staleReferences) log.success(`updated ${path}`);
		log.success(`synced ${staleReferences.length} tsconfig file(s)`);
	});

await command.parse(argv.slice(2));
