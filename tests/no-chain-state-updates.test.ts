import { describe } from "vitest";
import rule from "$oxc-rules/react/no-chain-state-updates";

import { tsx } from "./rule-testers";

describe("no-chain-state-updates", () => {
	tsx.run("no-chain-state-updates", rule, {
		invalid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);

	useEffect(() => {
		if (round > 10) {
			setIsGameOver(true);
		}
	}, [round]);

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
				documentation: { id: "fail", title: "State update chained through an effect" },
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);

	useEffect(() => {
		if (round <= 10) return;
		const finalRound = true;
		setIsGameOver(finalRound);
	}, [round]);

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: ReadonlyArray<string> };

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);
	const { data: players } = useQuery("/players");

	useEffect(() => {
		if (round > 10 || players.length === 0) {
			setIsGameOver(true);
		}
	}, [round, players]);

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: ReadonlyArray<string> };

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);
	const { data: players } = useQuery("/players");

	useEffect(() => {
		if (round > 10) {
			setIsGameOver(players.length === 0);
		}
	}, [round, players]);

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only chains the state update.
	const [otherState, setOtherState] = useState("Meow");

	useEffect(() => {
		setState("Hello World");
	}, [otherState]);

	return <textlabel Text={state} />;
}
`,
				errors: [{ data: { state: "state" }, messageId: "avoidChainingStateUpdates" }],
			},
		],
		valid: [
			{
				// A setter called through `void` is not synchronous within the
				// effect.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);

	useEffect(() => {
		void setIsGameOver(true);
	}, [round]);

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call
				// callee, so `getCallExpression` cannot resolve it.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);

	// oxlint-disable-next-line typescript/consistent-return -- The conditional return leaves the setter outside any call callee, which the rule must treat as valid.
	useEffect(() => {
		if (round > 10) {
			return setIsGameOver;
		}
	}, [round]);

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState`
				// itself, so `getStateName` finds no destructured declaration and
				// yields undefined.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Game(): React.Element {
	const [data, setData] = useState<number | undefined>();

	useEffect(() => {
		// oxlint-disable-next-line no-shadow -- The setter is bound to the hook name to exercise the rule's name resolution.
		const useState = setData;
		// oxlint-disable-next-line react-doctor/hook-use-state -- A deliberate call to the aliased setter exercises the rule's name resolution.
		useState(5);
	}, [data]);

	return <textlabel Text={data} />;
}
`,
			},
			{
				// An effect without a dependency array has no dependency
				// references to analyze.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);

	useEffect(() => {
		if (round > 10) {
			setIsGameOver(true);
		}
	});

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		setSelection(undefined);
	}, [items]);

	return (
		<textbox Text={selection} TextChanged={(textbox: { readonly Text: string }) => setSelection(textbox.Text)} />
	);
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(count * 2);
	}, [count]);

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
			},
			{
				code: `
import React, { useState } from "@rbxts/react";

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);

	function handleRoundComplete(): void {
		const nextRound = round + 1;
		setRound(nextRound);
		if (nextRound > 10) {
			setIsGameOver(true);
		}
	}

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} Event={{ Activated: handleRoundComplete }} />
		</frame>
	);
}
`,
				documentation: { id: "pass", title: "Related state updated together" },
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: ReadonlyArray<string> };

export function Feed(): React.Element {
	const { data: posts } = useQuery("/posts");
	const [scrollPosition, setScrollPosition] = useState(0);

	useEffect(() => {
		setScrollPosition(0);
	}, [posts]);

	return <textlabel Text={scrollPosition} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Component(): React.Element {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
		return (): void => {
			setIsMounted(false);
		};
	}, [setIsMounted]);

	return <textlabel Text={isMounted} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: ReadonlyArray<string> };

export function Game(): React.Element {
	const [round, setRound] = useState(1);
	const [isGameOver, setIsGameOver] = useState(false);
	const { data: players } = useQuery("/players");

	useEffect(() => {
		setIsGameOver(round > 10 || players.length === 0);
	}, [round, players]);

	return (
		<frame>
			<textlabel Text={isGameOver} />
			<textbutton Text={round} onActivated={() => setRound(round + 1)} />
		</frame>
	);
}
`,
			},
			{
				// Because we don't trace the args passed to `JSON.stringify`
				// (hard to generalize)
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Feed(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only resets the scroll position.
	const [posts, setPosts] = useState<ReadonlyArray<string>>([]);
	const [scrollPosition, setScrollPosition] = useState(0);

	useEffect(() => {
		setScrollPosition(0);
	}, [JSON.stringify(posts)]);

	return <textlabel Text={scrollPosition} />;
}
`,
			},
			{
				// An alias-RHS setter inside the effect has no call expression,
				// so the rule skips it; the aliased call with state-derived args
				// is valid.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	const [otherState, setOtherState] = useState<string | undefined>();

	useEffect(() => {
		const alias = setOtherState;
		alias(otherState);
	}, [count]);

	return (
		<frame>
			<textlabel Text={otherState} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
			},
		],
	});
});
