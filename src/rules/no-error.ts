import { createBannedGlobalCallRule } from "$oxc-utilities/banned-global-call-rule";

const noError = createBannedGlobalCallRule({
	alternative: "throw",
	category: "general",
	message: "Replace {{name}}(...) with {{alternative}}.",
	messageId: "noError",
	name: "error",
	ruleName: "no-error",
});

export default noError;
