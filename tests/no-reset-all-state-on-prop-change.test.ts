import { describe } from "vitest";
import rule from "$oxc-rules/no-reset-all-state-on-prop-change";

import { tsx } from "./rule-testers";

describe("no-reset-all-state-on-prop-change", () => {
	tsx.run("no-reset-all-state-on-prop-change", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);
  const [comment, setComment] = useState('type something');

  useEffect(() => {
    setUser(null);
    setComment('type something');
  }, [userId]);
}
`,
				documentation: { id: "fail", title: "Effect resets all state after a prop change" },
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const ProfilePage = memo(({ userId }) => {
  const [user, setUser] = useState(null);
  const [comment, setComment] = useState('type something');

  useEffect(() => {
    setUser(null);
    setComment('type something');
  }, [userId]);
})
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const initialState = 'meow meow'
  const [user, setUser] = useState(null);
  const [comment, setComment] = useState(initialState);

  useEffect(() => {
    setUser(null);
    setComment(initialState);
  }, [userId]);
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ user }) {
  const [comment, setComment] = useState('type something');

  useEffect(() => {
    setComment('type something');
  }, [user.id]);
}
`,
				errors: [{ data: { prop: "user" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId, friends }) {
  const [comment, setComment] = useState('type something');

  useEffect(() => {
    setComment('type something');
  }, [userId, friends]);
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// These are equivalent because state initializes to `undefined` when it has no argument
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selectedItem, setSelectedItem] = useState();

  useEffect(() => {
    setSelectedItem(undefined);
  }, [items]);
}
`,
				errors: [{ messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [comment, setComment] = useState(getInitialComment());

  useEffect(() => {
    setComment(getInitialComment());
  }, [userId]);
}

function getInitialComment() {
  return 'type something';
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// `React.useState` member calls count as useState declarations.
				code: `
import * as React from "@rbxts/react";
import { useEffect } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [user, setUser] = React.useState(null);
  const [comment, setComment] = React.useState("type something");

  useEffect(() => {
    setUser(null);
    setComment("type something");
  }, [userId]);
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// A call whose callee is neither an identifier nor a member expression
				// (an arrow IIFE) is skipped by `countUseStates`, but the recognized
				// setter still resets all counted state.
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(null);
  }, [userId]);

  (() => {})();
  return <div>{user}</div>;
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
			{
				// A computed member call is skipped by `countUseStates`, but the
				// recognized `React.useState` setter still resets to its initial value.
				code: `
import * as React from "@rbxts/react";
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);
  const [comment, setComment] = React["useState"]("type something");

  useEffect(() => {
    setUser(null);
  }, [userId]);
}
`,
				errors: [{ data: { prop: "userId" }, messageId: "avoidResettingAllStateWhenAPropChanges" }],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selection, setSelection] = useState();

  useEffect(() => {
    setSelection(items[0]);
  }, [items]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);
  const [comment, setComment] = useState('type something');
  const [catName, setCatName] = useState('Sparky');

  useEffect(() => {
    setUser(null);
    setComment('meow')
  }, [userId]);
}
`,
				documentation: { id: "pass", title: "Component reset with a key" },
			},
			{
				// Because undefined !== null
				code: `
import { useEffect, useState } from "@rbxts/react";

function List({ items }) {
  const [selectedItem, setSelectedItem] = useState();

  useEffect(() => {
    setSelectedItem(null);
  }, [items]);
}
`,
			},
			{
				// Verifies that the rule doesn't crash when it can't find the containing component to count `useState`s.
				// This *is* a rule-break, but detecting the lowercased function name would probably introduce more false positives than it'd save in false negatives.
				code: `
import { useEffect, useState } from "@rbxts/react";

function buildComponent() {
  const [comment, setComment] = useState('type something');

  useEffect(() => {
    setComment('type something');
  }, [userId]);

  return <div>hi</div>;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useCustomHook({ userId }) {
  const [user, setUser] = useState(null);
  const [comment, setComment] = useState('type something');

  useEffect(() => {
    setUser(null);
    setComment('type something');
  }, [userId]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const initialState = 'meow meow'
  const [comment, setComment] = useState(initialState);

  useEffect(() => {
    const derivedInitialState = initialState + '!';
    setComment(derivedInitialState);
  }, [userId]);
}
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/55
				code: `
import { useEffect, useState, useTransition } from "@rbxts/react";

const Foo = () => {
  const [_0, setState] = useState(false);
  const [_1, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      setState(true);
    });
  }, []);

  return null;
};
`,
			},
			{
				// `countUseStates` only counts member calls whose object is named `React`,
				// so an aliased namespace import is not recognized and the state isn't counted.
				code: `
import * as R from "@rbxts/react";
import { useEffect } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [comment, setComment] = R.useState("type something");

  useEffect(() => {
    setComment("type something");
  }, [userId]);
}
`,
			},
			{
				// A computed member call without a recognized setter: no state calls
				// are detected, so the effect isn't an all-state reset.
				code: `
import * as React from "@rbxts/react";
import { useEffect } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [comment, setComment] = React["useState"]("type something");

  useEffect(() => {
    setComment("type something");
  }, [userId]);
}
`,
			},
			{
				// The HOC's first argument is an options object rather than the component,
				// so `countUseStates` cannot count the component's `useState` calls.
				code: `
import { useEffect, useState } from "@rbxts/react";

const ProfilePage = mysteryWrapper(options, ({ userId }) => {
  const [comment, setComment] = useState("hi");

  useEffect(() => {
    setComment("hi");
  }, [userId]);

  return <div>{comment}</div>;
});
`,
			},
			{
				// An effect with no dependency array has no dependency references to check.
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(null);
  });
}
`,
			},
			{
				// A state setter referenced through an alias has no call expression,
				// so `isSetStateToInitialValue` can't confirm the reset.
				code: `
import { useEffect, useState } from "@rbxts/react";

function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const wrapper = setUser;
    wrapper(null);
  }, [userId]);
}
`,
			},
		],
	});
});
