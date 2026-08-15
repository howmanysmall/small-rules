import { describe } from "vitest";
import rule from "$oxc-rules/react/no-initialize-state";

import { tsx } from "./rule-testers";

describe("no-initialize-state", () => {
	tsx.run("no-initialize-state", rule, {
		invalid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		setState("Hello");
	}, []);

	return <textlabel Text={state} />;
}
`,
				documentation: { id: "fail", title: "State initialized by an effect" },
				errors: [{ data: { arguments: '"Hello"', state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads otherState to initialize the state.
	const [otherState, setOtherState] = useState("Meow");

	useEffect(() => {
		setState(otherState);
	}, []);

	return <textlabel Text={state} />;
}
`,
				errors: [{ data: { arguments: "otherState", state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		setState("Hello World");
	}, []);

	return <textlabel Text={state} />;
}
`,
				errors: [{ data: { arguments: '"Hello World"', state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		setState();
	}, []);

	return <textlabel Text={state} />;
}
`,
				errors: [{ data: { arguments: "undefined", state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const upstream = "Meow";
	const [state, setState] = useState(upstream);

	useEffect(() => {
		const upstreamTwo = "Meow";
		setState(upstreamTwo);
	}, []);

	return <textlabel Text={state} />;
}
`,
				errors: [{ data: { arguments: "upstreamTwo", state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		setState("Hello");
	}, [setState]);

	return <textlabel Text={state} />;
}
`,
				errors: [{ data: { arguments: '"Hello"', state: "state" }, messageId: "avoidInitializingState" }],
			},
			{
				// An alias-RHS setter inside the effect has no call expression; the
				// aliased call still initializes state.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		const alias = setState;
		alias("Hello");
	}, []);

	return <textlabel Text={state} />;
}
`,
				errors: [{ data: { arguments: '"Hello"', state: "state" }, messageId: "avoidInitializingState" }],
			},
		],
		valid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchData(): Promise<string>;

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		// oxlint-disable-next-line promise/prefer-await-to-then -- The promise chain keeps the setter outside the effect's synchronous flow, which the rule must treat as valid.
		void fetchData().then(
			(data) => setState(data),
			(_error: unknown) => setState(undefined),
		);
	}, []);

	return <textlabel Text={state} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const game: {
	readonly GetService: (service: string) => { readonly GetAsync: (url: string) => Promise<string> };
};

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		void (async (): Promise<void> => {
			const response = await game.GetService("HttpService").GetAsync("https://api.example.com/data");
			setState(response);
		})();
	}, []);

	return <textlabel Text={state} />;
}
`,
				documentation: { id: "pass", title: "State initialized from an async source" },
			},
			{
				// Don't know why someone would use a synchronous IIFE here,
				// hence we don't make the effort to flag it, but just documenting this behavior.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		((): void => {
			setState("Hello");
		})();
	}, []);

	return <textlabel Text={state} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "react";

declare const window: {
	readonly addEventListener: (event: string, listener: () => void) => void;
};

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		window.addEventListener("load", (): void => {
			((): void => {
				setState("Loaded");
			})();
		});
	}, []);

	return <textlabel Text={state} />;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React, { useEffect, useState } from "react";

declare const window: {
	readonly addEventListener: (event: string, listener: () => void) => void;
};

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		((): void => {
			window.addEventListener("load", () => {
				setState("Loaded");
			});
		})();
	}, []);

	return <textlabel Text={state} />;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				// We ignore this because `react-hooks/exhaustive-deps` will flag the unnecessary dependency
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();
	const [other, setOther] = useState<string | undefined>();

	useEffect(() => {
		setState("Hello");
	}, [other]);

	return (
		<textbutton Text={other} onActivated={() => setOther(undefined)}>
			<textlabel Text={state} />
		</textbutton>
	);
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call callee,
				// so `getCallExpression` cannot resolve it.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();
	const [other, setOther] = useState<string | undefined>();

	useEffect(() => {
		if (other !== undefined) {
			return setState;
		}
		return undefined;
	}, [setState, setOther]);

	return <textlabel Text={state} />;
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState` itself, so
				// `getStateName` finds no destructured declaration and yields undefined.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [data, setData] = useState<string | undefined>();
	const [other, setOther] = useState<string | undefined>();

	useEffect(() => {
		// oxlint-disable-next-line no-shadow -- The setter is bound to the hook name to exercise the rule's name resolution.
		const useState = setData;
		// oxlint-disable-next-line react-doctor/hook-use-state -- A deliberate call to the aliased setter exercises the rule's name resolution.
		useState(undefined);
	}, [setOther]);

	return (
		<textbutton Text={other} onActivated={() => setOther(undefined)}>
			<textlabel Text={data} />
		</textbutton>
	);
}
`,
			},
			{
				// An effect without a dependency array has no dependency references to analyze.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function MyComponent(): React.Element {
	const [state, setState] = useState<string | undefined>();

	useEffect(() => {
		setState("Hello");
	});

	return <textlabel Text={state} />;
}
`,
			},
		],
	});
});
