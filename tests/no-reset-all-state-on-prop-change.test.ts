import { describe } from "vitest";
import rule from "$oxc-rules/no-reset-all-state-on-prop-change";

import { tsx } from "./rule-testers";

describe("no-reset-all-state-on-prop-change", () => {
	tsx.run("no-reset-all-state-on-prop-change", rule, {
		invalid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function recordView(): void;
declare const utilities: {
	readonly trackView: () => void;
};

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const [user, setUser] = useState<string | undefined>(undefined);
	const [comment, setComment] = useState("type something");
	recordView();
	utilities.trackView();

	useEffect(() => {
		setUser(undefined);
		setComment("type something");
	}, [userId]);

	return (
		<frame>
			<textlabel Text={user} />
			<textlabel Text={comment} />
		</frame>
	);
}
`,
				documentation: { id: "fail", title: "Effect resets all state after a prop change" },
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import React, { memo, useEffect, useState } from "@rbxts/react";

// oxlint-disable-next-line react-doctor/display-name -- The memo wrapper's declarator name is what the rule under test reports.
export const ProfilePage = memo(({ userId }: { userId: string }): React.Element => {
	const [user, setUser] = useState<string | undefined>(undefined);
	const [comment, setComment] = useState("type something");

	useEffect(() => {
		setUser(undefined);
		setComment("type something");
	}, [userId]);

	return (
		<frame>
			<textlabel Text={user} />
			<textlabel Text={comment} />
		</frame>
	);
});
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const initialState = "meow meow";
	const [user, setUser] = useState<string | undefined>(undefined);
	const [comment, setComment] = useState(initialState);

	useEffect(() => {
		setUser(undefined);
		setComment(initialState);
	}, [userId]);

	return (
		<frame>
			<textlabel Text={user} />
			<textlabel Text={comment} />
		</frame>
	);
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ user }: { user: { readonly id: string } }): React.Element {
	const [comment, setComment] = useState("type something");

	useEffect(() => {
		setComment("type something");
	}, [user.id]);

	return <textlabel Text={comment} />;
}
`,
				errors: [{ data: { prop: "user" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId, friends }: { userId: string; friends: ReadonlyArray<string> }): React.Element {
	const [comment, setComment] = useState("type something");

	useEffect(() => {
		setComment("type something");
	}, [userId, friends]);

	return <textlabel Text={comment} />;
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// These are equivalent because state initializes to `undefined` when it has no argument
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selectedItem, setSelectedItem] = useState<string | undefined>();

	useEffect(() => {
		setSelectedItem(undefined);
	}, [items]);

	return <textlabel Text={selectedItem} />;
}
`,
				errors: [{ messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const [comment, setComment] = useState(getInitialComment());

	useEffect(() => {
		setComment(getInitialComment());
	}, [userId]);

	return <textlabel Text={comment} />;
}

function getInitialComment(): string {
	return "type something";
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// `React.useState` member calls count as useState declarations.
				code: `
import React, { useEffect } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const [user, setUser] = React.useState<string | undefined>(undefined);
	const [comment, setComment] = React.useState("type something");

	useEffect(() => {
		setUser(undefined);
		setComment("type something");
	}, [userId]);

	return (
		<frame>
			<textlabel Text={user} />
			<textlabel Text={comment} />
		</frame>
	);
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// A call whose callee is neither an identifier nor a member expression
				// (an arrow IIFE) is skipped by `countUseStates`, but the recognized
				// setter still resets all counted state.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const [user, setUser] = useState<string | undefined>(undefined);

	useEffect(() => {
		setUser(undefined);
	}, [userId]);

	((): string => "ignored")();
	return <textlabel Text={user} />;
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// A computed member call is skipped by `countUseStates`, but the
				// recognized `React.useState` setter still resets to its initial value.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const [user, setUser] = useState<string | undefined>(undefined);
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store, typescript/dot-notation -- The setter stays unused and the computed member call is what countUseStates skips.
	const [comment, setComment] = React["useState"]("type something");

	useEffect(() => {
		setUser(undefined);
	}, [userId]);

	return (
		<frame>
			<textlabel Text={user} />
			<textlabel Text={comment} />
		</frame>
	);
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
		],
		valid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selection, setSelection] = useState<string | undefined>();

	useEffect(() => {
		setSelection(items[0]);
	}, [items]);

	return <textlabel Text={selection} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const [user, setUser] = useState<string | undefined>(undefined);
	const [comment, setComment] = useState("type something");
	const [catName, setCatName] = useState("Sparky");

	useEffect(() => {
		setUser(undefined);
		setComment("meow");
	}, [userId]);

	return (
		<frame>
			<textlabel Text={user} />
			<textlabel Text={comment} />
			<textbox Text={catName} TextChanged={(textbox: { readonly Text: string }) => setCatName(textbox.Text)} />
		</frame>
	);
}
`,
			},
			{
				code: `
