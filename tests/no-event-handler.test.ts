import { describe } from "vitest";
import rule from "$oxc-rules/no-event-handler";

import { tsx } from "./rule-testers";

describe("no-event-handler", () => {
	tsx.run("no-event-handler", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ dataToSubmit }) {
  useEffect(() => {
    if (dataToSubmit) {
      submitData(dataToSubmit);
    }
  }, [dataToSubmit]);
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidPropHandler" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [name, setName] = useState();
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (dataToSubmit) {
      submitData(dataToSubmit);
    }
  }, [dataToSubmit]);

  return (
    <div>
      <input
        name="name"
        type="text"
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={() => setDataToSubmit({ name })}>Submit</button>
    </div>
  )
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (dataToSubmit) {
      submitData(dataToSubmit);
    }
  });

  return (
    <button onClick={() => setDataToSubmit({ name: 'test' })}>Submit</button>
  )
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (dataToSubmit) {
      submitData(dataToSubmit);
    }
  }, []);

  return (
    <button onClick={() => setDataToSubmit({ name: 'test' })}>Submit</button>
  )
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ submitData }) {
  const [name, setName] = useState();
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (dataToSubmit) {
      submitData(dataToSubmit);
    }
  }, [dataToSubmit]);

  return (
    <div>
      <input
        name="name"
        type="text"
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={() => setDataToSubmit({ name })}>Submit</button>
    </div>
  )
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [name, setName] = useState();
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (!dataToSubmit) return;

    submitData(dataToSubmit);
  }, [dataToSubmit]);

  return (
    <div>
      <input
        name="name"
        type="text"
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={() => setDataToSubmit({ name })}>Submit</button>
    </div>
  )
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [name, setName] = useState();
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (dataToSubmit.name && dataToSubmit.name.length > 0) {
      submitData(dataToSubmit);
    }
  }, [dataToSubmit]);

  return (
    <div>
      <input
        name="name"
        type="text"
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={() => setDataToSubmit({ name })}>Submit</button>
    </div>
  )
}
`,
				errors: [
					{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" },
					{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" },
				],
			},
			{
				code: `
import { useEffect } from "react";

function Form({ value }) {
  const derived = value + 2;

  useEffect(() => {
    if (derived === "a") return;
    if (derived === "b") return;
  }, [derived]);
}
`,
				errors: [
					{ data: { name: "derived" }, line: 8, messageId: "avoidPropHandler" },
					{ data: { name: "derived" }, line: 9, messageId: "avoidPropHandler" },
				],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [name, setName] = useState();
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (dataToSubmit && os.clock() % 2 === 0) {
      submitData(dataToSubmit);
    }
  }, [dataToSubmit]);

  return (
    <frame>
      <textbox
        Text={name}
        TextChanged={(textbox) => setName(textbox.Text)}
      />
      <textbutton
        Text="Submit"
        Activated={() => setDataToSubmit({ name })}
      />
    </frame>
  )
}
`,
				documentation: { id: "fail", title: "Effect used as an event handler" },
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [name, setName] = useState();
  const [dataToSubmit, setDataToSubmit] = useState();

  const handleSubmit = () => {
    if (dataToSubmit) {
      submitData(dataToSubmit);
    }
  };

  return (
    <frame>
      <textbox
        Text={name}
        TextChanged={(textbox) => setName(textbox.Text)}
      />
      <textbutton Text="Submit" Activated={handleSubmit} />
    </frame>
  )
}
`,
				documentation: { id: "pass", title: "Logic called from the event handler" },
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Search() {
  const [query, setQuery] = useState();
  const [results, setResults] = useState();

  useEffect(() => {
    fetch('/search?query=' + query).then((data) => {
      setResults(data);
    });
  }, [query]);

  return (
    <div>
      <input
        name="query"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul>
        {results.map((result) => (
          <li key={result.id}>{result.title}</li>
        ))}
      </ul>
    </div>
  )
}
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/70
				code: `
import { useEffect } from "react";

// Captures an optional URL search param and persists it to localStorage + cookie.
// First-touch attribution: never overwrites an existing code.
export function useSaveReferralCode(refCode) {
  useEffect(() => {
    const valid = validateReferralCode(refCode)
    if (valid) saveReferredByCode(valid)
  }, [refCode])
}
`,
				options: [{ environment: "standard" }],
			},
		],
	});
});
