import { definePlugin } from "oxlint-plugin-utilities";

import preferNodeTypeConstant from "./prefer-node-type-constant.ts";

// Repository-only rules. These lint this codebase and are never bundled into
// the published plugin.
const localRules = definePlugin({
	meta: { name: "local" },
	rules: {
		"prefer-node-type-constant": preferNodeTypeConstant,
	},
});

export default localRules;
