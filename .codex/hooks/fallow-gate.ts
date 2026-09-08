import nodePath from "node:path";
import { env, stderr, stdout } from "node:process";
import { isMaybeBoolean, isMaybeString } from "@small-rules/arktype-utilities";
import { existsAsync } from "@small-rules/fs-utilities";
import { type } from "arktype";
import { exec } from "tinyexec";
import { which } from "zx";

import { getCommand } from "$codex-functions/get-command";
import { isGitWriteCommand } from "$codex-functions/is-git-write-command";
import { readStdinAsync } from "$codex-functions/read-stdin-async";
import { isCodexHookInput } from "$codex-types/codex-types";

const FALLOW_AUDIT_ARGUMENTS = ["audit", "--format", "json", "--quiet", "--explain", "--gate-marker", "agent"] as const;
const FALLOW_MINIMUM_VERSION = "2.85.0";
const FALLOW_PREFIX_REGEX = /^fallow\s+/u;
const WHITESPACE_REGEX = /\s+/u;

const isFallowAuditOutput = type({
	"+": "ignore",
	"error?": isMaybeBoolean,
	"message?": isMaybeString,
	"verdict?": isMaybeString,
}).readonly();

interface FallowExecutable {
	readonly arguments: ReadonlyArray<string>;
	readonly description: string;
	readonly path: string;
}

interface FallowAuditResult {
	readonly exitCode: number;
	readonly stderr: string;
	readonly stdout: string;
}

function emitDenial(reason: string): void {
	stdout.write(
		`${JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: reason,
			},
		})}\n`,
	);
}

function getVersion(versionOutput: string): string {
	return versionOutput.trim().replace(FALLOW_PREFIX_REGEX, "").split(WHITESPACE_REGEX)[0] ?? "";
}

function isVersionBelow(version: string, minimumVersion: string): boolean {
	const versionParts = version.split(".");
	const minimumParts = minimumVersion.split(".");
	const length = Math.max(versionParts.length, minimumParts.length);

	for (let index = 0; index < length; index += 1) {
		const versionPart = Number(versionParts[index] ?? "0");
		const minimumPart = Number(minimumParts[index] ?? "0");
		if (versionPart !== minimumPart) return versionPart < minimumPart;
	}

	return false;
}

function parseFallowAuditOutput(output: string): typeof isFallowAuditOutput.infer | undefined {
	if (output.length === 0) return undefined;

	const parsed = JSON.parse(output);
	return isFallowAuditOutput.allows(parsed) ? parsed : undefined;
}

async function getFallowExecutableAsync(projectRoot: string): Promise<FallowExecutable | undefined> {
	const pathBinary = await which("fallow", { nothrow: true });
	if (pathBinary !== null && pathBinary.length > 0) {
		return { arguments: [], description: pathBinary, path: pathBinary };
	}

	const localBinary = nodePath.resolve(projectRoot, "node_modules", ".bin", "fallow");
	if (await existsAsync(localBinary)) return { arguments: [], description: localBinary, path: localBinary };

	const yarnBinary = await which("yarn", { nothrow: true });
	if (yarnBinary !== null && yarnBinary.length > 0) {
		const result = await exec(yarnBinary, ["bin", "fallow"]);
		const yarnFallow = result.stdout.trim();
		if (result.exitCode === 0 && yarnFallow.length > 0) {
			return { arguments: ["exec", "fallow", "--"], description: "yarn exec fallow", path: yarnBinary };
		}
	}

	const npxBinary = await which("npx", { nothrow: true });
	if (npxBinary !== null && npxBinary.length > 0) {
		const result = await exec(npxBinary, ["--no-install", "fallow", "--version"]);
		if (result.stdout.trimStart().startsWith("fallow")) {
			return { arguments: ["--no-install", "fallow"], description: "npx --no-install fallow", path: npxBinary };
		}
	}

	return undefined;
}

async function runFallowAuditAsync(executable: FallowExecutable, projectRoot: string): Promise<FallowAuditResult> {
	const result = await exec(executable.path, [...executable.arguments, ...FALLOW_AUDIT_ARGUMENTS], {
		nodeOptions: { cwd: projectRoot },
	});

	return {
		exitCode: result.exitCode ?? 1,
		stderr: result.stderr.trim(),
		stdout: result.stdout.trim(),
	};
}

async function mainAsync(): Promise<void> {
	const input: unknown = JSON.parse(await readStdinAsync());
	if (!isCodexHookInput.allows(input) || input.hook_event_name !== "PreToolUse") return;

	const command = getCommand(input);
	if (!isGitWriteCommand(command)) return;

	const executable = await getFallowExecutableAsync(input.cwd);
	if (executable === undefined) {
		stderr.write("fallow-gate: fallow binary not found, skipping audit.\n");
		return;
	}

	const versionResult = await exec(executable.path, [...executable.arguments, "--version"]);
	const version = getVersion(versionResult.stdout);
	const minimumVersion = env.FALLOW_GATE_MIN_VERSION ?? FALLOW_MINIMUM_VERSION;
	if (minimumVersion.length > 0 && version.length > 0 && isVersionBelow(version, minimumVersion)) {
		emitDenial(
			`fallow-gate: blocked: ${executable.description} is fallow ${version}, below required ${minimumVersion}. Upgrade fallow or set FALLOW_GATE_MIN_VERSION= to disable this check.`,
		);
		return;
	}

	const audit = await runFallowAuditAsync(executable, input.cwd);
	const auditOutput = parseFallowAuditOutput(audit.stdout);

	if (auditOutput?.verdict === "fail") {
		emitDenial(
			`fallow-gate: blocked by fallow ${version || "unknown"} at ${executable.description}\n${audit.stdout}`,
		);
		return;
	}

	if (audit.exitCode === 2 || auditOutput?.error === true) {
		const messageSuffix = auditOutput?.message === undefined ? "" : ` (${auditOutput.message})`;
		stderr.write(`fallow-gate: fallow audit runtime error${messageSuffix}, skipping.\n`);
		return;
	}

	if (audit.exitCode !== 0) {
		const firstErrorLine = audit.stderr.split("\n", 1)[0] ?? "";
		const errorSuffix = firstErrorLine.length === 0 ? "" : ` (${firstErrorLine})`;
		stderr.write(`fallow-gate: fallow audit exited ${audit.exitCode}${errorSuffix}, skipping.\n`);
	}
}

setImmediate(() => {
	void mainAsync().catch((error) => {
		// no-excuse-ok: catch -- a hook runtime failure must fail open.
		const message = error instanceof Error ? ` (${error.message})` : "";
		stderr.write(`fallow-gate: runtime error${message}, skipping.\n`);
	});
});
