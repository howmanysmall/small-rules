import nodePath from "node:path";
import { stdout } from "node:process";
import { existsAsync } from "@small-rules/fs-utilities";
import { exec } from "tinyexec";
import { which } from "zx";

import { readStdinAsync } from "$codex-functions/read-stdin-async";
import { isCodexHookInput } from "$codex-types/codex-types";

const REACT_DOCTOR_ARGUMENTS = ["--verbose", "--scope", "changed", "--blocking", "warning", "--no-score"] as const;

interface ScanResult {
	readonly output: string;
	readonly status: number;
}

async function getReactDoctorAsync(projectRoot: string): Promise<string | undefined> {
	const localBinary = nodePath.resolve(projectRoot, "node_modules", ".bin", "react-doctor");
	if (await existsAsync(localBinary)) return localBinary;

	const anyBinary = await which("react-doctor", { nothrow: true });
	if (anyBinary !== null && anyBinary.length > 0) return anyBinary;
	return undefined;
}

async function runReactDoctorAsync(projectRoot: string): Promise<ScanResult> {
	const executable = await getReactDoctorAsync(projectRoot);
	if (executable === undefined) return { output: "", status: 0 };

	const result = await exec(executable, [...REACT_DOCTOR_ARGUMENTS], {
		nodeOptions: { cwd: projectRoot },
	});

	return {
		output: `${result.stdout}${result.stderr}`.trim(),
		status: result.exitCode ?? 1,
	};
}

const GUIDANCE =
	"React Doctor found issues in the changed files. Review this output and fix the regressions before finishing. For confirmed issues that cannot be fixed now, create GitHub issues with the rule, file/line, confidence, impact, and proposed fix.";

async function mainAsync(): Promise<void> {
	const parsed = JSON.parse(await readStdinAsync());
	if (!isCodexHookInput.allows(parsed) || parsed.hook_event_name !== "PostToolUse") return;

	const scanResult = await runReactDoctorAsync(parsed.cwd);
	if (scanResult.status === 0 || scanResult.output.length === 0) return;

	stdout.write(
		`${JSON.stringify({
			hookSpecificOutput: {
				additionalContext: `${GUIDANCE}\n\n${scanResult.output}`,
				hookEventName: "PostToolUse",
			},
		})}\n`,
	);
}

setImmediate(() => {
	void mainAsync();
});
