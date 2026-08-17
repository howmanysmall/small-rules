import { describe } from "vitest";
import rule from "$oxc-rules/react/no-external-store-subscription";

import { tsx } from "./rule-testers";

describe("no-external-store-subscription", () => {
	tsx.run("no-external-store-subscription", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

interface Store {
	get: () => number;
	subscribe: (callback: () => void) => void;
	unsubscribe: (callback: () => void) => void;
}

export function useStoreValue(store: Store): number {
	const [value, setValue] = useState(0);
	useEffect(() => {
		setValue(store.get());
		function update(): void {
			setValue(store.get());
		}
		store.subscribe(update);
		return (): void => {
			store.unsubscribe(update);
		};
	}, [store]);
	return value;
}
`,
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
				documentation: { id: "fail", title: "Effect subscribes to an external store" },
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

declare const eventTarget: {
	readonly addEventListener: (event: string, callback: () => void) => void;
	readonly removeEventListener: (event: string, callback: () => void) => void;
};
declare const navigator: {
	readonly onLine: boolean;
};

export function useOnlineStatus(): boolean {
	const [isOnline, setIsOnline] = useState(true);
	useEffect(() => {
		function update(): void {
			setIsOnline(navigator.onLine);
		}
		update();
		eventTarget.addEventListener("online", update);
		return (): void => {
			eventTarget.removeEventListener("online", update);
		};
	}, []);
	return isOnline;
}
`,
				errors: [{ data: { state: "isOnline" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const navigator: {
	readonly onLine: boolean;
};

export function OnlineStatus(): React.Element {
	const [isOnline, setIsOnline] = useState(true);
	useEffect(() => {
		setIsOnline(navigator.onLine);
		return (): void => {
			setIsOnline(false);
		};
	}, []);
	return <textlabel Text={isOnline} />;
}
`,
				errors: [{ data: { state: "isOnline" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

interface Store {
	get: () => number;
	subscribe: (callback: (value: number) => void) => void;
	unsubscribe: (callback: (value: number) => void) => void;
}

export function useStoreValue(store: Store): number {
	const [value, setValue] = useState(0);
	useEffect(() => {
		setValue(store.get());
		function handler(nextValue: number): void {
			setValue(nextValue);
		}
		store.subscribe(handler);
		return (): void => {
			store.unsubscribe(handler);
		};
	}, [store]);
	return value;
}
`,
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readStoreX(): number;
declare function readStoreY(): number;
declare const storeX: {
	readonly subscribe: (callback: (value: number) => void) => void;
	readonly unsubscribe: (callback: (value: number) => void) => void;
};
declare const storeY: {
	readonly subscribe: (callback: (value: number) => void) => void;
	readonly unsubscribe: (callback: (value: number) => void) => void;
};

export function Coordinates(): React.Element {
	const [x, setX] = useState(0);
	const [y, setY] = useState(0);
	useEffect(() => {
		setX(readStoreX());
		setY(readStoreY());
		function handlerX(value: number): void {
			setX(value);
		}
		function handlerY(value: number): void {
			setY(value);
		}
		storeX.subscribe(handlerX);
		storeY.subscribe(handlerY);
		return (): void => {
			storeX.unsubscribe(handlerX);
			storeY.unsubscribe(handlerY);
		};
	}, []);
	return (
		<frame>
			<textlabel Text={x} />
			<textlabel Text={y} />
		</frame>
	);
}
`,
				errors: [
					{ data: { state: "x" }, messageId: "avoidExternalStoreSubscription" },
					{ data: { state: "y" }, messageId: "avoidExternalStoreSubscription" },
				],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;
declare const remote: {
	readonly subscribe: (callback: (value: number) => void) => {
		readonly unsubscribe: (callback: (value: number) => void) => void;
	};
};

export function ExternalValue(): React.Element {
	const [value, setValue] = useState(0);
	useEffect(() => {
		setValue(readExternal());
		function handler(nextValue: number): void {
			setValue(nextValue);
		}
		const subscription = remote.subscribe(handler);
		return (): void => {
			subscription.unsubscribe(handler);
		};
	}, []);
	return <textlabel Text={value} />;
}
`,
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

interface ChangeableStore {
	get: () => number;
	onChange: (callback: (value: number) => void) => void;
	offChange: (callback: (value: number) => void) => void;
}

export function useStoreValue(store: ChangeableStore): number {
	const [value, setValue] = useState(0);
	useEffect(() => {
		function update(): void {
			setValue(store.get());
		}
		update();
		store.onChange(update);
		return (): void => {
			store.offChange(update);
		};
	}, [store]);
	return value;
}
`,
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readStoreX(): number;
declare function readStoreY(): number;
declare const storeX: {
	readonly onChange: (callback: (value: number) => void) => void;
	readonly offChange: (callback: (value: number) => void) => void;
};

export function Coordinates(): React.Element {
	const [x, setX] = useState(0);
	const [y, setY] = useState(0);
	useEffect(() => {
		setX(readStoreX());
		setY(readStoreY());
		function handlerX(value: number): void {
			setX(value);
		}
		storeX.onChange(handlerX);
		return (): void => {
			storeX.offChange(handlerX);
		};
	}, []);
	return (
		<frame>
			<textlabel Text={x} />
			<textlabel Text={y} />
		</frame>
	);
}
`,
				errors: [{ data: { state: "x" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	useEffect(() => {
		setCount(readExternal());
		return (): void => {
			setCount((current: number): number => current + 1);
		};
	}, []);
	return <textlabel Text={count} />;
}
`,
				errors: [{ data: { state: "count" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	useEffect(() => {
		const update = setCount;
		update(readExternal());
		return (): void => {
			setCount(0);
		};
	}, []);
	return <textlabel Text={count} />;
}
`,
				errors: [{ data: { state: "count" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	useEffect(() => {
		function update(value: number): void {
			setCount(value);
		}
		update(readExternal());
		return (): void => {
			setCount(0);
		};
	}, []);
	return <textlabel Text={count} />;
}
`,
				errors: [{ data: { state: "count" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				// A state pair declared at module scope has a useState call with
				// no enclosing function, so the synchronous call chain stops
				// short of it.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

const [count, setCount] = useState(0);

export function Counter(): React.Element {
	useEffect(() => {
		setCount(readExternal());
		return (): void => {
			setCount(0);
		};
	}, []);
	return <textlabel Text={count} />;
}
`,
				errors: [{ data: { state: "count" }, messageId: "avoidExternalStoreSubscription" }],
			},
		],
		valid: [
			{
				code: `
import React, { useState } from "@rbxts/react";

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	return <textbutton Text={count} onActivated={() => setCount(count + 1)} />;
}
`,
			},
			{
				// A non-subscription effect is not an external store
				// subscription.
				code: `
import React, { useEffect } from "@rbxts/react";

export function Logger(): React.Element {
	useEffect(() => {
		// oxlint-disable-next-line no-console -- The console call is a stand-in for side effects the rule ignores; the sample only checks that a non-subscription effect stays valid.
		console.log("hello");
	}, []);
	return <textlabel Text="hello" />;
}
`,
			},
			{
				code: `
import { useSyncExternalStore } from "@rbxts/react";

interface Store {
	get: () => number;
	subscribe: (callback: () => void) => void;
	unsubscribe: (callback: () => void) => void;
}

declare const store: Store;

function subscribe(callback: () => void): () => void {
	store.subscribe(callback);
	return (): void => {
		store.unsubscribe(callback);
	};
}

export function useStoreValue(): number {
	return useSyncExternalStore(subscribe, (): number => store.get());
}
`,
				documentation: { id: "pass", title: "Subscription managed with useSyncExternalStore" },
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	useEffect(() => {
		setCount(1);
	}, []);
	return <textlabel Text={count} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Clock(): React.Element {
	const [value, setValue] = useState(0);
	useEffect(() => {
		const timer = setInterval((): void => {
			setValue(Date.now());
		}, 1000);
		return (): void => {
			clearInterval(timer);
		};
	}, []);
	return <textlabel Text={value} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	useEffect(() => {
		setCount(0);
		const timer = setInterval((): void => {
			setCount(count + 1);
		}, 1000);
		return (): void => {
			clearInterval(timer);
		};
	}, []);
	return <textlabel Text={count} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchResults(query: string): Promise<ReadonlyArray<string>>;
declare function getIgnoreFlag(): boolean;

export function SearchResults({ query }: { query: string }): React.Element {
	const [results, setResults] = useState<ReadonlyArray<string>>([]);
	useEffect(() => {
		let ignore = getIgnoreFlag();
		void (async (): Promise<void> => {
			const json = await fetchResults(query);
			if (!ignore) setResults(json);
		})();
		return (): void => {
			ignore = true;
		};
	}, [query]);
	return (
		<frame>
			{results.map((result: string) => (
				<textlabel key={result} Text={result} />
			))}
		</frame>
	);
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare class SizeWatcher {
	public constructor(callback: (entry: { readonly contentRect: { readonly width: number } }) => void);
	public observe(target: unknown): void;
	public disconnect(): void;
}

export function SizeTracker({ ref }: { ref: { readonly current: unknown } }): React.Element {
	const [size, setSize] = useState<number | undefined>();
	useEffect(() => {
		const observer = new SizeWatcher((entry: { readonly contentRect: { readonly width: number } }): void => {
			setSize(entry.contentRect.width);
		});
		observer.observe(ref.current);
		return (): void => {
			observer.disconnect();
		};
	}, [ref]);
	return <textlabel Text={size} />;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

interface Store {
	get: () => number;
	subscribe: (callback: (value: number) => void) => () => void;
}

export function useStoreValue(store: Store): number {
	const [value, setValue] = useState(store.get());
	useEffect(() => {
		const unsubscribe = store.subscribe((nextValue: number): void => setValue(nextValue));
		return unsubscribe;
	}, [store]);
	return value;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	useEffect(() => {
		setCount(0);
		return (): void => {
			// oxlint-disable-next-line no-console -- The console call is a stand-in for cleanup side effects the rule ignores.
			console.log("cleanup");
		};
	}, []);
	return <textlabel Text={count} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Timer(): React.Element {
	const [x, setX] = useState(0);
	useEffect(() => {
		const timer = setTimeout((): void => {
			setX(x + 1);
		}, 0);
		return (): void => {
			clearTimeout(timer);
		};
	}, []);
	return <textlabel Text={x} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

export function Pair(): React.Element {
	const [a, setA] = useState(0);
	const [b, setB] = useState(0);
	useEffect(() => {
		setA(1);
		setB(2);
		const timer = setInterval((): void => {
			setB(b + 1);
		}, 0);
		return (): void => {
			clearInterval(timer);
		};
	}, []);
	return (
		<frame>
			<textlabel Text={a} />
			<textlabel Text={b} />
		</frame>
	);
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare const navigator: {
	readonly onLine: boolean;
};
declare const eventTarget: {
	readonly addEventListener: (event: string, callback: () => void) => void;
	readonly removeEventListener: (event: string, callback: () => void) => void;
};

export function OnlineStatus(): React.Element {
	const [isOnline, setIsOnline] = useState(true);
	useEffect(() => {
		setIsOnline(navigator.onLine);
		function callback(): void {
			// oxlint-disable-next-line no-console -- The console call is a stand-in for listener side effects the rule ignores.
			console.log("no setter here");
		}
		eventTarget.addEventListener("click", callback);
		return (): void => {
			eventTarget.removeEventListener("click", callback);
		};
	}, []);
	return <textlabel Text={isOnline} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function fetchData(): Promise<unknown>;
declare const abortController: {
	readonly abort: () => void;
};

export function DataLoader(): React.Element {
	const [data, setData] = useState<unknown>();
	useEffect(() => {
		// oxlint-disable-next-line promise/prefer-await-to-then -- The promise chain keeps the setter outside the effect's synchronous flow, which the rule must treat as valid.
		void fetchData().then(
			(response) => setData(response),
			(_error: unknown) => setData(undefined),
		);
		return (): void => {
			abortController.abort();
		};
	}, []);
	return <textlabel Text={data} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

export function ExternalValue(): React.Element {
	const [x, setX] = useState(0);
	useEffect(() => {
		((): void => {
			setX(readExternal());
		})();
		return (): void => {
			// oxlint-disable-next-line no-console -- The console call is a stand-in for cleanup side effects the rule ignores.
			console.log("cleanup");
		};
	}, []);
	return <textlabel Text={x} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

export function ExternalValue(): React.Element {
	const [x, setX] = useState(0);
	useEffect(() => {
		void setX(readExternal());
		return (): void => {
			// oxlint-disable-next-line no-console -- The console call is a stand-in for cleanup side effects the rule ignores.
			console.log("cleanup");
		};
	}, []);
	return <textlabel Text={x} />;
}
`,
			},
			{
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;
declare const store: {
	readonly subscribe: (callback: (value: number) => void) => void;
	readonly unsubscribe: (callback: (value: number) => void) => void;
};

export function Pair(): React.Element {
	const [a, setA] = useState(0);
	const [b, setB] = useState(0);
	useEffect(() => {
		setA(readExternal());
		function handlerB(value: number): void {
			setB(value);
		}
		store.subscribe(handlerB);
		return (): void => {
			store.unsubscribe(handlerB);
		};
	}, []);
	return (
		<frame>
			<textlabel Text={a} />
			<textlabel Text={b} />
		</frame>
	);
}
`,
			},
			{
				// A bare `return;` is not effect cleanup, so the rule has
				// nothing to match.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

export function ExternalValue(): React.Element {
	const [x, setX] = useState(0);
	useEffect(() => {
		if (readExternal() === 0) {
			return;
		}
		setX(readExternal());
	}, []);
	return <textlabel Text={x} />;
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState`
				// itself, so `getStateName` finds no destructured declaration and
				// yields undefined.
				code: `
import React, { useEffect, useState } from "@rbxts/react";

declare function readExternal(): number;

export function Counter(): React.Element {
	const [count, setCount] = useState(0);
	useEffect(() => {
		// oxlint-disable-next-line no-shadow -- The setter is bound to the hook name to exercise the rule's name resolution.
		const useState = setCount;
		// oxlint-disable-next-line react-doctor/hook-use-state -- A deliberate call to the aliased setter exercises the rule's name resolution.
		useState(readExternal());
		return (): void => {
			setCount(0);
		};
	}, []);
	return <textlabel Text={count} />;
}
`,
			},
		],
	});
});
