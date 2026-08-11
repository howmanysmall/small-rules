import { describe } from "vitest";
import rule from "$oxc-rules/no-chain-state-updates";

import { tsx } from "./rule-testers";

describe("no-chain-state-updates", () => {
	tsx.run("no-chain-state-updates", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (round > 10) {
      setIsGameOver(true);
    }
  }, [round]);
}
`,
				documentation: { id: "fail", title: "State update chained through an effect" },
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (round > 10) {
      const finalRound = true;
      setIsGameOver(finalRound);
    }
  }, [round]);
}
`,
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const { data: players } = useQuery('/players');

  useEffect(() => {
    if (round > 10 || players.length === 0) {
      setIsGameOver(true);
    }
  }, [round, players]);
}
`,
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const { data: players } = useQuery('/players');

  useEffect(() => {
    if (round > 10) {
      setIsGameOver(players.length === 0);
    }
  }, [round, players]);
}
`,
				errors: [{ data: { state: "isGameOver" }, messageId: "avoidChainingStateUpdates" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();
  const [otherState, setOtherState] = useState('Meow');

  useEffect(() => {
    console.log('Meow');
    setState('Hello World');
  }, [otherState]);
}
`,
				errors: [{ data: { state: "state" }, messageId: "avoidChainingStateUpdates" }],
			},
		],
		valid: [
			{
				// A setter called through `void` is not synchronous within the effect.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    void setIsGameOver(true);
  }, [round]);
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call callee,
				// so `getCallExpression` cannot resolve it.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (round > 10) {
      return setIsGameOver;
    }
  }, [round]);
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState` itself, so
				// `getStateName` finds no destructured declaration and yields undefined.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [data, useState] = useState();
  const [round, setRound] = useState(1);

  useEffect(() => {
    useState(5);
  }, [data]);
}
`,
			},
			{
				// An effect without a dependency array has no dependency references to analyze.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (round > 10) {
      setIsGameOver(true);
    }
  });
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();

  useEffect(() => {
    setSelection(null);
  }, [items]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Counter() {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => {
    setDoubleCount(count * 2);
  }, [count]);
}
`,
			},
			{
				code: `
import { useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  const handleRoundComplete = () => {
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound > 10) {
      setIsGameOver(true);
    }
  };

  return <textbutton Text={'Round ' + round} Event={{ Activated: handleRoundComplete }} />;
}
`,
				documentation: { id: "pass", title: "Related state updated together" },
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Feed() {
  const { data: posts } = useQuery('/posts');
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    setScrollPosition(0);
  }, [posts]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, [setIsMounted]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const { data: players } = useQuery('/players');

  useEffect(() => {
    setIsGameOver(round > 10 || players.length === 0);
  }, [round, players]);
}
`,
			},
			{
				// Because we don't trace the args passed to `JSON.stringify` (hard to generalize)
				code: `
import { useEffect, useState } from "@rbxts/react";

function Feed() {
  const [posts, setPosts] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    setScrollPosition(0);
  }, [JSON.stringify(posts)]);
}
`,
			},
			{
				// An alias-RHS setter inside the effect has no call expression, so
				// the rule skips it; the aliased call with state-derived args is valid.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Counter() {
  const [count, setCount] = useState(0);
  const [otherState, setOtherState] = useState();

  useEffect(() => {
    const alias = setOtherState;
    alias(otherState);
  }, [count]);
}
`,
			},
		],
	});
});
