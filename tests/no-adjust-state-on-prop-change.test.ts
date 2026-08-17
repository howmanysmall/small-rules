import { describe } from "vitest";
import rule from "$oxc-rules/react/no-adjust-state-on-prop-change";

import { tsx } from "./rule-testers";

describe("no-adjust-state-on-prop-change", () => {
	tsx.run("no-adjust-state-on-prop-change", rule, {
		invalid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		setSelection(undefined);
	}, [items]);

	return <textlabel Text={selection} />;
}
`,
				errors: [
					{
						data: { props: '"items"', state: "selection" },
						messageId: "avoidAdjustingStateWhenAPropChanges",
					},
				],
				documentation: { id: "fail", title: "State adjusted after a prop change" },
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads internalData from the effect.
	const [internalData, setInternalData] = useState<string | undefined>();

	useEffect(() => {
		setSelection(internalData);
	}, [items, internalData]);

	return <textlabel Text={selection} />;
}
`,
				errors: [
					{
						data: { props: '"items"', state: "selection" },
						messageId: "avoidAdjustingStateWhenAPropChanges",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useDataSource(): { readonly data: string | undefined };

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();
	const { data: externalData } = useDataSource();

	useEffect(() => {
		setSelection(externalData);
	}, [items]);

	return <textlabel Text={selection} />;
}
`,
				errors: [
					{
						data: { props: '"items"', state: "selection" },
						messageId: "avoidAdjustingStateWhenAPropChanges",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ result }: { result: { readonly data?: string } }): React.Element {
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		if (result.data !== undefined) {
			setError(undefined);
		}
	}, [result]);

	return <textlabel Text={error} />;
}
`,
				errors: [
					{
						data: { props: '"result"', state: "error" },
						messageId: "avoidAdjustingStateWhenAPropChanges",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items, user }: { items: ReadonlyArray<string>; user: string }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		setSelection(undefined);
	}, [items, user]);

	return <textlabel Text={selection} />;
}
`,
				errors: [
					{
						data: { props: '"items" and "user"', state: "selection" },
						messageId: "avoidAdjustingStateWhenAPropChanges",
					},
				],
			},
			{
				// An alias-RHS setter inside the effect has no call expression;
				// the aliased call still adjusts state when the prop changes.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		const alias = setSelection;
		alias(undefined);
	}, [items]);

	return <textlabel Text={selection} />;
}
`,
				errors: [
					{
						data: { props: '"items"', state: "selection" },
						messageId: "avoidAdjustingStateWhenAPropChanges",
					},
				],
			},
		],
		valid: [
			{
				code: `
import React, { useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>(undefined);
	const [previousItems, setPreviousItems] = useState(items);

	if (items !== previousItems) {
		setPreviousItems(items);
		setSelection(undefined);
	}

	return <textlabel Text={selection} />;
}
`,
				documentation: { id: "pass", title: "State adjusted during render" },
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	const [otherState, setOtherState] = useState<string | undefined>();

	useEffect(() => {
		setOtherState("Hello World");
	}, [count]);

	return (
		<textbutton Text={count} onActivated={() => setCount(count + 1)}>
			<textlabel Text={otherState} />
		</textbutton>
	);
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter({ count }: { count: number }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(count * 2);
	}, [count]);

	return <textlabel Text={doubleCount} />;
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call
				// callee, so `getCallExpression` cannot resolve it.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		if (items.length > 0) {
			return setSelection;
		}
		return undefined;
	}, [items]);

	return <textlabel Text={selection} />;
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState`
				// itself, so `getStateName` finds no destructured declaration and
				// yields undefined.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [data, setData] = useState<string | undefined>();

	useEffect(() => {
		// oxlint-disable-next-line no-shadow -- The setter is bound to the hook name to exercise the rule's name resolution.
		const useState = setData;
		// oxlint-disable-next-line react-doctor/hook-use-state -- A deliberate call to the aliased setter exercises the rule's name resolution.
		useState(undefined);
	}, [items]);

	return <textlabel Text={data} />;
}
`,
			},
			{
				// An effect without a dependency array has no dependency
				// references to analyze.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List(): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		setSelection(5);
	});

	return <textlabel Text={selection} />;
}
`,
			},
			{
				// A setter called through `void` is not synchronous within the
				// effect.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		void setSelection(5);
	}, [items]);

	return <textlabel Text={selection} />;
}
`,
			},
		],
	});
});
