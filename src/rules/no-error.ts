import { createBannedGlobalCallRule } from "$oxc-utilities/banned-global-call-rule";

const noError = createBannedGlobalCallRule({
	alternative: "throw",
	message: "Replace {{name}}(...) with {{alternative}}.",
	messageId: "noError",
	name: "error",
});

export default noError;
