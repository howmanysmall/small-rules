#!/usr/bin/env bun

import { exit } from "node:process";
import { exec } from "tinyexec";

import { LICENSE_POLICY } from "$script-constants/license-policy";
import { createScriptCommand, parseScriptArgumentsAsync } from "$script-functions/create-script-command";
import { evaluateLicenses, parseLicenseReport } from "$script-utilities/licenses";

import type { LicensedPackage } from "$script-utilities/licenses";

const { command, log } = createScriptCommand(
	"1.0.0",
	"Fails when an installed dependency's license is not allowed for the tier it ships in.",
);

async function listLicensesAsync(parameters: ReadonlyArray<string>): Promise<ReadonlyArray<LicensedPackage>> {
	const { stdout } = await exec("pnpm", ["licenses", "list", "--json", ...parameters], { throwOnError: true });
	return parseLicenseReport(stdout);
}

command
	.example("Check every installed license", "bun run scripts/check-licenses.ts")
	.action(async (): Promise<void> => {
		const [root, documentation, workspace] = await Promise.all([
			listLicensesAsync(["--prod"]),
			listLicensesAsync(["--prod", "--filter", "@small-rules/documentation"]),
			listLicensesAsync(["--recursive"]),
		]);

		const { checked, failures, staleExceptions } = evaluateLicenses(
			{ shipped: [...root, ...documentation], workspace },
			LICENSE_POLICY,
		);

		for (const { name, license, reason, tier, version } of failures) {
			log.fail(`${name}@${version}: ${license || "(none)"} in ${tier}: ${reason}`);
		}

		for (const exception of staleExceptions) {
			log.fail(`${exception.package}: the ${exception.license} exception excuses no installed package`);
		}

		if (failures.length === 0 && staleExceptions.length === 0) {
			log.success(`${checked} package versions have allowed licenses`);
			return;
		}

		log.fail(
			`${failures.length} disallowed license(s), ${staleExceptions.length} stale exception(s); see scripts/constants/license-policy.ts`,
		);
		exit(1);
	});

await parseScriptArgumentsAsync(command);