import React, { useState } from "@rbxts/react";

export function ProfilePage(_properties: { key: string }): React.Element {
	const [comment, setComment] = useState("type something");
	return <textbox Text={comment} TextChanged={(textbox: { readonly Text: string }) => setComment(textbox.Text)} />;
}

export function Page({ userId }: { userId: string }): React.Element {
	return <ProfilePage key={userId} />;
}
`,
				documentation: { id: "pass", title: "Component reset with a key" },
			},
			{
				// Because undefined !== null
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function List({ items }: { items: ReadonlyArray<string> }): React.Element {
	const [selectedItem, setSelectedItem] = useState<string | undefined>();

	useEffect(() => {
		// oxlint-disable-next-line unicorn/no-null -- The sample relies on null differing from the undefined initial state to stay valid.
		setSelectedItem(null);
	}, [items]);

	return <textlabel Text={selectedItem} />;
}
`,
			},
			{
				// Verifies that the rule doesn't crash when it can't find the containing component to count `useState`s.
				// This *is* a rule-break, but detecting the lowercased function name would probably introduce more false positives than it'd save in false negatives.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const userId: string;

export function buildComponent(): React.Element {
	const [comment, setComment] = useState("type something");

	useEffect(() => {
		setComment("type something");
	}, [userId]);

	return <textlabel Text={comment} />;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

export function useCustomHook({ userId }: { userId: string }): {
	readonly user: string | undefined;
	readonly comment: string;
} {
	const [user, setUser] = useState<string | undefined>(undefined);
	const [comment, setComment] = useState("type something");

	useEffect(() => {
		setUser(undefined);
		setComment("type something");
	}, [userId]);

	return { comment, user };
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const initialState = "meow meow";
	const [comment, setComment] = useState(initialState);

	useEffect(() => {
		const derivedInitialState = \`\${initialState}!\`;
		setComment(derivedInitialState);
	}, [userId]);

	return <textlabel Text={comment} />;
}
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/55
				code: `
import React, { useEffect, useState, useTransition } from "@rbxts/react";

export function Foo(): React.Element {
	const [pending, setPending] = useState(false);
	const [, startTransition] = useTransition();

	useEffect(() => {
		startTransition((): void => {
			setPending(true);
		});
	}, []);

	return <textlabel Text={pending} />;
}
`,
			},
			{
				// `countUseStates` only counts member calls whose object is named `React`,
				// so a differently-named object isn't recognized and the state isn't counted.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const utilities = { useState };
	const [comment, setComment] = utilities.useState("type something");

	useEffect(() => {
		setComment("type something");
	}, [userId]);

	return <textlabel Text={comment} />;
}
`,
			},
			{
				// A computed member call without a recognized setter: no state calls
				// are detected, so the effect isn't an all-state reset.
				code: `
import React, { useEffect } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	// oxlint-disable-next-line typescript/dot-notation -- The computed member call is skipped by countUseStates; dot notation would be counted.
	const [comment, setComment] = React["useState"]("type something");

	useEffect(() => {
		setComment("type something");
	}, [userId]);

	return <textlabel Text={comment} />;
}
`,
			},
			{
				// The HOC's first argument is an options object rather than the component,
				// so `countUseStates` cannot count the component's `useState` calls.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const options: { readonly kind: string };
declare function mysteryWrapper(
	options: { readonly kind: string },
	component: (properties: { readonly userId: string }) => React.Element,
): React.Element;

const ProfilePage = mysteryWrapper(options, ({ userId }: { userId: string }): React.Element => {
	const [comment, setComment] = useState("hi");

	useEffect(() => {
		setComment("hi");
	}, [userId]);

	return <textlabel Text={comment} />;
});

export default ProfilePage;
`,
			},
			{
				// An effect with no dependency array has no dependency references to check.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage(): React.Element {
	const [user, setUser] = useState<string | undefined>(undefined);

	useEffect(() => {
		setUser(undefined);
	});

	return <textlabel Text={user} />;
}
`,
			},
			{
				// A state setter referenced through an alias has no call expression,
				// so `isSetStateToInitialValue` can't confirm the reset.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function ProfilePage({ userId }: { userId: string }): React.Element {
	const [user, setUser] = useState<string | undefined>(undefined);

	useEffect(() => {
		const wrapper = setUser;
		wrapper(undefined);
	}, [userId]);

	return <textlabel Text={user} />;
}
`,
			},
		],
	});
});
