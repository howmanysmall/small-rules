import { describe } from "vitest";
import rule from "$oxc-rules/no-pass-live-state-to-parent";

import { tsx } from "./rule-testers";

describe("no-pass-live-state-to-parent", () => {
	tsx.run("no-pass-live-state-to-parent", rule, {
		invalid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		onTextChanged(text);
	}, [onTextChanged, text]);

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
}
`,
				documentation: { id: "fail", title: "Effect passes live state to a parent" },
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		onTextChanged(text);
	});

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		onTextChanged(text);
	}, []);

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

export function useCustomHook({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): void {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads the state value.
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		onTextChanged(text);
	}, [onTextChanged, text]);
}
`,
				errors: [
					{
						data: { name: '"useCustomHook"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInHook",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useSomeAPI(): string;

export function Child({
	onTextChanged,
}: {
	onTextChanged: (text: string | undefined, data: string) => void;
}): React.Element {
	const [text, setText] = useState<string | undefined>();
	const data = useSomeAPI();

	useEffect(() => {
		onTextChanged(text, data);
	}, [onTextChanged, text, data]);

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		const [firstCharacter] = text;
		onTextChanged(firstCharacter);
	}, [onTextChanged, text]);

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onFetched }: { onFetched: (value: string | undefined) => void }): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads the state value.
	const [data, setData] = useState<string | undefined>();

	function onFetchedWrapper(value: string | undefined): void {
		onFetched(value);
	}

	useEffect(() => {
		onFetchedWrapper(data);
	}, [onFetched, data]);

	return <textlabel Text={data} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"data"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child(properties: { readonly onFetched: (value: string | undefined) => void }): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads the state value.
	const [data, setData] = useState<string | undefined>();
	const { onFetched } = properties;

	useEffect(() => {
		onFetched(data);
	}, [onFetched, data]);

	return <textlabel Text={data} />;
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"data"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ onSubmit }: { onSubmit: (data: { readonly name: string }) => void }): React.Element {
	const [name, setName] = useState("");
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit === undefined) return;

		onSubmit(dataToSubmit);
	}, [dataToSubmit]);

	return (
		<frame>
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
			<textbutton Text="Submit" Activated={() => setDataToSubmit({ name })} />
		</frame>
	);
}
`,
				errors: [
					{
						data: { name: '"Form"', state: '"dataToSubmit"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Child({ onChanged }: { onChanged: (text: string | undefined, count: number) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();
	const [count, setCount] = useState(0);

	useEffect(() => {
		onChanged(text, count);
	}, [onChanged, text, count]);

	return (
		<frame>
			<textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text" and "count"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				// An effect callback inside a custom hook reports the hook name.
				code: `
import { useEffect, useState } from "@rbxts/react";

export function useCustomHook(onChanged: (text: string | undefined) => void): void {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads the state value.
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		onChanged(text);
	}, [onChanged, text]);
}
`,
				errors: [
					{
						data: { name: '"useCustomHook"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInHook",
					},
				],
			},
			{
				// A memo-wrapped arrow reports the component's declared name.
				code: `
import React, { memo, useEffect, useState } from "@rbxts/react";

