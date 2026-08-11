import { describe } from "vitest";
import rule from "$oxc-rules/no-adjust-state-on-prop-change";

import { tsx } from "./rule-testers";

describe("no-adjust-state-on-prop-change", () => {
	tsx.run("no-adjust-state-on-prop-change", rule, {
		invalid: [
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
				documentation: { id: "fail", title: "State adjusted after a prop change" },
				errors: [
					{
						data: { props: '"items"', state: "selection" },
						messageId: "avoidAdjustingStateWhenAPropChanges",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();
  const [internalData, setInternalData] = useState();

  useEffect(() => {
    setSelection(internalData);
  }, [items, internalData]);
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
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();
  const { data: externalData } = useDataSource();

  useEffect(() => {
    setSelection(externalData);
  }, [items]);
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
import { useEffect, useState } from "@rbxts/react";

function Form({ result }) {
  const [error, setError] = useState();

  useEffect(() => {
    if (result.data) {
      setError(null);
    }
  }, [result]);
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
import { useEffect, useState } from "@rbxts/react";

function List({ items, user }) {
  const [selection, setSelection] = useState();

  useEffect(() => {
    setSelection(null);
  }, [items, user]);
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
				// An alias-RHS setter inside the effect has no call expression; the
				// aliased call still adjusts state when the prop changes.
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();

  useEffect(() => {
    const alias = setSelection;
    alias(null);
  }, [items]);
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
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selection, setSelection] = useState(null);

  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }
}
`,
				documentation: { id: "pass", title: "State adjusted during render" },
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Counter() {
  const [count, setCount] = useState(0);
  const [otherState, setOtherState] = useState();

  useEffect(() => {
    setOtherState('Hello World');
  }, [count]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Counter({ count }) {
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => {
    setDoubleCount(count * 2);
  }, [count]);
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call callee,
				// so `getCallExpression` cannot resolve it.
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();

  useEffect(() => {
    if (items.length > 0) {
      return setSelection;
    }
  }, [items]);
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState` itself, so
				// `getStateName` finds no destructured declaration and yields undefined.
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [data, useState] = useState();

  useEffect(() => {
    useState(5);
  }, [items]);
}
`,
			},
			{
				// An effect without a dependency array has no dependency references to analyze.
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();

  useEffect(() => {
    setSelection(5);
  });
}
`,
			},
			{
				// A setter called through `void` is not synchronous within the effect.
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();

  useEffect(() => {
    void setSelection(5);
  }, [items]);
}
`,
			},
		],
	});
});
