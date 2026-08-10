import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { regex } from "arktype";

import type { HookAPI, ToolCallEventResult } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

const NPX_CALL = /(?:^|\s)n[p|l]x(?=\s|$)/u;
const NPX_FLAG = /^(?:--yes|-y)\b/u;
// oxlint-disable-next-line unicorn/prefer-string-raw -- arktype
const PACKAGE_NAME = regex("^(?<package>@?[\\w.-]+(?:/[\\w.-]+)?)(?:@[\\w.-]+)?(?=\\s|$)", "u");
// oxlint-disable-next-line unicorn/prefer-string-raw -- arktype
const SHELL_WRAPPER = regex("^(?:bash|sh|zsh)\\s+-c\\s+['\"](?<command>[\\s\\S]*)['\"]\\s*(?:_\\s*)?$", "u");
const RUNNER_PREFIX = /^(?:node --run|pnpm run|pnpm exec|npm run|bun run|bunx|nr|npx|yarn)\s+/u;
const WHITESPACE = /\s+/u;
const VERSION_SUFFIX = /@[\w.-]+$/u;

function npxPackage(command: string): string | undefined {
	const npxMatch = NPX_CALL.exec(command);
	if (npxMatch === null) return undefined;

	const remainder = command.slice(npxMatch.index + npxMatch[0].length).trim();
	const flagMatch = NPX_FLAG.exec(remainder);
	const afterFlags = flagMatch === null ? remainder : remainder.slice(flagMatch[0].length).trim();

	const packageMatch = PACKAGE_NAME.exec(afterFlags);
	if (packageMatch === null) return undefined;
	const packageName = packageMatch.groups.package;
	return packageName.length === 0 ? undefined : packageName;
}

function firstBinary(scriptValue: string): string | undefined {
	let command = unwrapShell(scriptValue);
	const runnerMatch = RUNNER_PREFIX.exec(command);
	if (runnerMatch !== null) command = command.slice(runnerMatch[0].length);

	for (const token of command.split(WHITESPACE)) {
		if (token.length === 0 || token.startsWith("-")) continue;
		const binary = token.replace(VERSION_SUFFIX, "");
		if (binary.length > 0) return binary;
	}
	return undefined;
}

function unwrapShell(scriptValue: string): string {
	const match = SHELL_WRAPPER.exec(scriptValue);
	return match === null ? scriptValue : match.groups.command;
}

function buildBinaryMap(scripts: Record<string, string>): Map<string, string> {
	const byBinary = new Map<string, string>();
	for (const [name, scriptValue] of Object.entries(scripts)) {
		const binary = firstBinary(scriptValue);
		if (binary === undefined) continue;

		const keys: Array<string> = [binary];
		if (binary.includes("/")) keys.push(binary.split("/").at(-1) ?? "");

		for (const key of keys) {
			const existing = byBinary.get(key);
			if (existing === undefined || (name.includes(":agent") && !existing.includes(":agent"))) {
				byBinary.set(key, name);
			}
		}
	}
	return byBinary;
}

function scriptFor(scripts: Record<string, string>, packageName: string): string | undefined {
	const byBinary = buildBinaryMap(scripts);
	const baseName = packageName.split("/").at(-1) ?? "";
	return byBinary.get(packageName) ?? byBinary.get(baseName);
}

function findScripts(): Record<string, string> | undefined {
	let directory = process.cwd();
	for (let depth = 0; depth < 6; depth += 1) {
		const scripts = readScripts(directory);
		if (scripts !== undefined) return scripts;

		const parent = nodePath.dirname(directory);
		if (parent === directory) return undefined;

		directory = parent;
	}
	return undefined;
}

function readScripts(directory: string): Record<string, string> | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(nodePath.join(directory, "package.json"), "utf8"));
	} catch {
		return undefined;
	}

	if (typeof parsed !== "object" || parsed === null) return undefined;

	const scripts = new Map<string, string>();
	for (const [name, value] of Object.entries(parsed)) {
		if (typeof value === "string") scripts.set(name, value);
	}
	return scripts.size > 0 ? Object.fromEntries(scripts) : undefined;
}

export default function blockUselessNpx(hookApi: HookAPI): void {
	hookApi.on("tool_call", (event): ToolCallEventResult => {
		if (event.toolName !== "bash") return {};

		const command = typeof event.input.command === "string" ? event.input.command : "";
		const packageName = npxPackage(command);
		if (packageName === undefined) return {};

		const scripts = findScripts();
		if (scripts === undefined) return {};

		const preferred = scriptFor(scripts, packageName);
		if (preferred === undefined) return {};

		return {
			block: true,
			reason: `Blocked: \`npx ${packageName}\` — ${packageName} is already a package.json script. Run \`nr ${preferred}\` instead (alternatives: \`node --run ${preferred}\`, \`pnpm run ${preferred}\`).`,
		};
	});
}
