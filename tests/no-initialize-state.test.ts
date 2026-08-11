import { describe } from "vitest";
import rule from "$oxc-rules/no-initialize-state";

import { tsx } from "./rule-testers";

describe("no-initialize-state", () => {
	tsx.run("no-initialize-state", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    setState("Hello");
  }, []);

  return <div>{state}</div>;
}
`,
				documentation: { id: "fail", title: "State initialized by an effect" },
				errors: [{ data: { arguments: '"Hello"', state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();
  const [otherState, setOtherState] = useState('Meow');

  useEffect(() => {
    setState(otherState);
  }, []);
}
`,
				errors: [{ data: { arguments: "otherState", state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    console.log('Meow');
    setState('Hello World');
  }, []);
}
`,
				errors: [{ data: { arguments: "'Hello World'", state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState('Meow');

  useEffect(() => {
    setState();
  }, []);
}
`,
				errors: [{ data: { arguments: "undefined", state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const upstream = 'Meow';
  const [state, setState] = useState(upstream);

  useEffect(() => {
    const upstreamTwo = 'Meow';
    setState(upstreamTwo);
  }, []);
}
`,
				errors: [{ data: { arguments: "upstreamTwo", state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    setState("Hello");
  }, [setState]);
}
`,
				errors: [{ data: { arguments: '"Hello"', state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				// An alias-RHS setter inside the effect has no call expression; the
				// aliased call still initializes state.
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    const alias = setState;
    alias("Hello");
  }, []);
}
`,
				errors: [{ data: { arguments: '"Hello"', state: "state" }, messageId: "avoidInitializingState" }],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    fetch("https://api.example.com/data")
      .then(response => response.json())
      .then(data => setState(data));
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    (async () => {
      const response = await fetch("https://api.example.com/data");
      const data = await response.json();
      setState(data);
    })();
  }, []);
}
`,
				documentation: { id: "pass", title: "State initialized during render" },
			},
			{
				// Don't know why someone would use a synchronous IIFE here,
				// hence we don't make the effort to flag it, but just documenting this behavior.
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    (() => {
      setState("Hello");
    })();
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "react";

export const MyComponent = () => {
  const [state, setState] = useState();

  useEffect(() => {
    window.addEventListener('load', () => {
      (() => {
        setState('Loaded');
      })();
    });
  }, []);
};
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect, useState } from "react";

export const MyComponent = () => {
  const [state, setState] = useState();

  useEffect(() => {
    (() => {
      window.addEventListener('load', () => {
        setState('Loaded');
      });
    })();
  }, []);
};
`,
				options: [{ environment: "standard" }],
			},
			{
				// We ignore this because `react-hooks/exhaustive-deps` will flag the unnecessary dependency
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();
  const [other, setOther] = useState();

  useEffect(() => {
    setState("Hello");
  }, [other]);
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call callee,
				// so `getCallExpression` cannot resolve it.
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();
  const [other, setOther] = useState();

  useEffect(() => {
    if (other) {
      return setState;
    }
  }, [setState, setOther]);
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState` itself, so
				// `getStateName` finds no destructured declaration and yields undefined.
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [data, useState] = useState();
  const [other, setOther] = useState();

  useEffect(() => {
    useState(5);
  }, [setOther]);
}
`,
			},
			{
				// An effect without a dependency array has no dependency references to analyze.
				code: `
import { useEffect, useState } from "@rbxts/react";

function MyComponent() {
  const [state, setState] = useState();

  useEffect(() => {
    setState("Hello");
  });
}
`,
			},
		],
	});
});
