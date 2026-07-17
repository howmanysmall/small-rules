import { describe } from "vitest";
import rule from "$oxc-rules/require-react-display-names";

import { tsx } from "./rule-testers";

describe("require-react-display-names", () => {
	tsx.run("require-react-display-names", rule, {
		invalid: [
			// Direct memo export
			{
				code: `
import { memo } from "@rbxts/react";

function ComponentNoMemo() {
    return <div />;
}

export default memo(ComponentNoMemo);
`,
				documentation: { id: "fail", title: "Memo export without display name" },
				errors: [{ messageId: "directMemoExport" }],
			},

			// Direct React.memo export
			{
				code: `
import React from "@rbxts/react";

function ComponentNoMemo() {
    return <div />;
}

export default React.memo(ComponentNoMemo);
`,
				errors: [{ messageId: "directMemoExport" }],
			},

			// Direct createContext export
			{
				code: `
import { createContext } from "@rbxts/react";

export default createContext<string | undefined>(undefined);
`,
				errors: [{ messageId: "directContextExport" }],
			},

			// Direct React.createContext export
			{
				code: `
import React from "@rbxts/react";

export default React.createContext<number>(0);
`,
				errors: [{ messageId: "directContextExport" }],
			},

			// Missing displayName on memo - default export
			{
				code: `
import { memo } from "@rbxts/react";

function ChecklistClaimButtonNoMemo() {
    return <div />;
}

const ChecklistClaimButton = memo(ChecklistClaimButtonNoMemo);
export default ChecklistClaimButton;
`,
				errors: [{ messageId: "missingMemoDisplayName" }],
			},

			// Missing displayName on memo - named export
			{
				code: `
import { memo } from "@rbxts/react";

function ChecklistClaimButtonNoMemo() {
    return <div />;
}

export const ChecklistClaimButton = memo(ChecklistClaimButtonNoMemo);
`,
				errors: [{ messageId: "missingMemoDisplayName" }],
			},

			// Missing displayName on context - default export
			{
				code: `
import React from "@rbxts/react";

const ErrorBoundaryContext = React.createContext<unknown>(undefined);
export default ErrorBoundaryContext;
`,
				errors: [{ messageId: "missingContextDisplayName" }],
			},

			// Missing displayName on context - named export
			{
				code: `
import { createContext } from "@rbxts/react";

export const ThemeContext = createContext<string>("light");
`,
				errors: [{ messageId: "missingContextDisplayName" }],
			},

			// Missing displayName on context - export via specifier
			{
				code: `
import { createContext } from "@rbxts/react";

const ThemeContext = createContext<string>("light");
export { ThemeContext };
`,
				errors: [{ messageId: "missingContextDisplayName" }],
			},

			// Missing displayName on memo - export via specifier
			{
				code: `
import { memo } from "@rbxts/react";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
export { MemoComp };
`,
				errors: [{ messageId: "missingMemoDisplayName" }],
			},

			// Missing displayName when another property is assigned
			{
				code: `
import { memo } from "@rbxts/react";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
MemoComp.title = "MemoComp";
export default MemoComp;
`,
				errors: [{ messageId: "missingMemoDisplayName" }],
			},

			// Missing displayName when using computed property access
			{
				code: `
import React from "@rbxts/react";

const Ctx = React.createContext(0);
Ctx["displayName"] = "Ctx";
export default Ctx;
`,
				errors: [{ messageId: "missingContextDisplayName" }],
			},

			// Standard React environment - memo
			{
				code: `
import { memo } from "react";

function Button() {
    return <button />;
}

const MemoButton = memo(Button);
export default MemoButton;
`,
				errors: [{ messageId: "missingMemoDisplayName" }],
				options: [{ environment: "standard" }],
			},

			// Standard React environment - createContext
			{
				code: `
import React from "react";

const AppContext = React.createContext<string>("");
export default AppContext;
`,
				errors: [{ messageId: "missingContextDisplayName" }],
				options: [{ environment: "standard" }],
			},

			// Export as default via specifier
			{
				code: `
import { memo } from "@rbxts/react";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
export { MemoComp as default };
`,
				errors: [{ messageId: "missingMemoDisplayName" }],
			},

			// Namespace import with memo
			{
				code: `
import * as React from "@rbxts/react";

function Comp() {
    return <div />;
}

const MemoComp = React.memo(Comp);
export default MemoComp;
`,
				errors: [{ messageId: "missingMemoDisplayName" }],
			},

			// Direct memo export with namespace import
			{
				code: `
import * as React from "@rbxts/react";

function Comp() {
    return <div />;
}

export default React.memo(Comp);
`,
				errors: [{ messageId: "directMemoExport" }],
			},
		],
		valid: [
			// Memo with displayName - proper pattern
			{
				code: `
import { memo } from "@rbxts/react";

function ChecklistClaimButtonNoMemo() {
    return <div />;
}

export const ChecklistClaimButton = memo(ChecklistClaimButtonNoMemo);
ChecklistClaimButton.displayName = "ChecklistClaimButton";
export default ChecklistClaimButton;
`,
				documentation: { id: "pass", title: "Memo export with display name" },
			},

			// Context with displayName - proper pattern
			{
				code: `
import React from "@rbxts/react";

const ErrorBoundaryContext = React.createContext<unknown>(undefined);
ErrorBoundaryContext.displayName = "ErrorBoundaryContext";
export default ErrorBoundaryContext;
`,
			},

			// Memo not exported (internal use only)
			{
				code: `
import { memo } from "@rbxts/react";

function Inner() {
    return <div />;
}

const MemoInner = memo(Inner);

function Container() {
    return <MemoInner />;
}

export default Container;
`,
			},

			// Context not exported (internal use only)
			{
				code: `
import { createContext, useContext } from "@rbxts/react";

const InternalContext = createContext<number>(0);

function Component() {
    const value = useContext(InternalContext);
    return <div>{value}</div>;
}

export default Component;
`,
			},

			// Not a React source - ignored
			{
				code: `
import { memo } from "some-other-package";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
export default MemoComp;
`,
			},

			// Standard environment with roblox-ts source - ignored
			{
				code: `
import { memo } from "@rbxts/react";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
export default MemoComp;
`,
				options: [{ environment: "standard" }],
			},

			// Roblox environment with standard source - ignored
			{
				code: `
import { memo } from "react";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
export default MemoComp;
`,
				options: [{ environment: "roblox-ts" }],
			},

			// Named export with displayName
			{
				code: `
import { createContext } from "@rbxts/react";

export const ThemeContext = createContext<string>("light");
ThemeContext.displayName = "ThemeContext";
`,
			},

			// Regular function export (not memo or context)
			{
				code: `
import React from "@rbxts/react";

function MyComponent() {
    return <div />;
}

export default MyComponent;
`,
			},

			// Anonymous class default export is ignored
			{
				code: "export default class {}",
			},

			// Class component export
			{
				code: `
import React from "@rbxts/react";

class MyComponent extends React.Component {
    render() {
        return <div />;
    }
}

export default MyComponent;
`,
			},

			// Arrow function component export
			{
				code: `
import React from "@rbxts/react";

const MyComponent = () => <div />;
export default MyComponent;
`,
			},

			// Renamed import for memo with displayName
			{
				code: `
import { memo as memoize } from "@rbxts/react";

function Comp() {
    return <div />;
}

export const MemoComp = memoize(Comp);
MemoComp.displayName = "MemoComp";
`,
			},

			// Renamed import for createContext with displayName
			{
				code: `
import { createContext as makeContext } from "@rbxts/react";

export const MyContext = makeContext<string>("");
MyContext.displayName = "MyContext";
`,
			},

			// @rbxts/roact source also valid for roblox-ts
			{
				code: `
import { memo } from "@rbxts/roact";

function Comp() {
    return <div />;
}

export const MemoComp = memo(Comp);
MemoComp.displayName = "MemoComp";
`,
			},

			// React-dom source valid for standard
			{
				code: `
import { createContext } from "react-dom";

export const PortalContext = createContext<unknown>(undefined);
PortalContext.displayName = "PortalContext";
`,
				options: [{ environment: "standard" }],
			},

			// Variable initialized with non-call expression
			{
				code: `
import { memo } from "@rbxts/react";

const something = "not a call";
export default something;
`,
			},

			// Destructuring pattern (not identifier)
			{
				code: `
import { memo } from "@rbxts/react";

function makeStuff() {
    return { a: 1 };
}

const { a } = makeStuff();
export default a;
`,
			},

			// Non-memo method on React namespace (hits false branch in isMemoCall)
			{
				code: `
import React from "@rbxts/react";

const element = React.createElement("div");
export default element;
`,
			},

			// Non-createContext method on React namespace (hits false branch)
			{
				code: `
import React from "@rbxts/react";

const node = React.cloneElement(<div />);
export default node;
`,
			},

			// Computed default createContext call is ignored
			{
				code: `
import React from "@rbxts/react";

export default React["createContext"](0);
`,
			},

			// Direct createContext export with unsupported namespace object is ignored
			{
				code: `
import React from "@rbxts/react";

export default getReact().createContext<number>(0);
`,
			},

			// Computed property access on React (not a MemberExpression with Identifier property)
			{
				code: `
import React from "@rbxts/react";

const methodName = "memo";
const Comp = React[methodName](() => <div />);
export default Comp;
`,
			},

			// Call expression as callee (not Identifier or MemberExpression)
			{
				code: `
import { memo } from "@rbxts/react";

function getMemo() {
    return memo;
}

const Comp = getMemo()(() => <div />);
export default Comp;
`,
			},

			// Variable not found in any scope (edge case - hits findVariable return undefined)
			{
				code: `
import React from "@rbxts/react";

function outer() {
    const Ctx = React.createContext(0);
    Ctx.displayName = "Ctx";
    return Ctx;
}

export const MyContext = outer();
`,
			},

			// Non-identifier property on member expression for callee
			{
				code: `
import React from "@rbxts/react";

const key = "createContext";
const Ctx = React[key](undefined);
export default Ctx;
`,
			},

			// Display name assignment on an untracked identifier is ignored
			{
				code: `
import { memo } from "@rbxts/react";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
Other.displayName = "Other";
MemoComp.displayName = "MemoComp";
export default MemoComp;
`,
			},

			// Display name assignment on a member expression object is ignored
			{
				code: `
import { memo } from "@rbxts/react";

function Comp() {
    return <div />;
}

const MemoComp = memo(Comp);
Namespace.MemoComp.displayName = "MemoComp";
MemoComp.displayName = "MemoComp";
export default MemoComp;
`,
			},
		],
	});
});
