import { createBannedGlobalCallRule } from "$oxc-utilities/banned-global-call-rule";

const noError = createBannedGlobalCallRule({
	alternative: "throw",
	message: "Replace {{name}}(...) with {{alternative}}.",
	messageId: "noError",
	name: "error",
	url: "https://docs.howmanysmall.com/small-rules/rules/general/no-error/",
});

export default noError;
