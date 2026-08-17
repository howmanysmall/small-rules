/**
 * Blocks agents from running `npx <pkg>` when `<pkg>` is already a package.json script.
 *
 * Agents often reach for `npx oxlint` / `npx biome` even though this repo defines those as scripts and wants `nr
 * lint:agent` / `node --run …` instead.
 *
 * Deny by throwing from `tool.execute.before` (OpenCode's standard block signal).
 */
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import nodePath from "node:path";
import { Plugin } from "@opencode-ai/plugin";

const HOOK_NAME = "block-npx-scripts";

const SHELL_TOOLS = new Set(["bash", "shell", "interactive_bash"]);

const NPX_FLAG_WITH_VALUE = new Set([
	"-p",
	"--package",
	"-c",
	"--call",
	"--registry",
	"--cache",
	"--userconfig",
	"--shell",
	"--shell-auto-fallback",
]);

const NPX_BOOLEAN_FLAGS = new Set([
	"-y",
	"--yes",
	"-n",
	"--no",
	"--no-install",
	"--ignore-existing",
	"--quiet",
	"-q",
	"--prefer-online",
	"--offline",
	"--version",
	"-v",
	"--help",
	"-h",
]);

const PREFERRED_ALTERNATIVES: Readonly<Record<string, string>> = {
	biome: "nr lint:agent [files...]  (or nr format / node --run biome -- …)",
	oxfmt: "nr format  (or node --run oxfmt -- …)",
	oxlint: "nr lint:agent [files...]  (or node --run oxlint -- …)",
};

