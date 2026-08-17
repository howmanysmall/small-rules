import { createBannedGlobalCallRule } from "$oxc-utilities/banned-global-call-rule";

const noError = createBannedGlobalCallRule({
	name: "error",
	alternative: "throw",
	category: "general",
	message: "Replace {{name}}(...) with {{alternative}}.",
	messageId: "noError",
	ruleName: "no-error",
});

export default noError;
