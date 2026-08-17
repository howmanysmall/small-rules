import { spawn } from "node:child_process";
import { Plugin } from "@opencode-ai/plugin";

const HOOK_NAME = "run-hk-check-on-idle";

function runHkCheck(): Promise<void> {
	return new Promise((resolve) => {
		const child = spawn("hk", ["run", "check", "--safe", "--format", "json"], {
			cwd: process.cwd(),
			stdio: "inherit",
		});

		child.once("error", (error) => {
			console.error(`[${HOOK_NAME}] Failed to start hk:`, error);
			resolve();
		});
		child.once("exit", (code, signal) => {
			if (code !== 0) console.error(`[${HOOK_NAME}] hk check failed (${signal ?? `exit ${code ?? "unknown"}`}).`);
			resolve();
		});
	});
}

const runHkCheckOnIdlePlugin = Plugin.define({
	id: HOOK_NAME,
	setup: async ({ event }) => {
		const controller = new AbortController();
		let check: Promise<void> | undefined;

		const task = (async () => {
			for await (const currentEvent of event.subscribe({ signal: controller.signal })) {
				if (currentEvent.type !== "session.idle" || check !== undefined) continue;
				const currentCheck = runHkCheck();
				check = currentCheck;
				await currentCheck;
				check = undefined;
			}
		})().catch((error: unknown) => {
			if (!controller.signal.aborted) console.error(`[${HOOK_NAME}] Event subscription failed:`, error);
		});

		return async () => {
			controller.abort();
			await task;
			await check;
		};
	},
});

export default runHkCheckOnIdlePlugin;
