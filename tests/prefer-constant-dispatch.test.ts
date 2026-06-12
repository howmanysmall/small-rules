import { describe } from "vitest";
import rule from "$oxc-rules/prefer-constant-dispatch";

import { tsx } from "./rule-testers";

const preferConstantDispatchError = [{ messageId: "preferConstantDispatch", suggestions: 1 }];

describe("prefer-constant-dispatch", () => {
	// @ts-expect-error -- RuleTester types are incorrect for suggestions
	tsx.run("prefer-constant-dispatch", rule, {
		invalid: [
			{
				code: `
const type = "OPEN";

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type });

    return state;
}
`,
				errors: preferConstantDispatchError,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: "OPEN" });

    return state;
}
`,
				errors: [
					{
						messageId: "preferConstantDispatch",
						suggestions: [
							{
								desc: "Extract to module constant `PREFER_CONSTANT_ACTION_0`",
								output: `
const PREFER_CONSTANT_ACTION_0 = { type: "OPEN" };

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch(PREFER_CONSTANT_ACTION_0);

    return state;
}
`,
							},
						],
					},
				],
			},
			{
				code: `
enum ActionType {
    SetShowFilters = "set-show-filters",
}

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ActionType.SetShowFilters, value: true });

    return state;
}
`,
				errors: preferConstantDispatchError,
			},
			{
				code: `
enum ModalActionType {
    Open = "open",
}

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ModalActionType.Open });

    return state;
}
`,
				errors: preferConstantDispatchError,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = React.useReducer(reducer, initialState);

    dispatch({ type: "CLOSE" });

    return state;
}
`,
				errors: preferConstantDispatchError,
			},
			{
				code: `
function Component() {
    const [firstState, firstDispatch] = useReducer(firstReducer, firstInitialState);
    const [secondState, secondDispatch] = useReducer(secondReducer, secondInitialState);

    firstDispatch({ type: "OPEN" });
    secondDispatch({ type: "CLOSE" });

    return firstState ?? secondState;
}
`,
				errors: [
					{ messageId: "preferConstantDispatch", suggestions: 1 },
					{ messageId: "preferConstantDispatch", suggestions: 1 },
				],
			},
			{
				code: `
function Component() {
    const [_, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: "RESET" });
}
`,
				errors: preferConstantDispatchError,
			},
			{
				code: `
function Component() {
    const [{}, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: "SYNC" });
}
`,
				errors: preferConstantDispatchError,
			},
		],
		valid: [
			{
				code: `
function Component(type) {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type });

    return state;
}
`,
			},
			{
				code: `
function Component(nextSlot) {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: "SET_SLOT", slot: nextSlot });

    return state;
}
`,
			},
			{
				code: `
function Component(nextDiceUsed) {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: "SET_DICE_USED", nextDiceUsed });

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: "SET_RESULT", value: getNextResult() });

    return state;
}
`,
			},
			{
				code: `
function Component(dynamicKey) {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ [dynamicKey]: "OPEN", type: "SET_VALUE" });

    return state;
}
`,
			},
			{
				code: `
function Component(extraAction) {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ ...extraAction, type: "OPEN" });

    return state;
}
`,
			},
			{
				code: `
const CONSTANT_ACTION = { type: "OPEN" };

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch(CONSTANT_ACTION);

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    function triggerDispatch(dispatch) {
        dispatch({ type: "OPEN" });
    }

    return state;
}
`,
			},
			{
				code: `
function triggerDispatch(dispatch) {
    dispatch({ type: "OPEN" });
}
`,
			},
			{
				code: `
function Component(slot) {
    const [state, dispatch] = React.useReducer(reducer, initialState);

    dispatch({ type: "SET_SLOT", slot });

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const ACTION_TYPE = "OPEN";

    dispatch({ type: ACTION_TYPE });

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const constantAction = { type: "OPEN" };

    dispatch(constantAction);

    return state;
}
`,
			},
		],
	});
});
