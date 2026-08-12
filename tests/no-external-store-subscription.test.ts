import { describe } from "vitest";
import rule from "$oxc-rules/no-external-store-subscription";

import { tsx } from "./rule-testers";

describe("no-external-store-subscription", () => {
	tsx.run("no-external-store-subscription", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useStoreValue(store) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(store.get());
    const update = () => setValue(store.get());
    store.subscribe(update);
    return () => store.unsubscribe(update);
  }, [store]);
  return value;
}
`,
				documentation: { id: "fail", title: "Effect subscribes to an external store" },
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    return () => window.removeEventListener('online', update);
  }, []);
  return isOnline;
}
`,
				errors: [{ data: { state: "isOnline" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    return () => setIsOnline(false);
  }, []);
}
`,
				errors: [{ data: { state: "isOnline" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useStoreValue(store) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(store.get());
    const handler = (v) => setValue(v);
    store.subscribe(handler);
    return () => store.unsubscribe(handler);
  }, [store]);
  return value;
}
`,
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  useEffect(() => {
    setX(readStoreX());
    setY(readStoreY());
    const handlerX = (v) => setX(v);
    const handlerY = (v) => setY(v);
    storeX.subscribe(handlerX);
    storeY.subscribe(handlerY);
    return () => {
      storeX.unsubscribe(handlerX);
      storeY.unsubscribe(handlerY);
    };
  }, []);
}
`,
				errors: [
					{ data: { state: "x" }, messageId: "avoidExternalStoreSubscription" },
					{ data: { state: "y" }, messageId: "avoidExternalStoreSubscription" },
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(readExternal());
    const handler = (v) => setValue(v);
    const sub = external.subscribe(handler);
    return () => sub.unsubscribe(handler);
  }, []);
}
`,
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useStoreValue(store) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const update = () => setValue(store.get());
    update();
    store.onChange(update);
    return () => store.offChange(update);
  }, [store]);
  return value;
}
`,
				errors: [{ data: { state: "value" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  useEffect(() => {
    setX(readStoreX());
    setY(readStoreY());
    const hx = (v) => setX(v);
    storeX.onChange(hx);
    return () => storeX.offChange(hx);
  }, []);
}
`,
				errors: [{ data: { state: "x" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(readExternal());
    return () => setCount(c => c + 1);
  }, []);
}
`,
				errors: [{ data: { state: "count" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = setCount;
    update(readExternal());
    return () => setCount(0);
  }, []);
}
`,
				errors: [{ data: { state: "count" }, messageId: "avoidExternalStoreSubscription" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = (v) => setCount(v);
    update(readExternal());
    return () => setCount(0);
  }, []);
}
`,
				errors: [{ data: { state: "count" }, messageId: "avoidExternalStoreSubscription" }],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
`,
			},
			{
				// A non-subscription effect is not an external store subscription.
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  useEffect(() => {
    console.log('hello');
  }, []);
}
`,
			},
			{
				code: `
import { useSyncExternalStore } from "@rbxts/react";

function subscribe(callback) {
  store.subscribe(callback);
  return () => store.unsubscribe(callback);
}

function useStoreValue() {
  return useSyncExternalStore(subscribe, () => store.get());
}
`,
				documentation: { id: "pass", title: "Subscription managed with useSyncExternalStore" },
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(1);
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setValue(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    const timer = setInterval(() => {}, 1000);
    return () => clearInterval(timer);
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C({ query }) {
  const [results, setResults] = useState([]);
  useEffect(() => {
    let ignore = false;
    fetchResults(query).then((json) => {
      if (!ignore) setResults(json);
    });
    return () => { ignore = true; };
  }, [query]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C({ ref }) {
  const [size, setSize] = useState();
  useEffect(() => {
    const observer = new ResizeObserver((entry) => {
      setSize(entry.contentRect.width);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useStoreValue(store) {
  const [value, setValue] = useState(store.get());
  useEffect(() => {
    const unsubscribe = store.subscribe((v) => setValue(v));
    return unsubscribe;
  }, [store]);
  return value;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    return () => console.log('cleanup');
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [x, setX] = useState(0);
  useEffect(() => {
    setX(1);
    const id = setTimeout(() => {}, 0);
    return () => clearTimeout(id);
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  useEffect(() => {
    setA(1);
    setB(2);
    const id = setInterval(() => {}, 0);
    return () => clearInterval(id);
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const cb = () => console.log('no setter here');
    window.addEventListener('click', cb);
    return () => window.removeEventListener('click', cb);
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/data').then((res) => setData(res));
    return () => abortController.abort();
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [x, setX] = useState(0);
  useEffect(() => {
    (() => { setX(readExternal()); })();
    return () => console.log('cleanup');
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [x, setX] = useState(0);
  useEffect(() => {
    void setX(readExternal());
    return () => console.log('cleanup');
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  useEffect(() => {
    setA(readExternal());
    const hb = (v) => setB(v);
    store.subscribe(hb);
    return () => store.unsubscribe(hb);
  }, []);
}
`,
			},
			{
				// A bare `return;` is not effect cleanup, so the rule has nothing to match.
				code: `
import { useEffect, useState } from "@rbxts/react";

function C() {
  const [x, setX] = useState(0);
  useEffect(() => {
    setX(readExternal());
    return;
  }, []);
}
`,
			},
			{
				// The `var` redeclaration shadows the ArrayPattern useState declaration
				// in the setter's upstream chain, so the state name can't be resolved.
				code: `
import { useEffect, useState } from "@rbxts/react";

var setCount = useState(0);
const [count, setCount] = useState(0);

function C() {
  useEffect(() => {
    setCount(readExternal());
    return () => setCount(0);
  }, []);
}
`,
			},
		],
	});
});
