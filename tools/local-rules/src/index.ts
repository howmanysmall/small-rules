import { definePlugin } from "oxlint-plugin-utilities";

import preferExistingGuard from "./prefer-existing-guard.ts";
import preferNodeTypeConstant from "./prefer-node-type-constant.ts";
import preferSharedStringConstant from "./prefer-shared-string-constant.ts";

const localRules = definePlugin({
	meta: { name: "local" },
	rules: {
		"prefer-existing-guard": preferExistingGuard,
		"prefer-node-type-constant": preferNodeTypeConstant,
		"prefer-shared-string-constant": preferSharedStringConstant,
	},
});

export default localRules;
