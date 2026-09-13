import { isBoolean, isNullableString, isString } from "@small-rules/arktype-utilities";
import { type } from "arktype";

import type { UndeclaredKeyBehavior } from "@small-rules/arktype-utilities";

const UNDECLARED_KEY_BEHAVIOR = "ignore" satisfies UndeclaredKeyBehavior;

export const isHookEventName = type(
	'"PreToolUse" | "PermissionRequest" | "PostToolUse" | "PreCompact" | "PostCompact" | "SessionStart" | "SessionEnd" | "UserPromptSubmit" | "SubagentStart" | "SubagentStop" | "Stop" | "Interrupt"',
);
export type HookEventName = typeof isHookEventName.infer;

export const isPermissionMode = type('"default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions"');
export type PermissionMode = typeof isPermissionMode.infer;

/** Any JSON value, including primitive values and null. */
const isJsonValue = type("object.json");

const isToolHookBase = type({
	/** Optional in the generated schema; never null when present. */
	"agent_id?": isString,
	/** Optional in the generated schema; never null when present. */
	"agent_type?": isString,
	cwd: isString,
	model: isString,
	permission_mode: isPermissionMode,
	session_id: isString,
	transcript_path: isNullableString,
	turn_id: isString,
});

const isPreToolUse = isToolHookBase
	.and({
		hook_event_name: "'PreToolUse'",
		tool_input: isJsonValue,
		tool_name: isString,
		tool_use_id: isString,
	})
	.readonly()
	.onUndeclaredKey(UNDECLARED_KEY_BEHAVIOR);

const isPermissionRequest = isToolHookBase
	.and({
		hook_event_name: "'PermissionRequest'",
		tool_input: isJsonValue,
		tool_name: isString,
	})
	.readonly()
	.onUndeclaredKey(UNDECLARED_KEY_BEHAVIOR);

const isPostToolUse = isToolHookBase
	.and({
		hook_event_name: "'PostToolUse'",
		tool_input: isJsonValue,
		tool_name: isString,
		tool_response: isJsonValue,
		tool_use_id: isString,
	})
	.readonly()
	.onUndeclaredKey(UNDECLARED_KEY_BEHAVIOR);

const isCompact = isToolHookBase
	.omit("permission_mode")
	.and({
		hook_event_name: "'PreCompact' | 'PostCompact'",
		trigger: "'manual' | 'auto'",
	})
	.readonly()
	.onUndeclaredKey(UNDECLARED_KEY_BEHAVIOR);

const isSessionStart = type({
	"+": UNDECLARED_KEY_BEHAVIOR,
	cwd: isString,
	hook_event_name: "'SessionStart'",
	model: isString,
	permission_mode: isPermissionMode,
	session_id: isString,
	source: "'startup' | 'resume' | 'clear' | 'compact'",
	transcript_path: isNullableString,
}).readonly();

const isSessionEnd = type({
	"+": UNDECLARED_KEY_BEHAVIOR,
	cwd: isString,
	hook_event_name: "'SessionEnd'",
	reason: "'other'",
	session_id: isString,
	transcript_path: isNullableString,
}).readonly();

const isUserPromptSubmit = isToolHookBase
	.and({
		hook_event_name: "'UserPromptSubmit'",
		prompt: isString,
	})
	.readonly()
	.onUndeclaredKey(UNDECLARED_KEY_BEHAVIOR);

const isSubagentStart = type({
	"+": UNDECLARED_KEY_BEHAVIOR,
	agent_id: isString,
	agent_type: isString,
	cwd: isString,
	hook_event_name: "'SubagentStart'",
	model: isString,
	permission_mode: isPermissionMode,
	session_id: isString,
	transcript_path: isNullableString,
	turn_id: isString,
}).readonly();

const isSubagentStop = type({
	"+": UNDECLARED_KEY_BEHAVIOR,
	agent_id: isString,
	agent_transcript_path: isNullableString,
	agent_type: isString,
	cwd: isString,
	hook_event_name: "'SubagentStop'",
	last_assistant_message: isNullableString,
	model: isString,
	permission_mode: isPermissionMode,
	session_id: isString,
	stop_hook_active: isBoolean,
	transcript_path: isNullableString,
	turn_id: isString,
}).readonly();

const isStop = type({
	"+": UNDECLARED_KEY_BEHAVIOR,
	cwd: isString,
	hook_event_name: "'Stop'",
	last_assistant_message: isNullableString,
	model: isString,
	permission_mode: isPermissionMode,
	session_id: isString,
	stop_hook_active: isBoolean,
	transcript_path: isNullableString,
	turn_id: isString,
}).readonly();

const isInterrupt = type({
	"+": UNDECLARED_KEY_BEHAVIOR,
	cwd: isString,
	hook_event_name: "'Interrupt'",
	model: isString,
	permission_mode: isPermissionMode,
	session_id: isString,
	transcript_path: isNullableString,
	turn_id: isString,
}).readonly();

export const isCodexHookInput = isPreToolUse
	.or(isPermissionRequest)
	.or(isPostToolUse)
	.or(isCompact)
	.or(isSessionStart)
	.or(isSessionEnd)
	.or(isUserPromptSubmit)
	.or(isSubagentStart)
	.or(isSubagentStop)
	.or(isStop)
	.or(isInterrupt);

export type CodexHookInput = typeof isCodexHookInput.infer;

export const isCommandHookInput = isCodexHookInput.extract({
	hook_event_name: '"PermissionRequest" | "PostToolUse" | "PreToolUse"',
});
export type CommandHookInput = typeof isCommandHookInput.infer;
