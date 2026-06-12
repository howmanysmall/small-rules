import { countSetStateCalls, getEffectCallback, getHookName } from "$oxc-utilities/react-hook-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Visitor } from "oxlint-plugin-utilities";

const CASCADING_SET_STATE_THRESHOLD = 3;
const EFFECT_HOOK_NAMES = new Set([
	"useAsyncEffect",
	"useEffect",
	"useInsertionEffect",
	"useLayoutEffect",
	"useMountEffect",
	"useReactiveEffect",
	"useUnmountEffect",
	"useUpdateEffect",
]);

const noCascadingSetState = defineRule({
	create(context): Visitor {
		return {
			CallExpression(node): void {
				const hookName = getHookName(node);
				if (hookName === undefined || !EFFECT_HOOK_NAMES.has(hookName)) return;

				const callback = getEffectCallback(node);
				if (callback === undefined) return;

				const setStateCallCount = countSetStateCalls(callback);
				if (setStateCallCount < CASCADING_SET_STATE_THRESHOLD) return;

				context.report({
					data: { count: String(setStateCallCount) },
					messageId: "cascadingSetState",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow effect hooks with many cascading state updates.",
			recommended: true,
		},
		messages: {
			cascadingSetState:
				"{{count}} setState calls in a single useEffect — consider using useReducer or deriving state",
		},
		type: "problem",
	},
});

export default noCascadingSetState;
