import { describe } from "vitest";

import rule from "$oxc-rules/react/no-pass-data-to-parent";

import { tsx } from "./rule-testers";

describe("no-pass-data-to-parent", () => {
	tsx.run("no-pass-data-to-parent", rule, {
		invalid: [
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare function useSomeAPI(): string;

export function Child({ onFetched }: { onFetched: (data: string) => void }): React.Element {
	const data = useSomeAPI();

	useEffect(() => {
		onFetched(data);
	}, [onFetched, data]);

	return <textlabel Text={data} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', data: '"useSomeAPI"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
				documentation: { id: "fail", title: "Effect passes fetched data to a parent" },
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare function useSomeAPI(): string;

export function Child({ onFetched }: { onFetched: (data: string) => void }): React.Element {
	const data = useSomeAPI();

	useEffect(() => {
		onFetched(data);
	});

	return <textlabel Text={data} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', data: '"useSomeAPI"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare function useSomeAPI(): string;

export function Child({ onFetched }: { onFetched: (data: string) => void }): React.Element {
	const data = useSomeAPI();

	useEffect(() => {
		onFetched(data);
	}, []);

	return <textlabel Text={data} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', data: '"useSomeAPI"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

declare function useSomeAPI(): string;

export function useCustomHook({ onFetched }: { onFetched: (data: string) => void }): void {
	const data = useSomeAPI();

	useEffect(() => {
		onFetched(data);
	}, [onFetched, data]);
}
`,
				errors: [
					{
						data: { name: '"useCustomHook"', data: '"useSomeAPI"' },
						messageId: "avoidPassingDataToParentInHook",
					},
				],
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare function useSomeAPI(): ReadonlyArray<string>;

export function Child({ onFetched }: { onFetched: (element: string | undefined) => void }): React.Element {
	const data = useSomeAPI();
	const [firstElement] = data;

	useEffect(() => {
		onFetched(firstElement);
	}, [onFetched, firstElement]);

	return <textlabel Text={firstElement} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', data: '"useSomeAPI"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare function useSomeAPI(): string;
declare function useOtherAPI(): string;

export function Child({ onResult }: { onResult: (data: string, meta: string) => void }): React.Element {
	const data = useSomeAPI();
	const meta = useOtherAPI();

	useEffect(() => {
		onResult(data, meta);
	}, [onResult, data, meta]);

	return <textlabel Text={data} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', data: '"useSomeAPI" and "useOtherAPI"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useSomeAPI(): string;

export function Child({ onChanged }: { onChanged: (data: string, count: number) => void }): React.Element {
	const [count, setCount] = useState(0);
	const data = useSomeAPI();

	useEffect(() => {
		onChanged(data, count);
	}, [onChanged, data, count]);

	return (
		<frame>
			<textlabel Text={data} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [
					{
						data: { name: '"Child"', data: '"useSomeAPI"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				// A memo-wrapped component still reports the declared component
				// name.
				code: `
import React, { memo, useEffect } from "@rbxts/react";

declare function useSomeAPI(): string;

// oxlint-disable-next-line react-doctor/display-name -- The memo wrapper's declarator name is what the rule under test reports.
export const Child = memo(({ onFetched }: { onFetched: (data: string) => void }): React.Element => {
	const data = useSomeAPI();

	useEffect(() => {
		onFetched(data);
	}, [onFetched, data]);

	return <textlabel Text={data} />;
});
`,
				errors: [
					{
						data: { name: '"Child"', data: '"useSomeAPI"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
		],
		valid: [
			{
				// A literal callback argument is not data, so there is nothing
				// to report.
				code: `
import React, { useEffect } from "@rbxts/react";

export function Child({ onTextChanged }: { onTextChanged: (text: string) => void }): React.Element {
	useEffect(() => {
		onTextChanged("Hello World");
	}, [onTextChanged]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

declare function useSomeAPI(): string;

function Child({ data }: { data: string }): React.Element {
	return <textlabel Text={data} />;
}

export function Parent(): React.Element {
	const data = useSomeAPI();

	return <Child data={data} />;
}
`,
				documentation: { id: "pass", title: "Parent owns the data" },
			},
			{
				// Passing the `useState` callee itself as data is not flagged.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onChanged }: { onChanged: (value: unknown) => void }): React.Element {
	useEffect(() => {
		onChanged(useState);
	}, [onChanged]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				// Passing the `useRef` callee itself as data is not flagged.
				code: `
import React, { useEffect, useRef } from "@rbxts/react";

export function Child({ onChanged }: { onChanged: (value: unknown) => void }): React.Element {
	useEffect(() => {
		onChanged(useRef);
	}, [onChanged]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

export function Child({ onTextChanged }: { onTextChanged: (text: string) => void }): React.Element {
	const hello = "Hello";
	const world = "World";
	const greeting = \`\${hello} \${world}\`;
	useEffect(() => {
		onTextChanged(greeting);
	}, [onTextChanged]);

	return <textlabel Text={greeting} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		onTextChanged(text);
	}, [onTextChanged, text]);

	return (
		<input
			type="text"
			value={text}
			onChange={(event: { readonly target: { readonly value: string } }) => setText(event.target.value)}
		/>
	);
}
`,
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

export function Child({ text, onTextChanged }: { text: string; onTextChanged: (text: string) => void }): React.Element {
	useEffect(() => {
		onTextChanged(text);
	}, [onTextChanged, text]);

	return (
		<input
			type="text"
			value={text}
			onChange={(event: { readonly target: { readonly value: string } }): void => {
				onTextChanged(event.target.value);
			}}
		/>
	);
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ onClose }: { onClose: () => void }): React.Element {
	const [name, setName] = useState("");
	const [isOpen, setIsOpen] = useState(true);

	useEffect(() => {
		if (isOpen === false) {
			onClose();
		}
	}, [isOpen]);

	return (
		<frame>
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
			<textbutton Text="Close" Activated={() => setIsOpen(false)} />
		</frame>
	);
}
`,
			},
			{
				// This might be an anti-pattern in the first place...
				code: `
import React, { useEffect } from "@rbxts/react";

export function Child({ getData }: { getData: () => string }): React.Element {
	useEffect(() => {
		// oxlint-disable-next-line no-console -- The console call is a stand-in for side effects the rule ignores.
		console.log(getData());
	}, [getData]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function withRouter(
	component: (properties: { readonly history: { readonly push: (path: string) => void } }) => React.Element,
): () => React.Element;

const MyComponent = withRouter(({ history }: { history: { readonly push: (path: string) => void } }): React.Element => {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only pushes the current option.
	const [option, setOption] = useState<string | undefined>();

	useEffect(() => {
		history.push(option ?? "");
	}, [option]);

	return <textlabel Text={option} />;
});

export default MyComponent;
`,
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare function withRouter(
	component: (properties: { readonly history: { readonly push: (path: string) => void } }) => React.Element,
): () => React.Element;
declare function useSomeAPI(): { readonly error?: string };

const MyComponent = withRouter(({ history }: { history: { readonly push: (path: string) => void } }): React.Element => {
	const data = useSomeAPI();

	useEffect(() => {
		if (data.error !== undefined) {
			history.push("/error");
		}
	}, [data]);

	return <textlabel Text={data.error} />;
});

export default MyComponent;
`,
			},
			{
				code: `
import React, { useEffect, useRef } from "@rbxts/react";

export function Child({ onRef }: { onRef: (value: unknown) => void }): React.Element {
	const ref = useRef<unknown>(undefined);

	useEffect(() => {
		onRef(ref.current);
	}, [onRef, ref.current]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/37
				// Alternate solutions exist, but this is arguably the most
				// readable.
				code: `
import React from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

export function DeleteDropTarget({ onDelete }: { onDelete: (data: unknown) => void }): React.Element {
	const ref = React.useRef<unknown>(undefined);

	React.useEffect(() => {
		const element = ref.current;
		return element === undefined
			? undefined
			: dropTargetForElements({
					element,
					onDrop: ({ source }: { source: { readonly data: unknown } }): void => {
						onDelete(source.data);
					},
				});
	}, [onDelete]);

	return <div ref={ref}>Drop an item here to delete</div>;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/43
				code: `
import { useEffect } from "@rbxts/react";

export function useActorLogger(actorRef: {
	readonly system: {
		readonly inspect: (callback: (event: { readonly type: string; readonly snapshot: string }) => void) => {
			readonly unsubscribe: () => void;
		};
	};
}): void {
	useEffect(() => {
		const subscription = actorRef.system.inspect(
			(event: { readonly type: string; readonly snapshot: string }): void => {
				if (event.type === "@xstate.snapshot") {
					// oxlint-disable-next-line no-console -- The console call is a stand-in for logging the inspected snapshot.
					console.log("ACTOR SNAPSHOT", event.snapshot);
				}
			},
		).unsubscribe;
		return subscription;
	}, [actorRef]);
}
`,
			},
			{
				code: `
import React, { useEffect, useRef } from "@rbxts/react";

export function Child({ onClicked }: { onClicked: (event: { readonly type: string }) => void }): React.Element {
	const ref = useRef<
		| {
				readonly addEventListener: (
					event: string,
					callback: (event: { readonly type: string }) => void,
				) => void;
		  }
		| undefined
	>(undefined);

	useEffect(() => {
		ref.current?.addEventListener("click", (event: { readonly type: string }): void => {
			onClicked(event);
		});
	}, [onClicked, ref]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

export function Child({
	ref,
}: {
	ref: {
		readonly current: {
			readonly addEventListener: (event: string, callback: (event: { readonly type: string }) => void) => void;
		};
	};
}): React.Element {
	useEffect(() => {
		ref.current.addEventListener("click", (event: { readonly type: string }): void => {
			// oxlint-disable-next-line no-console -- The console call is a stand-in for listener side effects the rule ignores.
			console.log("Clicked", event);
		});
	}, [ref]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare const viewport: {
	readonly addEventListener: (event: string, callback: (event: { readonly type: string }) => void) => void;
	readonly innerHeight: number;
	readonly innerWidth: number;
	readonly removeEventListener: (event: string, callback: (event: { readonly type: string }) => void) => void;
};

export function Child({
	onResized,
}: {
	onResized: (size: { readonly height: number; readonly width: number }) => void;
}): React.Element {
	useEffect(() => {
		function handleResize(): void {
			onResized({ height: viewport.innerHeight, width: viewport.innerWidth });
		}
		viewport.addEventListener("resize", handleResize);
		return (): void => {
			viewport.removeEventListener("resize", handleResize);
		};
	}, [onResized]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				// A member expression that is not a React hook is treated as
				// data.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onChanged }: { onChanged: (value: unknown) => void }): React.Element {
	const api = { useState };

	useEffect(() => {
		onChanged(api.useState);
	}, [onChanged]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				// A member expression that is not a React hook is treated as
				// data.
				code: `
import React, { useEffect, useRef } from "@rbxts/react";

export function Child({ onChanged }: { onChanged: (value: unknown) => void }): React.Element {
	const api = { useRef };

	useEffect(() => {
		onChanged(api.useRef);
	}, [onChanged]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				// An alias of a prop callback that is itself passed as an
				// argument has a prop-call chain but no call expression.
				code: `
import React, { useEffect } from "@rbxts/react";

declare function registerCallback(callback: () => void): void;
declare function useSomeAPI(): string;

export function Child({ onChanged }: { onChanged: () => void }): React.Element {
	const data = useSomeAPI();

	useEffect(() => {
		const wrapper = onChanged;
		registerCallback(wrapper);
	}, [onChanged, data]);

	return <textlabel Text={data} />;
}
`,
			},
			{
				// A prop callback passed as an argument (not called) has no call
				// expression.
				code: `
import React, { useEffect } from "@rbxts/react";

declare function registerCallback(callback: () => void): void;

export function Child({ onChanged }: { onChanged: () => void }): React.Element {
	useEffect(() => {
		registerCallback(onChanged);
	}, [onChanged]);

	return <textlabel Text="Hello World" />;
}
`,
			},
			{
				// A callback used asynchronously is not considered a synchronous
				// call.
				code: `
import React, { useEffect } from "@rbxts/react";

declare function fetchData(): Promise<unknown>;
declare function useSomeAPI(): string;

export function Child({ onChanged }: { onChanged: (data: string) => void }): React.Element {
	const data = useSomeAPI();

	useEffect(() => {
		void (async (): Promise<void> => {
			await fetchData();
			onChanged(data);
		})();
	}, [onChanged, data]);

	return <textlabel Text={data} />;
}
`,
			},
			{
				// A ref object received from props has its `current` access
				// skipped as data.
				code: `
import React, { useEffect } from "@rbxts/react";

export function Child({
	onChanged,
	ref,
}: {
	onChanged: (value: unknown) => void;
	ref: { readonly current: unknown };
}): React.Element {
	useEffect(() => {
		onChanged(ref.current);
	}, [onChanged, ref]);

	return <textlabel Text="Hello World" />;
}
`,
			},
		],
	});
});
