import { createBannedGlobalCallRule } from "$oxc-utilities/banned-global-call-rule";

const noPrint = createBannedGlobalCallRule({
	alternative: "Log",
	message:
		"{{name}}() is a raw output function lacking log levels, timestamps, and filtering. " +
		"Production systems require structured logging for debugging and monitoring. " +
		"Replace {{name}}(...) with {{alternative}}.",
	messageId: "noPrint",
	name: "print",
});

export default noPrint;
