import { cwd } from "node:process";
import { Plugin } from "@opencode-ai/plugin/effect";
import { Effect, Stream } from "effect";
import { exec } from "tinyexec";

import type { Scope } from "effect";

const id = "run-hk-check-on-idle";

const runHkCheck = Effect.fn("runHkCheck")(
	function* runHkCheck() {
		const result = yield* Effect.tryPromise({
			catch: (cause) => cause,
			try() {
				return exec("hk", ["run", "check", "--safe", "--format", "json"], {
					nodeOptions: { cwd: cwd(), stdio: "inherit" },
				});
			},
		}).pipe(
			Effect.tapError((cause) => Effect.logError(`[${id}] Failed to start hk:`, cause)),
			Effect.orElseSucceed(() => undefined),
		);

		if (result === undefined) return;
		if (result.exitCode !== 0) {
			yield* Effect.logError(`[${id}] hk check failed (exit ${result.exitCode ?? "unknown"}).`);
		}
	},
	// oxlint-disable-next-line unicorn/prefer-top-level-await -- what are you talking about??
	Effect.catch((error) => Effect.logError(`[${id}] Failed to start hk:`, error)),
);

const runHkCheckOnIdle = Plugin.define({
	id,
	effect(context): Effect.Effect<void, never, Scope.Scope> {
		return Effect.gen(function* effect() {
			yield* context.event.subscribe().pipe(
				Stream.filter((event) => event.type === "session.idle"),
				Stream.runForEach(runHkCheck),
				Effect.forkScoped,
			);
		});
	},
});

export default runHkCheckOnIdle;
