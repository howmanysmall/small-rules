import { describe } from "vitest";

import rule from "$oxc-rules/react/no-event-handler";

import { tsx } from "./rule-testers";

describe("no-event-handler", () => {
	tsx.run("no-event-handler", rule, {
		invalid: [
			{
				code: `
import React, { useEffect } from "@rbxts/react";

declare function submitData(data: string): void;

export function Form({ dataToSubmit }: { dataToSubmit: string | undefined }): React.Element {
	useEffect(() => {
		if (dataToSubmit !== undefined) {
			submitData(dataToSubmit);
		}
	}, [dataToSubmit]);

	return <textlabel Text={dataToSubmit} />;
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidPropHandler" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function submitData(data: { readonly name: string }): void;

export function Form(): React.Element {
	const [name, setName] = useState("");
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit !== undefined) {
			submitData(dataToSubmit);
		}
	}, [dataToSubmit]);

	return (
		<frame>
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
			<textbutton Text="Submit" Activated={() => setDataToSubmit({ name })} />
		</frame>
	);
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function submitData(data: { readonly name: string }): void;

export function Form(): React.Element {
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit !== undefined) {
			submitData(dataToSubmit);
		}
	});

	return <textbutton Text="Submit" Activated={() => setDataToSubmit({ name: "test" })} />;
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function submitData(data: { readonly name: string }): void;

export function Form(): React.Element {
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit !== undefined) {
			submitData(dataToSubmit);
		}
	}, []);

	return <textbutton Text="Submit" Activated={() => setDataToSubmit({ name: "test" })} />;
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ submitData }: { submitData: (data: { readonly name: string }) => void }): React.Element {
	const [name, setName] = useState("");
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit !== undefined) {
			submitData(dataToSubmit);
		}
	}, [dataToSubmit]);

	return (
		<frame>
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
			<textbutton Text="Submit" Activated={() => setDataToSubmit({ name })} />
		</frame>
	);
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function submitData(data: { readonly name: string }): void;

export function Form(): React.Element {
	const [name, setName] = useState("");
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit === undefined) return;

		submitData(dataToSubmit);
	}, [dataToSubmit]);

	return (
		<frame>
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
			<textbutton Text="Submit" Activated={() => setDataToSubmit({ name })} />
		</frame>
	);
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function submitData(data: { readonly name: string }): void;

export function Form(): React.Element {
	const [name, setName] = useState("");
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit !== undefined && dataToSubmit.name.length > 0) {
			submitData(dataToSubmit);
		}
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
					{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" },
					{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" },
				],
			},
			{
				code: `
import React, { useEffect } from "react";

declare function cleanupA(): void;
declare function cleanupB(): void;

export function Form({ value }: { value: string }): React.Element {
	const derived = value + 2;

	useEffect(() => {
		if (derived === "a") cleanupA();
		if (derived === "b") cleanupB();
	}, [derived]);

	return <textlabel Text={derived} />;
}
`,
				options: [{ environment: "standard" }],
				errors: [
					{ data: { name: "derived" }, line: 11, messageId: "avoidPropHandler" },
					{ data: { name: "derived" }, line: 12, messageId: "avoidPropHandler" },
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const os: {
	readonly clock: () => number;
};

declare function submitData(data: { readonly name: string }): void;

export function Form(): React.Element {
	const [name, setName] = useState("");
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	useEffect(() => {
		if (dataToSubmit !== undefined && os.clock() % 2 === 0) {
			submitData(dataToSubmit);
		}
	}, [dataToSubmit]);

	return (
		<frame>
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
			<textbutton Text="Submit" Activated={() => setDataToSubmit({ name })} />
		</frame>
	);
}
`,
				errors: [{ data: { name: "dataToSubmit" }, messageId: "avoidEventHandler" }],
				documentation: { id: "fail", title: "Effect used as an event handler" },
			},
		],
		valid: [
			{
				code: `
import React, { useState } from "@rbxts/react";

declare function submitData(data: { readonly name: string }): void;

export function Form(): React.Element {
	const [name, setName] = useState("");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the handler submits the state directly.
	const [dataToSubmit, setDataToSubmit] = useState<{ readonly name: string } | undefined>();

	function handleSubmit(): void {
		if (dataToSubmit !== undefined) {
			submitData(dataToSubmit);
		}
	}

	return (
		<frame>
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
			<textbutton Text="Submit" Activated={handleSubmit} />
		</frame>
	);
}
`,
				documentation: { id: "pass", title: "Logic called from the event handler" },
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function search(query: string): Promise<ReadonlyArray<{ readonly id: number; readonly title: string }>>;

export function Search(): React.Element {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<
		ReadonlyArray<{ readonly id: number; readonly title: string }> | undefined
	>();

	useEffect(() => {
		void (async (): Promise<void> => {
			const data = await search(query);
			setResults(data);
		})();
	}, [query]);

	return (
		<frame>
			<textbox Text={query} TextChanged={(textbox: { readonly Text: string }) => setQuery(textbox.Text)} />
			{results?.map((result: { readonly id: number; readonly title: string }) => (
				<textlabel key={result.id} Text={result.title} />
			))}
		</frame>
	);
}
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/70
				code: `
import { useEffect } from "react";

// Captures an optional URL search param and persists it to localStorage + cookie.
// First-touch attribution: never overwrites an existing code.
declare function validateReferralCode(referralCode: string): string | undefined;
declare function saveReferredByCode(referralCode: string): void;

export function useSaveReferralCode(referralCode: string): void {
	useEffect(() => {
		const valid = validateReferralCode(referralCode);
		if (valid !== undefined) saveReferredByCode(valid);
	}, [referralCode]);
}
`,
				options: [{ environment: "standard" }],
			},
		],
	});
});
