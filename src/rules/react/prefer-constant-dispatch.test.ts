import { describe } from "vitest";
import { tsx } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/react/prefer-constant-dispatch";

const preferConstantDispatchError = [{ messageId: "preferConstantDispatch", suggestions: 1 }];

describe("prefer-constant-dispatch", () => {
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
				documentation: { id: "fail", title: "Inline constant reducer action" },
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
			{
				code: `
import { ActionType } from "./actions";

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ActionType.Open });

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
import { ActionType } from "./actions";

const PREFER_CONSTANT_ACTION_0 = { type: ActionType.Open };

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
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: \`OPEN\`, priority: -1 });

    return state;
}
`,
				errors: preferConstantDispatchError,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ("OPEN" as const) });

    return state;
}
`,
				errors: preferConstantDispatchError,
			},
			{
				// The constant lands after the module binding the action reads.
				code: `
import { useReducer } from "react";
import { Workspace } from "@rbxts/services";

const INCREMENT = "increment";

export function Counter() {
    const [state, dispatch] = useReducer(reducer, 0);

    dispatch({ type: INCREMENT });
    dispatch({ type: "camera", camera: Workspace.CurrentCamera });

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
import { useReducer } from "react";
import { Workspace } from "@rbxts/services";

const INCREMENT = "increment";

const PREFER_CONSTANT_ACTION_0 = { type: INCREMENT };

export function Counter() {
    const [state, dispatch] = useReducer(reducer, 0);

    dispatch(PREFER_CONSTANT_ACTION_0);
    dispatch({ type: "camera", camera: Workspace.CurrentCamera });

    return state;
}
`,
							},
						],
					},
					{
						messageId: "preferConstantDispatch",
						suggestions: [
							{
								desc: "Extract to module constant `PREFER_CONSTANT_ACTION_1`",
								output: `
import { useReducer } from "react";
import { Workspace } from "@rbxts/services";

const PREFER_CONSTANT_ACTION_1 = { type: "camera", camera: Workspace.CurrentCamera };

const INCREMENT = "increment";

export function Counter() {
    const [state, dispatch] = useReducer(reducer, 0);

    dispatch({ type: INCREMENT });
    dispatch(PREFER_CONSTANT_ACTION_1);

    return state;
}
`,
							},
						],
					},
				],
			},
			{
				// A binding declared after the component still comes first.
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: INCREMENT });

    return state;
}

const INCREMENT = "increment";

export default Component;
`,
				errors: [
					{
						messageId: "preferConstantDispatch",
						suggestions: [
							{
								desc: "Extract to module constant `PREFER_CONSTANT_ACTION_0`",
								output: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch(PREFER_CONSTANT_ACTION_0);

    return state;
}

const INCREMENT = "increment";

const PREFER_CONSTANT_ACTION_0 = { type: INCREMENT };

export default Component;
`,
							},
						],
					},
				],
			},
			{
				// An enum member root is declared by the enum statement.
				code: `
enum Kind {
    Open = "open",
}

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: (Kind.Open as const) });

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
enum Kind {
    Open = "open",
}

const PREFER_CONSTANT_ACTION_0 = { type: (Kind.Open as const) };

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
				// Applying one suggestion and linting again picks a fresh name.
				code: `
const PREFER_CONSTANT_ACTION_0 = { type: "OPEN" };

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch(PREFER_CONSTANT_ACTION_0);
    dispatch({ type: "CLOSE" });

    return state;
}
`,
				errors: [
					{
						messageId: "preferConstantDispatch",
						suggestions: [
							{
								desc: "Extract to module constant `PREFER_CONSTANT_ACTION_1`",
								output: `
const PREFER_CONSTANT_ACTION_1 = { type: "CLOSE" };

const PREFER_CONSTANT_ACTION_0 = { type: "OPEN" };

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch(PREFER_CONSTANT_ACTION_0);
    dispatch(PREFER_CONSTANT_ACTION_1);

    return state;
}
`,
							},
						],
					},
				],
			},
			{
				// A local binding of the same name would capture the replacement.
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const PREFER_CONSTANT_ACTION_0 = state;

    dispatch({ type: "CLOSE" });

    return PREFER_CONSTANT_ACTION_0;
}
`,
				errors: [
					{
						messageId: "preferConstantDispatch",
						suggestions: [
							{
								desc: "Extract to module constant `PREFER_CONSTANT_ACTION_1`",
								output: `
const PREFER_CONSTANT_ACTION_1 = { type: "CLOSE" };

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const PREFER_CONSTANT_ACTION_0 = state;

    dispatch(PREFER_CONSTANT_ACTION_1);

    return PREFER_CONSTANT_ACTION_0;
}
`,
							},
						],
					},
				],
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
				documentation: { id: "pass", title: "Dynamic reducer action type" },
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
			{
				code: `
let ACTION_TYPE = "OPEN";

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ACTION_TYPE });

    return state;
}
`,
			},
			{
				code: `
function ACTION_TYPE() {
    return "OPEN";
}

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ACTION_TYPE });

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: UNKNOWN_ACTION_TYPE });

    return state;
}
`,
			},
			{
				code: `
function Component(tuple) {
    const [state, dispatch] = tuple;

    dispatch({ type: "OPEN" });

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ActionType.Open });

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state, dispatch = fallbackDispatch] = useReducer(reducer, initialState);

    dispatch({ type: "OPEN" });

    return state;
}
`,
			},
			{
				code: `
const ActionType = {
    Open: "open",
};

function Component() {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch({ type: ActionType["Open"] });

    return state;
}
`,
			},
			{
				code: `
function Component(actions) {
    const [state, dispatch] = useReducer(reducer, initialState);

    dispatch();
    dispatch(...actions);

    return state;
}
`,
			},
			{
				code: `
function Component() {
    const [state] = useReducer(reducer, initialState);
    const [value, dispatch] = useState(initialState);
    const [otherState, , otherDispatch] = useReducer(otherReducer, otherInitialState);

    dispatch({ type: "OPEN" });
    otherDispatch({ type: "CLOSE" });

    return state ?? value ?? otherState;
}
`,
			},
		],
	});
});
