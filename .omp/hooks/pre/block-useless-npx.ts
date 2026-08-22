import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { cwd } from "node:process";
import { regex } from "arktype";
import { Predicate } from "effect";

import type { HookAPI, ToolCallEventResult } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

// package-exec runners to block: single-token (npx, nlx, pnpx, bunx) and
// two-word (bun x, pnpm dlx/exec, npm exec, yarn dlx)
const RUNNER_TOKEN = /(?:^|\s)(?:n[p|l]x|pnpx|bunx)(?=\s|$)/u;
const RUNNER_PHRASE = /(?:^|\s)(?:bun x|pnpm dlx|pnpm exec|npm exec|yarn dlx)(?=\s|$)/u;
const NPX_FLAG = /^(?:--yes|-y)\b/u;
// oxlint-disable-next-line unicorn/prefer-string-raw -- arktype
const PACKAGE_NAME = regex("^(?<package>@?[\\w.-]+(?:/[\\w.-]+)?)(?:@[\\w.-]+)?(?=\\s|$)", "u");
// oxlint-disable-next-line unicorn/prefer-string-raw -- arktype
const SHELL_WRAPPER = regex("^(?:bash|sh|zsh)\\s+-c\\s+['\"](?<command>[\\s\\S]*)['\"]\\s*(?:_\\s*)?$", "u");
const RUNNER_PREFIX = /^(?:node --run|pnpm run|pnpm exec|npm run|bun run|bunx|nr|npx|yarn)\s+/u;
const WHITESPACE = /\s+/u;
const VERSION_SUFFIX = /@[\w.-]+$/u;

function runnerInvocation(command: string): undefined | { packageName: string | undefined; runner: string } {
	const tokenMatch = RUNNER_TOKEN.exec(command);
	const phraseMatch = RUNNER_PHRASE.exec(command);
	const match = tokenMatch ?? phraseMatch;
	if (match === null) return undefined;

	const runner = match[0].trim();
	const remainder = command.slice(match.index + match[0].length).trim();
	const flagMatch = NPX_FLAG.exec(remainder);
	const afterFlags = flagMatch === null ? remainder : remainder.slice(flagMatch[0].length).trim();

	const packageMatch = PACKAGE_NAME.exec(afterFlags);
	if (packageMatch === null) return { packageName: undefined, runner };

	const packageName = packageMatch.groups.package;
	return { packageName: packageName.length === 0 ? undefined : packageName, runner };
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
	let directory = cwd();
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

	if (!Predicate.isRecord(parsed)) return undefined;

	const scripts = new Map<string, string>();
	for (const [name, value] of Object.entries(parsed)) if (Predicate.isString(value)) scripts.set(name, value);
	return scripts.size > 0 ? Object.fromEntries(scripts) : undefined;
}

export default function blockUselessNpx(hookApi: HookAPI): void {
	hookApi.on("tool_call", (event): ToolCallEventResult => {
		if (event.toolName !== "bash") return {};

		const command = Predicate.isString(event.input.command) ? event.input.command : "";
		const invocation = runnerInvocation(command);
		if (invocation === undefined) return {};

		const { packageName, runner } = invocation;
		if (packageName === undefined) {
			return {
				block: true,
				reason: `Blocked: \`${runner}\` — package-exec runners are not allowed. Run tools via package.json scripts with \`nr <script>\` instead.`,
			};
		}

		const scripts = findScripts();
		const preferred = scripts === undefined ? undefined : scriptFor(scripts, packageName);
		if (preferred === undefined) {
			return {
				block: true,
				reason: `Blocked: \`${runner} ${packageName}\` — package-exec runners are not allowed. Define a package.json script for ${packageName} and run it with \`nr <script>\` instead.`,
			};
		}

		return {
			block: true,
			reason: `Blocked: \`${runner} ${packageName}\` — ${packageName} is already a package.json script. Run \`nr ${preferred}\` instead (alternatives: \`node --run ${preferred}\`, \`pnpm run ${preferred}\`).`,
		};
	});
}
