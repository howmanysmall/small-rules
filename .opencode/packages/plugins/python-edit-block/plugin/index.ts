import { Plugin } from "@opencode/plugin/effect";
import { Tool } from "@opencode/schema/tool";
import { Effect } from "effect";

import { isCommandInput } from "$types/opencode-types";

import type { Scope } from "effect";

const SHELL_TOOLS = new Set(["bash", "shell"]);

// `python`, `python3`, `python3.12`, `/usr/bin/python3`, `uv run python`, `pipx
// run python`.
const PYTHON_INVOCATION = /(?:^|[\s;&|(`$/])python(?:\d+(?:\.\d+)*)?(?=$|[\s;&|)`])/u;

// Signs the interpreter is being used to change files, not just compute or print.
const FILE_MUTATION_PATTERNS: ReadonlyArray<RegExp> = [
	/\bopen\s*\([^)]*,\s*(?:mode\s*=\s*)?["'][rbtU]*[wax+][^"']*["']/u,
	/\.(?:write|writelines|write_text|write_bytes|touch|unlink|rename|replace|rmdir|truncate)\s*\(/u,
	/\bos\s*\.\s*(?:remove|unlink|rename|replace|rmdir|removedirs|truncate|makedirs|mkdir)\s*\(/u,
	/\bshutil\s*\.\s*(?:copy|copy2|copyfile|copytree|move|rmtree)\w*\s*\(/u,
	/\bfileinput\b/u,
	/\binplace\s*=/u,
	/\bjson\s*\.\s*dump\s*\(/u,
	/\bpickle\s*\.\s*dump\s*\(/u,
];

function editsFilesWithPython(command: string): boolean {
	if (!PYTHON_INVOCATION.test(command)) return false;
	return FILE_MUTATION_PATTERNS.some((pattern) => pattern.test(command));
}

const DENIAL = [
	"Blocked: do not use python or python3 to edit files.",
	"Use the edit or write tools instead.",
	"Do not retry this through another interpreter or a wrapper script.",
].join(" ");

const pythonEditBlock = Plugin.define({
	id: "python-edit-block",
	effect(context): Effect.Effect<void, never, Scope.Scope> {
		return Effect.gen(function* runEffect() {
			yield* context.tool.hook("execute.before", (event) => {
				if (!SHELL_TOOLS.has(event.tool)) return Effect.void;

				const { input } = event;
				if (!isCommandInput.allows(input)) return Effect.void;
				if (!editsFilesWithPython(input.command)) return Effect.void;

				return Effect.fail(new Tool.Error({ message: DENIAL }));
			});
		});
	},
});

export default pythonEditBlock;
