import { createBannedGlobalCallRule } from "$oxc-utilities/banned-global-call-rule";

const noPrint = createBannedGlobalCallRule({
	name: "print",
	alternative: "Log",
	category: "roblox",
	message:
		"{{name}}() is a raw output function lacking log levels, timestamps, and filtering. " +
		"Production systems require structured logging for debugging and monitoring. " +
		"Replace {{name}}(...) with {{alternative}}.",
	messageId: "noPrint",
	ruleName: "no-print",
});

export default noPrint;