const SUBCOMMAND_SPLIT_PATTERN = /&&|\|\||[;|\n]/u;
const ENV_ASSIGNMENT_PATTERN = /^[A-Za-z_]\w*=/u;
const TOKEN_PATTERN = /[^\s"']+|"[^"]*"|'[^']*'/gu;
const NPX_OR_NPM_EXEC_PATTERN = /\b(?:npx|npm\s+exec)\b/u;
const SHELL_WRAPPERS = new Set(["env", "command", "nice", "nohup"]);

interface PackageScriptsCache {
	readonly mtimeMs: number;
	readonly path: string;
	readonly scripts: ReadonlySet<string>;
}

let scriptsCache: PackageScriptsCache | undefined;

function findPackageJson(startDirectory: string, stopDirectory?: string): string | undefined {
	let current = startDirectory;
	const stop = stopDirectory ?? nodePath.dirname(startDirectory);

	for (;;) {
		const candidate = nodePath.join(current, "package.json");
		if (existsSync(candidate)) return candidate;
		if (current === stop || current === nodePath.dirname(current)) return undefined;
		current = nodePath.dirname(current);
	}
}

function isScriptsRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

async function loadScriptNamesAsync(packageJsonPath: string): Promise<ReadonlySet<string>> {
	const { mtimeMs } = await stat(packageJsonPath);
	if (scriptsCache?.path === packageJsonPath && scriptsCache.mtimeMs === mtimeMs) return scriptsCache.scripts;

	const raw = await readFile(packageJsonPath, "utf8");
	const parsed: unknown = JSON.parse(raw);
	const scriptsValue = isScriptsRecord(parsed) && "scripts" in parsed ? parsed.scripts : undefined;
	const scriptsRecord = isScriptsRecord(scriptsValue) ? scriptsValue : {};

	const scripts = new Set(Object.keys(scriptsRecord).filter((name) => typeof scriptsRecord[name] === "string"));
	scriptsCache = { mtimeMs, path: packageJsonPath, scripts };
	return scripts;
}

function stripPackageVersion(specifier: string): string {
	if (specifier.startsWith("@")) {
		const secondAt = specifier.indexOf("@", 1);
		return secondAt === -1 ? specifier : specifier.slice(0, secondAt);
	}
	const at = specifier.indexOf("@");
	return at === -1 ? specifier : specifier.slice(0, at);
}

function barePackageName(packageName: string): string {
	const slash = packageName.lastIndexOf("/");
	return slash === -1 ? packageName : packageName.slice(slash + 1);
}

function splitShellSubcommands(command: string): Array<string> {
	return command
		.split(SUBCOMMAND_SPLIT_PATTERN)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

function stripLeadingShellNoise(tokens: ReadonlyArray<string>): Array<string> {
	let index = 0;
	while (index < tokens.length) {
		const token = tokens[index];
		if (token === undefined) break;
		if (ENV_ASSIGNMENT_PATTERN.test(token) || SHELL_WRAPPERS.has(token)) {
			index += 1;
			continue;
		}
		break;
	}
	return tokens.slice(index);
}

function unquoteToken(token: string): string {
	const isDoubleQuoted = token.startsWith('"') && token.endsWith('"');
	const isSingleQuoted = token.startsWith("'") && token.endsWith("'");
	if (isDoubleQuoted || isSingleQuoted) return token.slice(1, -1);
	return token;
}

function tokenize(subcommand: string): Array<string> {
	const matches = subcommand.match(TOKEN_PATTERN) ?? [];
	return matches.map(unquoteToken);
}

function findSpecifierIndexAfterNpx(tokens: ReadonlyArray<string>, startIndex: number): number {
	let index = startIndex;
	while (index < tokens.length) {
		const flag = tokens[index];
		if (flag === undefined) return -1;
		if (flag === "--") {
			index += 1;
			break;
		}
		if (NPX_BOOLEAN_FLAGS.has(flag)) {
			index += 1;
			continue;
		}
		if (NPX_FLAG_WITH_VALUE.has(flag)) {
			index += 2;
			continue;
		}
		if (flag.startsWith("-")) {
			index += 1;
			continue;
		}
		break;
	}
	return index;
}

function collectSpecifierFromTokens(tokens: ReadonlyArray<string>, found: Array<string>): void {
	let index = 0;
	while (index < tokens.length) {
		const token = tokens[index];
		if (token === undefined) return;

		const isNpx = token === "npx";
		const isNpmExec = token === "npm" && tokens[index + 1] === "exec";
		if (!(isNpx || isNpmExec)) {
			index += 1;
			continue;
		}

		const afterInvoker = index + (isNpmExec ? 2 : 1);
		const specifierIndex = findSpecifierIndexAfterNpx(tokens, afterInvoker);
		const specifier = specifierIndex >= 0 ? tokens[specifierIndex] : undefined;
		if (specifier !== undefined && !specifier.startsWith("-")) found.push(specifier);
		index = specifierIndex >= 0 ? specifierIndex + 1 : afterInvoker;
	}
}

function extractNpxPackageSpecifiers(command: string): Array<string> {
	const found = new Array<string>();
	for (const subcommand of splitShellSubcommands(command)) {
		collectSpecifierFromTokens(stripLeadingShellNoise(tokenize(subcommand)), found);
	}
	return found;
}

function matchScriptForNpxPackage(specifier: string, scripts: ReadonlySet<string>): string | undefined {
	const packageName = stripPackageVersion(specifier);
	if (scripts.has(packageName)) return packageName;
	const bare = barePackageName(packageName);
	if (bare !== packageName && scripts.has(bare)) return bare;
	return undefined;
}

function buildBlockMessage(specifier: string, scriptName: string): string {
	const alternative = PREFERRED_ALTERNATIVES[scriptName] ?? `nr ${scriptName}  (or node --run ${scriptName} -- …)`;

	return [
		`[${HOOK_NAME}] Blocked \`npx ${specifier}\`.`,
		`"${scriptName}" is already a package.json script — do not fetch it via npx.`,
		"",
		`Use instead: ${alternative}`,
		"",
		"Repo convention: prefer `nr <script>` / `node --run <script>` over npx for local tools.",
	].join("\n");
}

function throwBlockedNpxError(specifier: string, scriptName: string): never {
	const error = new Error(buildBlockMessage(specifier, scriptName));
	Error.captureStackTrace(error, throwBlockedNpxError);
	throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getCommandFromArguments(parameters: unknown): string | undefined {
	if (!isRecord(parameters)) return undefined;
	const { command } = parameters;
	if (typeof command === "string") return command;
	if (Array.isArray(command)) {
		const parts = command.filter((part): part is string => typeof part === "string");
		if (parts.length > 0) return parts.join(" ");
	}
	return undefined;
}

function assertNoNpxScriptBypass(command: string, scripts: ReadonlySet<string>): void {
	for (const specifier of extractNpxPackageSpecifiers(command)) {
		const scriptName = matchScriptForNpxPackage(specifier, scripts);
		if (scriptName !== undefined) throwBlockedNpxError(specifier, scriptName);
	}
}

const blockNpxScriptsPlugin = Plugin.define({
	id: HOOK_NAME,
	setup: async ({ tool }) => {
		const packageJsonPath = findPackageJson(process.cwd());
		// Warm the scripts cache at plugin load so the first blocked command is cheap.
		if (packageJsonPath !== undefined) await loadScriptNamesAsync(packageJsonPath);

		await tool.hook("execute.before", async (input): Promise<void> => {
			if (!SHELL_TOOLS.has(input.tool.toLowerCase())) return;

			const command = getCommandFromArguments(input.input);
			if (command === undefined || !NPX_OR_NPM_EXEC_PATTERN.test(command)) return;
			if (packageJsonPath === undefined) return;

			const scripts = await loadScriptNamesAsync(packageJsonPath);
			if (scripts.size === 0) return;

			assertNoNpxScriptBypass(command, scripts);
		});
	},
});
export default blockNpxScriptsPlugin;
