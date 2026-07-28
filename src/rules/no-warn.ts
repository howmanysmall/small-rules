import { createBannedGlobalCallRule } from "$oxc-utilities/banned-global-call-rule";

const noWarn = createBannedGlobalCallRule({
	alternative: "Log",
	message:
		"{{name}}() is a raw output function lacking log levels, timestamps, and filtering. " +
		"Production systems require structured logging for debugging and monitoring. " +
		"Replace {{name}}(...) with {{alternative}}.",
	messageId: "noWarn",
	name: "warn",
	url: "https://docs.howmanysmall.com/small-rules/rules/roblox/no-warn/",
});

export default noWarn;
