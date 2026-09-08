import { Plugin } from "@opencode-ai/plugin/effect";
import { Tool } from "@opencode-ai/schema/tool";
import { Effect } from "effect";

import { isFilePathInput } from "$types/opencode-types";

import type { Scope } from "effect";

const environmentProtection = Plugin.define({
	id: "env-protection",
	effect(context): Effect.Effect<void, never, Scope.Scope> {
		return Effect.gen(function* effect() {
			yield* context.tool.hook("execute.before", (event) => {
				if (event.tool !== "read") return Effect.void;

				const { input } = event;
				if (isFilePathInput.allows(input) && input.filePath.includes(".env")) {
					return Effect.fail(new Tool.Error({ message: "Do not read .env files" }));
				}
				return Effect.void;
			});
		});
	},
});

export default environmentProtection;
