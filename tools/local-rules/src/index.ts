import { definePlugin } from "oxlint-plugin-utilities";

import preferNodeTypeConstant from "./prefer-node-type-constant.ts";

const localRules = definePlugin({
	meta: { name: "local" },
	rules: {
		"prefer-node-type-constant": preferNodeTypeConstant,
	},
});

export default localRules;
