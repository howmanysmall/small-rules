import { describe } from "vitest";
import rule from "$oxc-rules/react/prefer-direct-hook-imports";

import { tsx } from "./rule-testers";

describe("prefer-direct-hook-imports", () => {
	tsx.run("prefer-direct-hook-imports", rule, {
		invalid: [
			{
				code: `
import React from "@rbxts/react";

const [state, setState] = React.useState(false);
`,
				documentation: { id: "fail", title: "React.useState namespace call" },
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import * as React from "@rbxts/react";

React.useEffect(() => {});
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "react";

React.useCallback(() => {}, []);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React from "@rbxts/react";

const value = React.useMemo(() => 42, []);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

const ref = React.useRef();
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

const [state, dispatch] = React.useReducer(reducer, initialState);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

const context = React.useContext(MyContext);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

React.useLayoutEffect(() => {}, []);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

React.useInsertionEffect(() => {}, []);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

const [isPending, startTransition] = React.useTransition();
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

const deferredValue = React.useDeferredValue(value);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

const id = React.useId();
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

const snapshot = React.useSyncExternalStore(subscribe, getSnapshot);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

React.useImperativeHandle(ref, () => ({}), []);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
			{
				code: `
import React from "@rbxts/react";

React.useDebugValue(value);
`,
				errors: [{ messageId: "preferDirectHookImport" }],
			},
		],
		valid: [
			{
				code: `
import { useState } from "@rbxts/react";

const [state, setState] = useState(false);
`,
				documentation: { id: "pass", title: "Direct hook import" },
			},
			{
				code: `
import { useState, useEffect } from "react";

useState(false);
useEffect(() => {}, []);
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement("frame");
`,
			},
			{
				code: `
import React from "@rbxts/react";

React.Fragment;
`,
			},
			{
				code: `
import React from "@rbxts/react";

React.Children;
`,
			},
			{
				code: `
import React from "@rbxts/react";

React.Component;
`,
			},
			{
				code: `
import React from "@rbxts/react";

React.PureComponent;
`,
			},
			{
				code: `
import * as React from "@rbxts/react";

const [state, setState] = React.useState(false);
`,
				options: [{ allowedHooks: ["useState"], environment: "roblox-ts" }],
			},
			{
				code: `
const myLib = { useState: () => {} };

myLib.useState(false);
`,
			},
			{
				code: `
const myLib = { useCustom: () => {} };

myLib.useCustom();
`,
			},
			{
				code: `
import React from "@rbxts/react";

React.usestate(false);
`,
			},
			{
				code: `
import React from "@rbxts/react";

React["useState"](false);
`,
			},
			{
				code: `
React.useState(false);
`,
			},
			{
				code: `
import React from "@rbxts/react";

React.Fragment.useState(false);
`,
			},
		],
	});
});
