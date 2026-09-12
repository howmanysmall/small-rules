import { Predicate } from "effect";

import { isCommandHookInput } from "$codex-types/codex-types";

import type { CodexHookInput } from "$codex-types/codex-types";

export function getCommand(codexHookInput: CodexHookInput): string {
	if (!isCommandHookInput.allows(codexHookInput) || !Predicate.isObject(codexHookInput.tool_input)) return "";

	const command = codexHookInput.tool_input.command ?? codexHookInput.tool_input.cmd;
	return Predicate.isString(command) ? command : "";
}
