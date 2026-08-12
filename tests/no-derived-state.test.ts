import { describe } from "vitest";
import rule from "$oxc-rules/no-derived-state";

import { tsx } from "./rule-testers";

describe("no-derived-state", () => {
	tsx.run("no-derived-state", rule, {
		invalid: [
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	const [firstName, setFirstName] = useState("Taylor");
	const [lastName, setLastName] = useState("Swift");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		setFullName(\`\${firstName} \${lastName}\`);
	}, [firstName, lastName]);

	return (
		<frame>
			<textlabel Text={fullName} />
			<textbox
				Text={firstName}
				TextChanged={(textbox: { readonly Text: string }) => setFirstName(textbox.Text)}
			/>
			<textbox Text={lastName} TextChanged={(textbox: { readonly Text: string }) => setLastName(textbox.Text)} />
		</frame>
	);
}
`,
				documentation: { id: "fail", title: "Derived state stored by an effect" },
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Taylor");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("Swift");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		const name = \`\${firstName} \${lastName}\`;
		setFullName(name);
	}, [firstName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Taylor");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("Swift");
	const [fullName, setFullName] = useState("");
	const name = \`\${firstName} \${lastName}\`;

	useEffect(() => {
		setFullName(name);
	}, [name]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function usePrefix(name: string | undefined): string;

export function Component(): React.Element {
	const [name, setName] = useState<string | undefined>();
	const [prefixedName, setPrefixedName] = useState<string | undefined>();
	const prefix = usePrefix(name);

	useEffect(() => {
		const newValue = \`\${prefix}\${name}\`;
		setPrefixedName(newValue);
	}, [prefix, name]);

	return (
		<frame>
			<textlabel Text={prefixedName} />
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "prefixedName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ firstName, lastName }: { firstName: string; lastName: string }): React.Element {
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		setFullName(\`\${firstName} \${lastName}\`);
	}, [firstName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ firstName, lastName }: { firstName: string; lastName: string }): React.Element {
	const [fullName, setFullName] = useState("");
	const prefixedName = \`Dr. \${firstName}\`;

	useEffect(() => {
		setFullName(\`\${prefixedName} \${lastName}\`);
	}, [prefixedName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleList({ list }: { list: ReadonlyArray<string> }): React.Element {
	const [doubleList, setDoubleList] = useState<ReadonlyArray<string>>([]);

	useEffect(() => {
		setDoubleList([...list, ...list]);
	}, [list]);

	return <textlabel Text={doubleList} />;
}
`,
				errors: [{ data: { state: "doubleList" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleList(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the doubled list.
	const [list, setList] = useState<ReadonlyArray<string>>([]);
	const [doubleList, setDoubleList] = useState<ReadonlyArray<string>>([]);

	useEffect(() => {
		setDoubleList([...list, ...list]);
	}, [list]);

	return <textlabel Text={doubleList} />;
}
`,
				errors: [{ data: { state: "doubleList" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ title }: { title: string }): React.Element {
	const [name, setName] = useState("Dwayne");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		setFullName(\`\${title} \${name}\`);
	}, [title, name]);

	return (
		<frame>
			<textlabel Text={fullName} />
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ title }: { title: string }): React.Element {
	const [name, setName] = useState("Dwayne");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		const newFullName = \`\${title} \${name}\`;
		setFullName(newFullName);
	}, [title, name]);

	return (
		<frame>
			<textlabel Text={fullName} />
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): string;

export function Form(): React.Element {
	const prefix = useQuery("/prefix");
	const [name, setName] = useState<string | undefined>();
	const [prefixedName, setPrefixedName] = useState<string | undefined>();

	useEffect(() => {
		setPrefixedName(\`\${prefix}\${name}\`);
	}, [prefix, name]);

	return (
		<frame>
			<textlabel Text={prefixedName} />
			<textbox Text={name} TextChanged={(textbox: { readonly Text: string }) => setName(textbox.Text)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "prefixedName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "react";

export function CountAccumulator({ count }: { count: number }): React.Element {
	const [total, setTotal] = useState(count);

	useEffect(() => {
		setTotal((previous: number): number => previous + count);
	}, [count]);

	return <textlabel Text={total} />;
}
`,
				errors: [{ data: { state: "total" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter({ count }: { count: number }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	function derivedSetter(value: number): void {
		setDoubleCount(value * 2);
	}

	useEffect(() => {
		derivedSetter(count);
	}, [count]);

	return <textlabel Text={doubleCount} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ firstName, lastName }: { firstName: string; lastName: string }): React.Element {
	const [formData, setFormData] = useState<{ readonly fullName: string; readonly title: string }>({
		fullName: "",
		title: "Dr.",
	});

	useEffect(() => {
		setFormData({
			...formData,
			fullName: \`\${firstName} \${lastName}\`,
		});
	}, [firstName, lastName, formData]);

	return <textlabel Text={formData.fullName} />;
}
`,
				errors: [{ data: { state: "formData" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ firstName, lastName }: { firstName: string; lastName: string }): React.Element {
	const [formData, setFormData] = useState<{ readonly fullName: string; readonly title: string }>({
		fullName: "",
		title: "Dr.",
	});

	useEffect(() => {
		setFormData(
			(previous: {
				readonly fullName: string;
				readonly title: string;
			}): {
				readonly fullName: string;
				readonly title: string;
			} => ({
				...previous,
				fullName: \`\${firstName} \${lastName}\`,
			}),
		);
	}, [firstName, lastName]);

	return <textlabel Text={formData.fullName} />;
}
`,
				errors: [{ data: { state: "formData" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form({ firstName, lastName }: { firstName: string; lastName: string }): React.Element {
	const [formData, setFormData] = useState<{ readonly fullName: string; readonly title: string }>({
		fullName: "",
		title: "Dr.",
	});

	function setFullName(nextFullName: string): void {
		setFormData({ ...formData, fullName: nextFullName });
	}

	useEffect(() => {
		setFullName(\`\${firstName} \${lastName}\`);
	}, [firstName, lastName, formData]);

	return <textlabel Text={formData.fullName} />;
}
`,
				errors: [{ data: { state: "formData" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Taylor");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("Swift");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		setFullName(\`\${firstName} \${lastName}\`);
	}, [firstName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("The Rock");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		function computeName(): string {
			return \`\${firstName} \${lastName}\`;
		}

		setFullName(computeName());
	}, [firstName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("The Rock");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		function computeName(): string {
			return \`\${firstName} \${lastName}\`;
		}

		setFullName(computeName());
	}, [firstName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("The Rock");
	const [fullName, setFullName] = useState("");

	function computeName(): string {
		return \`\${firstName} \${lastName}\`;
	}

	useEffect(() => {
		setFullName(computeName());
	}, [computeName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("The Rock");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		function doSet(): void {
			setFullName(\`\${firstName} \${lastName}\`);
		}

		doSet();
	}, [firstName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "react";

export function DoubleCounter(): React.Element {
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => setDoubleCount(count * 2), [count]);

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React from "react";

export function DoubleCounter(): React.Element {
	const [count, setCount] = React.useState(0);
	const [doubleCount, setDoubleCount] = React.useState(0);

	React.useEffect(() => {
		setDoubleCount(count * 2);
	}, [count]);

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React, { memo, useEffect, useState } from "@rbxts/react";

// oxlint-disable-next-line react-doctor/display-name -- The memo wrapper's declarator name is what the rule under test reports.
export const DoubleCounter = memo(({ count }: { count: number }): React.Element => {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(count);
	}, [count]);

	return <textlabel Text={doubleCount} />;
});
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(): React.Element {
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(count * 2);
		setDoubleCount(count * 2);
	}, [count]);

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [
					{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" },
					{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" },
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(): React.Element {
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(
		function update(): void {
			setDoubleCount(count * 2);
		},
		[count],
	);

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(properties: { readonly count: number }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(properties.count * 2);
	}, [properties.count]);

	return <textlabel Text={doubleCount} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter({ propertyCount }: { propertyCount: number }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(propertyCount * 2);
	}, [propertyCount]);

	return <textlabel Text={doubleCount} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter({ count: countProperty }: { count: number }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(countProperty * 2);
	}, [countProperty]);

	return <textlabel Text={doubleCount} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(properties: { readonly nested: { readonly count: number } }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(properties.nested.count * 2);
	}, [properties.nested.count]);

	return <textlabel Text={doubleCount} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(): React.Element {
	const [count, setCount] = useState<{ readonly value: number }>({ value: 0 });
	const [doubleCount, setDoubleCount] = useState<{ readonly value: number }>({ value: 0 });

	useEffect(() => {
		setDoubleCount({ value: count.value * 2 });
	}, [count]);

	return (
		<frame>
			<textlabel Text={doubleCount.value} />
			<textbutton Text={count.value} onActivated={() => setCount({ value: count.value + 1 })} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter({ count }: { count?: { readonly value?: number } }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount((count?.value ?? 1) * 2);
	}, [count?.value]);

	return <textlabel Text={doubleCount} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(properties: { readonly count: number }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(properties.count * 2);
	}, [properties]);

	return <textlabel Text={doubleCount} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(): React.Element {
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		if (count > 10) {
			if (count > 100) {
				setDoubleCount(count * 4);
			} else {
				setDoubleCount(count * 2);
			}
		} else {
			setDoubleCount(count);
		}
	}, [count]);

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [
					{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" },
					{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" },
					{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" },
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function SecondPost({ posts }: { posts: ReadonlyArray<string> }): React.Element {
	const [secondPost, setSecondPost] = useState<string | undefined>();

	useEffect(() => {
		const [, second] = posts;
		setSecondPost(second);
	}, [posts]);

	return <textlabel Text={secondPost} />;
}
`,
				errors: [{ data: { state: "secondPost" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "react";

export function AttemptCounter(): React.Element {
	const [, setAttempts] = useState(0);
	const [count, setCount] = useState(0);

	useEffect(() => {
		setAttempts((previous: number): number => previous + count);
	}, [count]);

	return <textbutton Text={count} onActivated={() => setCount(count + 1)} />;
}
`,
				errors: [{ data: { state: "setAttempts" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function AttemptCounter(): React.Element {
	const [attempts, setAttempts] = useState(0);
	// oxlint-disable-next-line react-doctor/hook-use-state -- The value-only destructure exercises the rule's state-name resolution.
	const [count] = useState(0);

	useEffect(() => {
		setAttempts(count);
	}, [count]);

	return <textlabel Text={attempts} />;
}
`,
				errors: [{ data: { state: "attempts" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function useCustomHook(): number {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the doubled count.
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		setDoubleCount(count * 2);
	}, [count]);

	return doubleCount;
}

export function Component(): React.Element {
	const customState = useCustomHook();
	return <textlabel Text={customState} />;
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

export function useCustomHook(property: number): number {
	const [state, setState] = useState(0);

	useEffect(() => {
		setState(property);
	}, [property]);

	return state;
}
`,
				errors: [{ data: { state: "state" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

export function useCustomHook({ property }: { property: number }): number {
	const [state, setState] = useState(0);

	useEffect(() => {
		setState(property);
	}, [property]);

	return state;
}
`,
				errors: [{ data: { state: "state" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleCounter(): React.Element {
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	if (count > 10) {
		useEffect(() => {
			setDoubleCount(count * 2);
		}, [count]);
	}

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the name.
	const [firstName, setFirstName] = useState("");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the name.
	const [lastName, setLastName] = useState("");
	const [name, setName] = useState("");

	function setDerivedName(): void {
		setName(\`\${firstName} \${lastName}\`);
	}

	useEffect(setDerivedName, [firstName, lastName]);

	return <textlabel Text={name} />;
}
`,
				errors: [{ data: { state: "name" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function FilteredPosts({ posts }: { posts: ReadonlyArray<readonly [string, string]> }): React.Element {
	const [filteredPosts, setFilteredPosts] = useState<ReadonlyArray<readonly [string, string]>>([]);

	useEffect(() => {
		setFilteredPosts(posts.filter(([, value]) => value !== ""));
	}, [posts]);

	return <textlabel Text={filteredPosts} />;
}
`,
				errors: [{ data: { state: "filteredPosts" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Component(): React.Element {
	const [data, setData] = useState<string | undefined>();
	const setDataWrapper = setData;

	useEffect(() => {
		setDataWrapper(data);
	}, [data]);

	return <textlabel Text={data} />;
}
`,
				errors: [{ data: { state: "data" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Component(): React.Element {
	const [data, setData] = useState<string | undefined>();
	const { setData: setDataAlias } = { setData };

	useEffect(() => {
		setDataAlias(data);
	}, [data]);

	return <textlabel Text={data} />;
}
`,
				errors: [{ data: { state: "data" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Component(): React.Element {
	const [data, setData] = useState<string | undefined>();

	function setDataWrapper(value: string | undefined): void {
		setData(value);
	}

	useEffect(() => {
		setDataWrapper(data);
	}, [data]);

	return <textlabel Text={data} />;
}
`,
				errors: [{ data: { state: "data" }, messageId: "avoidDerivedState" }],
			},
			{
				// A bare `return;` is not effect cleanup, so a derived-state setter still reports.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Taylor");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		if (firstName === "") return;
		setFullName(\`\${firstName}!\`);
	}, [firstName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				// Generated 2,048-link alias chain must report without recursive-stack failure.
				code: generateAliasChain(),
				errors: [{ data: { state: "data" }, messageId: "avoidDerivedState" }],
			},
			{
				// A standard React alias must still produce the focused diagnostic.
				code: `
import React, { useEffect as effect, useState as state } from "react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = state("Taylor");
	const [fullName, setFullName] = state("");

	effect(() => {
		setFullName(\`\${firstName}!\`);
	}, [firstName]);

	return <textlabel Text={fullName} />;
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
		],

		valid: [
			{
				code: `
import React, { useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Taylor");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("Swift");

	const fullName = \`\${firstName} \${lastName}\`;

	return <textlabel Text={fullName} />;
}
`,
				documentation: { id: "pass", title: "Value derived during render" },
			},
			{
				code: `
import React from "@rbxts/react";

export function Form({ firstName, lastName }: { firstName: string; lastName: string }): React.Element {
	const fullName = \`\${firstName} \${lastName}\`;

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// No dependency array: the rule requires array deps to analyze.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	const [firstName, setFirstName] = useState("Taylor");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		setFullName(\`\${firstName}!\`);
	});

	return (
		<frame>
			<textlabel Text={fullName} />
			<textbox
				Text={firstName}
				TextChanged={(textbox: { readonly Text: string }) => setFirstName(textbox.Text)}
			/>
		</frame>
	);
}
`,
			},
			{
				// Setter passed as a callback argument is not a synchronous call chain.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function registerCallback(callback: (value: string) => void): void;

export function Form(): React.Element {
	const [fullName, setFullName] = useState("");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only registers the other setter.
	const [firstName, setFirstName] = useState("Taylor");

	useEffect(() => {
		registerCallback(setFullName);
	}, [firstName]);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: ReadonlyArray<string> };

export function Feed(): React.Element {
	const { data: posts } = useQuery("/posts");
	const [scrollPosition, setScrollPosition] = useState(0);

	useEffect(() => {
		setScrollPosition(0);
	}, [posts]);

	return <textlabel Text={scrollPosition} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: ReadonlyArray<string> };

export function Feed(): React.Element {
	const { data: posts } = useQuery("/posts");
	const [scrollPosition, setScrollPosition] = useState(0);

	useEffect(() => {
		const initialPosition = 0;
		setScrollPosition(initialPosition);
	}, [posts]);

	return <textlabel Text={scrollPosition} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: ReadonlyArray<string> };

export function Feed(): React.Element {
	const { data: posts } = useQuery("/posts");
	const [selectedPost, setSelectedPost] = useState<string | undefined>();

	useEffect(() => {
		setSelectedPost(posts[0]);
	}, [posts]);

	return <textlabel Text={selectedPost} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchTodos(): Promise<ReadonlyArray<string>>;

export function Todos(): React.Element {
	const [todos, setTodos] = useState<ReadonlyArray<string>>([]);

	useEffect(() => {
		void (async (): Promise<void> => {
			const fetched = await fetchTodos();
			setTodos(fetched);
		})();
	}, []);

	return <textlabel Text={todos} />;
}
`,
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
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare class FormModel {
	public constructor(properties: unknown);
	public setFieldDescriptor(name: string | undefined): void;
	public removeField(name: string | undefined): void;
}

export function Component(properties: { readonly kind: string }): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads the model state.
	const [name, setName] = useState<string | undefined>();
	// oxlint-disable-next-line react-doctor/hook-use-state -- The value-only destructure reads the model through the state pair.
	const [model] = useState((): FormModel => new FormModel(properties));

	useEffect(() => {
		model.setFieldDescriptor(name);
		return (): void => {
			model.removeField(name);
		};
	}, [model, name]);

	return <textlabel Text={name} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function subscribeToStatus(topic: string, callback: (status: string) => void): () => void;

export function Status({ topic }: { topic: string }): React.Element {
	const [status, setStatus] = useState<string | undefined>();

	useEffect(() => {
		const unsubscribe = subscribeToStatus(topic, (nextStatus: string): void => {
			setStatus(nextStatus);
		});

		return (): void => {
			unsubscribe();
		};
	}, [topic]);

	return <textlabel Text={status} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchMultiplier(): number;

export function DoubleCounter({ count }: { count: number }): React.Element {
	const [doubleCount, setDoubleCount] = useState(0);

	function derivedSetter(): void {
		const multiplier = fetchMultiplier();
		setDoubleCount(multiplier);
	}

	useEffect(() => {
		derivedSetter();
	}, [count]);

	return <textlabel Text={doubleCount} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchMultiplier(): Promise<number>;

export function Counter({ count }: { count: number }): React.Element {
	const [multipliedCount, setMultipliedCount] = useState<number | undefined>();

	useEffect(() => {
		void (async (): Promise<void> => {
			const multiplier = await fetchMultiplier();
			setMultipliedCount(count * multiplier);
		})();
	}, [count]);

	return <textlabel Text={multipliedCount} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function DoubleList(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only mutates the doubled list.
	const [list, setList] = useState<ReadonlyArray<string>>([]);
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only mutates the doubled list.
	const [doubleList, setDoubleList] = useState<ReadonlyArray<string>>([]);

	useEffect(() => {
		for (const item of list) {
			doubleList.push(item);
		}
	}, [list]);

	return <textlabel Text={doubleList} />;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

declare function createResizeObserver(callback: (element: { readonly scrollHeight: number }) => void): {
	readonly observe: (target: unknown) => void;
};

export function useHasOverflow({
	contentRef,
	maxHeight,
}: {
	contentRef: { readonly current: unknown };
	maxHeight: number;
}): boolean {
	const [hasOverflow, setHasOverflow] = useState(false);

	useEffect(() => {
		const resizeObserver = createResizeObserver((element: { readonly scrollHeight: number }): void => {
			const hasContentOverflow = element.scrollHeight > maxHeight;
			setHasOverflow(hasContentOverflow);
		});

		resizeObserver.observe(contentRef.current);
	}, [contentRef, maxHeight]);

	return hasOverflow;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

function logData(data: string): void {
	// oxlint-disable-next-line no-console -- The console call is a stand-in for the non-setter side effect the rule ignores.
	console.log(data);
}

export function ComponentOne(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only reads the state value.
	const [data, setData] = useState<string | undefined>();
	return <textlabel Text={data} />;
}

export function ComponentTwo(): React.Element {
	useEffect(() => {
		logData("hello");
	}, []);

	return <textlabel Text="hello" />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useQuery(path: string): { readonly data: { readonly posts: ReadonlyArray<string> } };

export function Feed(): React.Element {
	const { data } = useQuery("/posts");
	const [scrollPosition, setScrollPosition] = useState(0);

	useEffect(() => {
		setScrollPosition(0);
	}, [data.posts]);

	return <textlabel Text={scrollPosition} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchData(): Promise<{ readonly json: () => Promise<unknown> }>;

export function App(): React.Element {
	const [response, setResponse] = useState<unknown>();

	async function fetchDecisionAsync(): Promise<void> {
		try {
			const fetchedResponse = await fetchData();
			const data = await fetchedResponse.json();
			setResponse(data);
		} catch (error) {
			// oxlint-disable-next-line no-console -- The console call is a stand-in for error reporting the rule ignores.
			console.error(error);
		}
	}

	useEffect(() => {
		void fetchDecisionAsync();
	}, []);

	return <textlabel Text={response} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const document: {
	readonly addEventListener: (event: string, callback: () => void) => void;
	readonly removeEventListener: (event: string, callback: () => void) => void;
};

export function Component(): React.Element {
	const [count, setCount] = useState(0);
	const [doubleCount, setDoubleCount] = useState(0);

	useEffect(() => {
		function handleClick(): void {
			setDoubleCount(count * 2);
		}

		document.addEventListener("click", handleClick);
		return (): void => {
			document.removeEventListener("click", handleClick);
		};
	}, [count]);

	return (
		<frame>
			<textlabel Text={doubleCount} />
			<textbutton Text={count} onActivated={() => setCount(count + 1)} />
		</frame>
	);
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

function logStateValues(arg1: string, arg2: string): void {
	// oxlint-disable-next-line no-console -- The console call is a stand-in for the non-setter side effect the rule ignores.
	console.log(arg1, arg2);
}

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only logs the state values.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only logs the state values.
	const [lastName, setLastName] = useState("The Rock");

	useEffect(() => {
		logStateValues(firstName, lastName);
	}, [firstName, lastName]);

	return <textlabel Text={firstName} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter({ count }: { count: number }): React.Element {
	const [countJson, setCountJson] = useState<string | undefined>();

	useEffect(() => {
		setCountJson(JSON.stringify(count));
	}, [count]);

	return <textlabel Text={countJson} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

function computeName(first: string, last: string): string {
	// oxlint-disable-next-line no-console -- The console call is a stand-in for a side effect the rule ignores.
	console.log("meow");
	return \`\${first} \${last}\`;
}

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("The Rock");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		setFullName(computeName(firstName, lastName));
	}, [firstName, lastName]);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

function computeName(first: string, last: string): string {
	return \`\${first} \${last}\`;
}

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("The Rock");
	const [fullName, setFullName] = useState("");

	useEffect(() => {
		const newFullName = computeName(firstName, lastName);
		setFullName(newFullName);
	}, [firstName, lastName, computeName]);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				code: `
import React, { useCallback, useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Dwayne");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = useState("The Rock");
	const [fullName, setFullName] = useState("");

	const computeName = useCallback((): string => \`\${firstName} \${lastName}\`, [firstName, lastName]);

	useEffect(() => {
		setFullName(computeName());
	}, [computeName]);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchData(): Promise<unknown>;

export function Component(): React.Element {
	const [state, setState] = useState<unknown>();

	useEffect(() => {
		async function fetchItAsync(): Promise<void> {
			const response = await fetchData();
			setState(response);
		}

		void fetchItAsync();
	}, []);

	return <textlabel Text={state} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useFetchWrapper(): { readonly doFetch: (path: string) => Promise<unknown> };

export function Component(): React.Element {
	const api = useFetchWrapper();
	const [state, setState] = useState<unknown>();

	useEffect(() => {
		async function fetchItAsync(): Promise<void> {
			const response = await api.doFetch("/endpoint");
			setState(response);
		}

		void fetchItAsync();
	}, [api]);

	return <textlabel Text={state} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function useFetchWrapper(): { readonly doFetch: (path: string) => Promise<unknown> };

export function Component(): React.Element {
	const api = useFetchWrapper();
	const [state, setState] = useState<unknown>();

	useEffect(() => {
		void (async function fetchItAsync(): Promise<void> {
			const response = await api.doFetch("/endpoint");
			setState(response);
		})();
	}, [api]);

	return <textlabel Text={state} />;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

declare class ResizeObserver {
	public constructor(callback: (element: { readonly scrollHeight: number }) => void);
	public observe(target: unknown): void;
}

export function useHasOverflow({
	contentRef,
	maxHeight,
}: {
	contentRef: { readonly current: unknown };
	maxHeight: number;
}): boolean {
	const [hasOverflow, setHasOverflow] = useState(false);

	useEffect(() => {
		const resizeObserver = new ResizeObserver((element: { readonly scrollHeight: number }): void => {
			const hasContentOverflow = element.scrollHeight > maxHeight;
			setHasOverflow(hasContentOverflow);
		});

		resizeObserver.observe(contentRef.current);
	}, [contentRef, maxHeight]);

	return hasOverflow;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

declare class ResizeObserver {
	public constructor(callback: (element: { readonly scrollHeight: number }) => void);
	public observe(target: unknown): void;
}

export function useHasOverflow({
	contentRef,
	maxHeight,
}: {
	contentRef: { readonly current: unknown };
	maxHeight: number;
}): boolean {
	const [hasOverflow, setHasOverflow] = useState(false);

	useEffect(() => {
		function onResize(element: { readonly scrollHeight: number }): void {
			const hasContentOverflow = element.scrollHeight > maxHeight;
			setHasOverflow(hasContentOverflow);
		}
		const resizeObserver = new ResizeObserver(onResize);

		resizeObserver.observe(contentRef.current);
	}, [contentRef, maxHeight]);

	return hasOverflow;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

declare function createResizeObserver(callback: (element: { readonly scrollHeight: number }) => void): {
	readonly observe: (target: unknown) => void;
};

export function useHasOverflow({
	contentRef,
	maxHeight,
}: {
	contentRef: { readonly current: unknown };
	maxHeight: number;
}): boolean {
	const [hasOverflow, setHasOverflow] = useState(false);

	useEffect(() => {
		function onResize(element: { readonly scrollHeight: number }): void {
			const hasContentOverflow = element.scrollHeight > maxHeight;
			setHasOverflow(hasContentOverflow);
		}
		const resizeObserver = createResizeObserver(onResize);

		resizeObserver.observe(contentRef.current);
	}, [contentRef, maxHeight]);

	return hasOverflow;
}
`,
			},
			{
				code: `
import React, { useEffect as effect, useState as state } from "react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = state("Taylor");
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [lastName, setLastName] = state("Swift");

	const fullName = \`\${firstName} \${lastName}\`;

	effect(() => {
		// oxlint-disable-next-line no-console -- The console call is a stand-in for a side effect the rule ignores.
		console.log(fullName);
	}, [fullName]);

	return <textlabel Text={fullName} />;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import React, { useState as state } from "@rbxts/react";

function effect(callback: () => void): void {
	callback();
}

export function Form(): React.Element {
	const [firstName, setFirstName] = state("Taylor");

	effect(() => {
		setFirstName("Swift");
	});

	return <textlabel Text={firstName} />;
}
`,
			},
			{
				code: `
import React, { useState } from "react";
import { useEffect } from "preact/hooks";

export function Form(): React.Element {
	const [firstName, setFirstName] = useState("Taylor");

	useEffect(() => {
		setFirstName("Swift");
	}, [firstName]);

	return <textlabel Text={firstName} />;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				// useLayoutEffect is deliberately excluded from the focused rules.
				code: `
import React, { useLayoutEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	const [firstName, setFirstName] = useState("Taylor");
	const [fullName, setFullName] = useState("");

	useLayoutEffect(() => {
		setFullName(\`\${firstName}!\`);
	}, [firstName]);

	return (
		<frame>
			<textlabel Text={fullName} />
			<textbox
				Text={firstName}
				TextChanged={(textbox: { readonly Text: string }) => setFirstName(textbox.Text)}
			/>
		</frame>
	);
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call callee,
				// so `getCallExpression` cannot resolve it.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the sample only derives the full name.
	const [firstName, setFirstName] = useState("Taylor");
	const [fullName, setFullName] = useState("");

	// oxlint-disable-next-line typescript/consistent-return -- The conditional return leaves the setter outside any call callee, which the rule must treat as valid.
	useEffect(() => {
		if (firstName.length > 0) {
			return setFullName;
		}
	}, [firstName]);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState` itself, so
				// `getStateName` finds no destructured declaration and yields undefined.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	const [data, setData] = useState<string | undefined>();

	useEffect(() => {
		// oxlint-disable-next-line no-shadow -- The setter is bound to the hook name to exercise the rule's name resolution.
		const useState = setData;
		// oxlint-disable-next-line react-doctor/hook-use-state -- A deliberate call to the aliased setter exercises the rule's name resolution.
		useState(5);
	}, [data]);

	return <textlabel Text={data} />;
}
`,
			},
			{
				// An unimported `useEffect` resolves to no variable: the binding-aware
				// import check returns false and the effect is not analyzed.
				code: `
import React, { useState } from "@rbxts/react";

declare function useEffect(callback: () => void, dependencies: ReadonlyArray<unknown>): void;

export function Form(): React.Element {
	const [fullName, setFullName] = useState("Taylor");

	useEffect(() => {
		setFullName("x");
	}, []);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// A computed-member callee is never a recognized effect call.
				code: `
import React, { useState } from "@rbxts/react";

export function Form(): React.Element {
	const [fullName, setFullName] = useState("Taylor");
	const effectCallbacks = {
		useEffect: (callback: () => void): void => {
			callback();
		},
	};

	// oxlint-disable-next-line typescript/dot-notation -- The computed member call is not recognized as an effect call.
	effectCallbacks["useEffect"](() => {
		setFullName("x");
	});

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// A namespace import called directly resolves to an ImportBinding that is
				// not an ImportSpecifier, so the binding-aware check rejects it.
				code: `
// oxlint-disable-next-line import/no-namespace -- The namespace import is called directly, which the binding-aware check rejects.
import * as React from "@rbxts/react";
import { useState } from "@rbxts/react";

export function Form(): React.Element {
	const [fullName, setFullName] = useState("Taylor");

	React(() => {
		setFullName("x");
	});

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// A member-expression callback resolves to no function node.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	const [fullName, setFullName] = useState("Taylor");
	const actions = { update: (): void => setFullName("x") };

	useEffect(actions.update, []);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// An unresolvable identifier callback produces no effect analysis.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const missingCallback: () => void;

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the unresolvable callback keeps the effect unanalyzed.
	const [fullName, setFullName] = useState("Taylor");

	useEffect(missingCallback, []);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// An identifier bound to an initializer-less declaration cannot be resolved.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line no-unused-vars, sonar/no-unused-vars, small-rules/no-dead-store -- The setter stays unused; the initializer-less callback keeps the effect unanalyzed.
	const [fullName, setFullName] = useState("Taylor");
	// oxlint-disable-next-line no-unassigned-vars -- The initializer-less declaration is the point of the sample; the unresolvable callback is never analyzed.
	let deferredCallback: (() => void) | undefined;

	useEffect(deferredCallback, []);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// A three-element useState destructure is not a recognized state pair.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	// oxlint-disable-next-line react-doctor/hook-use-state -- The three-element destructure is not a recognized state pair.
	const [first, second, third] = useState("Taylor");

	useEffect(() => {
		second("x");
	}, [first]);

	return (
		<frame>
			<textlabel Text={first} />
			<textlabel Text={third} />
		</frame>
	);
}
`,
			},
			{
				// An alias initializer inside the effect is a state call whose call
				// expression cannot be resolved (the ref is not a callee).
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Form(): React.Element {
	const [fullName, setFullName] = useState("Taylor");

	useEffect(() => {
		const alias = setFullName;
		alias("x");
	}, []);

	return <textlabel Text={fullName} />;
}
`,
			},
			{
				// A recursive helper called in the effect revisits its own declaration,
				// which the analysis must tolerate without hanging.
				code: `
import React, { useEffect } from "@rbxts/react";

function processName(remaining: number): void {
	if (remaining <= 0) {
		return;
	}
	processName(remaining - 1);
}

export function Form(): React.Element {
	useEffect(() => {
		processName(3);
	}, []);

	return <textlabel Text="hello" />;
}
`,
			},
		],
	});
});

function generateAliasChain(): string {
	const links = new Array<string>();
	for (let index = 0; index < 2048; index += 1) {
		links.push(`const a${index} = a${index + 1};`);
	}
	return `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [data, setData] = useState();
  const a2048 = data;
  ${links.join("\n")}

  useEffect(() => {
    setData(a0);
  }, [a0]);
}
`;
}
