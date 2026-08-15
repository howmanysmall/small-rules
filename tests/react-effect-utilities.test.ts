/*!
 * Direct tests for the react-effect analysis utilities.
 *
 * Exercises internal analysis helpers end-to-end through the rule harness:
 * each rule runner builds a full analysis for its source, so these cases
 * reach the internal branch arms that the focused rule tests cannot.
 */
import { describe } from "vitest";
import noChainStateUpdates from "$oxc-rules/react/no-chain-state-updates";
import noDerivedState from "$oxc-rules/react/no-derived-state";
import noExternalStoreSubscription from "$oxc-rules/react/no-external-store-subscription";
import noPassDataToParent from "$oxc-rules/react/no-pass-data-to-parent";

import { tsx } from "./rule-testers";

describe("react-effect utilities branch coverage", () => {
	// A non-CallExpression init on a local alias (leaf) passed to a prop
	// callback: the alias is a data leaf, and isRef's VariableDeclarator
	// init is not a CallExpression.
	tsx.run("no-pass-data-to-parent", noPassDataToParent, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const ref = instance;

  useEffect(() => {
    const local = ref;
    onChanged(local);
  }, [onChanged, ref]);
}
`,
				errors: [
					{
						data: { data: '"instance"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
		],
		valid: [],
	});

	// getStateName secondName fallback: a 2-element useState array whose
	// second element is a RestElement, not an Identifier. The rest-setter
	// call is not flagged, but the analysis walks it through getStateName.
	tsx.run("no-chain-state-updates", noChainStateUpdates, {
		invalid: [],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, ...rest] = useState(1);

  useEffect(() => {
    rest(2);
  }, [round]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Game() {
  const [round, ...rest] = useState(1);

  useEffect(() => {
    const wrapper = rest;
    wrapper(2);
  }, [round]);
}
`,
			},
		],
	});

	// The cleanup walker descends into call arguments, reaching a
	// RestElement second useState element through getStateName.
	tsx.run("no-external-store-subscription", noExternalStoreSubscription, {
		invalid: [],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Subscribe() {
  const [state, ...rest] = useState(0);

  useEffect(() => {
    setState(1);
    return () => clearInterval(rest);
  }, [state]);
}
`,
			},
		],
	});

	// An HOC whose first argument is a FunctionExpression (not an arrow)
	// exercises isWrappedInline's FunctionExpression arm.
	tsx.run("no-pass-data-to-parent", noPassDataToParent, {
		invalid: [],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";
import { withRouter } from 'react-router-dom';

const MyComponent = withRouter(function Component({ history }) {
  const [option, setOption] = useState();

  useEffect(() => {
    history.push(option);
  }, [option]);
});
`,
			},
		],
	});

	// Constant leaves of every literal shape passed to a prop callback
	// exercise isConstant's TemplateLiteral/Array/Object arms.
	tsx.run("no-pass-data-to-parent", noPassDataToParent, {
		invalid: [],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const template = \`hello\`;
  const list = [1, 2];
  const config = { retries: 3 };

  useEffect(() => {
    onChanged(template, list, config);
  }, [onChanged]);
}
`,
			},
		],
	});

	// A custom-hook parameter passed to a prop callback is not a prop and
	// not a variable declaration, so isConstant's def-type guard fires.
	tsx.run("no-pass-data-to-parent", noPassDataToParent, {
		invalid: [],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const useReporter = (onReport, value) => {
  useEffect(() => {
    onReport(value);
  }, [onReport, value]);
};
`,
			},
		],
	});

	// A component referenced as a value (not called) exercises
	// isWrappedSeparately's non-call parent branch.
	tsx.run("no-pass-data-to-parent", noPassDataToParent, {
		invalid: [],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const MyComponent = ({ onChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    onChanged(text);
  }, [onChanged, text]);

  return null;
};

const copy = MyComponent;
`,
			},
		],
	});

	// An upstream variable with a null initializer (let without init) is a
	// definition without a value node, exercising ascend's guard.
	tsx.run("no-derived-state", noDerivedState, {
		invalid: [],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  let firstName;
  const [fullName, setFullName] = useState('');
  const prefix = firstName;

  useEffect(() => {
    setFullName(prefix);
  }, [prefix]);
}
`,
			},
		],
	});
});