// oxlint-disable-next-line react-doctor/display-name -- The memo wrapper's declarator name is what the rule under test reports.
export const Child = memo(({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): React.Element => {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		onTextChanged(text);
	}, [onTextChanged, text]);

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
});
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
		],
		valid: [
			{
				// A literal callback argument is not live state, so there is nothing to report.
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
import React, { useState } from "@rbxts/react";

function Child({ text, onTextChanged }: { text: string; onTextChanged: (text: string) => void }): React.Element {
	return (
		<textbox
			Text={text}
			TextChanged={(textbox: { readonly Text: string }): void => {
				onTextChanged(textbox.Text);
			}}
		/>
	);
}

export function Parent(): React.Element {
	const [text, setText] = useState("");

	return <Child text={text} onTextChanged={setText} />;
}
`,
				documentation: { id: "pass", title: "Parent owns the state" },
			},
			{
				// A setter passed as a callback argument is not a call, so there is nothing to report.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function registerCallback(callback: (text: string | undefined) => void): void;

export function Child({ onTextChanged }: { onTextChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		registerCallback(setText);
	}, [onTextChanged, setText]);

	return <textlabel Text={text} />;
}
`,
			},
			{
				// An alias of a prop callback that is itself passed as an argument (not called)
				// has a prop-call chain but no call expression.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function registerCallback(callback: (text: string | undefined) => void): void;

export function Child({ onChanged }: { onChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		const wrapper = onChanged;
		registerCallback(wrapper);
	}, [onChanged, text]);

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
}
`,
			},
			{
				// A wrapper arrow invoked later defers the callback outside the synchronous effect body.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function registerCallback(callback: (text: string | undefined) => void): void;

export function Child({ onChanged }: { onChanged: (text: string | undefined) => void }): React.Element {
	const [text, setText] = useState<string | undefined>();

	useEffect(() => {
		function wrapper(value: string | undefined): void {
			onChanged(value);
		}
		registerCallback(wrapper);
	}, [onChanged, text]);

	return <textbox Text={text} TextChanged={(textbox: { readonly Text: string }) => setText(textbox.Text)} />;
}
`,
			},
			{
				// No idea why someone would do this, but maybe there's a less contrived pattern.
				// Plus the rule's message and linked docs only mention state - obviously you can't "lift" a prop.
				code: `
import React, { useEffect } from "@rbxts/react";

export function Child({ text, onTextChanged }: { text: string; onTextChanged: (text: string) => void }): React.Element {
	useEffect(() => {
		onTextChanged(text);
	}, [text, onTextChanged]);

	return <textlabel Text={text} />;
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
import React, { useEffect, useState } from "@rbxts/react";

declare function inject(
	storeName: string,
): (
	component: (properties: {
		readonly ourStore: { readonly push: (option: string | undefined) => void };
	}) => React.Element,
) => (properties: { readonly ourStore: { readonly push: (option: string | undefined) => void } }) => React.Element;
declare function observer(
	component: (properties: {
		readonly ourStore: { readonly push: (option: string | undefined) => void };
	}) => React.Element,
): (properties: { readonly ourStore: { readonly push: (option: string | undefined) => void } }) => React.Element;

const MyComponent = inject("ourStore")(
	// oxlint-disable-next-line react-doctor/display-name -- The HOC wrapper's declarator name is what the sample exercises.
	observer(({ ourStore }: { ourStore: { readonly push: (option: string | undefined) => void } }): React.Element => {
		// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only pushes the current option.
		const [option, setOption] = useState<string | undefined>();

		useEffect(() => {
			ourStore.push(option);
		}, [option]);

		return <textlabel Text={option} />;
	}),
);

export default MyComponent;
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function withRouter(
	component: (properties: { readonly history: { readonly push: (path: string) => void } }) => React.Element,
): () => React.Element;

// oxlint-disable-next-line func-style -- The arrow keeps the HOC-wrapped-separately shape that the rule's name resolution relies on.
const MyComponent = ({ history }: { history: { readonly push: (path: string) => void } }): React.Element => {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only pushes the current option.
	const [option, setOption] = useState<string | undefined>();

	useEffect(() => {
		history.push(option ?? "");
	}, [option]);

	return <textlabel Text={option} />;
};

export const wrapped = withRouter(MyComponent);
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/46
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function inject(storeName: string): (component: () => React.Element) => () => React.Element;
declare function observer(
	component: (properties: { readonly history: { readonly push: (path: string) => void } }) => React.Element,
): () => React.Element;

// oxlint-disable-next-line func-style -- The arrow keeps the HOC-wrapped-separately shape that the rule's name resolution relies on.
const MyComponent = ({ history }: { history: { readonly push: (path: string) => void } }): React.Element => {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only pushes the current option.
	const [option, setOption] = useState<string | undefined>();

	useEffect(() => {
		history.push(option ?? "");
	}, [option]);

	return <textlabel Text={option} />;
};

const EnhancedComponent = inject("ourStore")(observer(MyComponent));
export default EnhancedComponent;
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
			history.push(data.error ?? "/error");
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

	return <div ref={ref}>Child</div>;
}
`,
			},
		],
	});
});
