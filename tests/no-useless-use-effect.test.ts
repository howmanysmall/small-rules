import { describe } from "vitest";
import rule from "$oxc-rules/no-useless-use-effect";

import { ts } from "./rule-testers";

describe("no-useless-use-effect", () => {
	// @ts-expect-error -- Shut up
	ts.run("no-useless-use-effect", rule, {
		invalid: [
			{
				code: `
import { "useEffect" as useEffectAlias, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useEffectAlias(() => {
        setCount(properties.initialCount);
    }, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(Math.max(properties.initialCount, 0));
    }, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useEffect(function syncInitialCount() {
        ;
        setCount(properties.initialCount);
    }, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [fullName, setFullName] = useState("");
    useEffect(() => {
        setFullName(properties.firstName + properties.lastName);
    }, [properties.firstName, properties.lastName]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(properties.initialCount);
    }, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
				options: [{}],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [selection, setSelection] = useState("");
    useEffect(() => {
        if (!properties.initialSelection) return;
        setSelection(properties.initialSelection);
    }, [properties.initialSelection]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (properties.ready) setCount(properties.value);
    }, [properties.ready, properties.value]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useReducer } from "@rbxts/react";

function reducer(state, action) {
    return action.type === "set" ? action.value : state;
}

function Component(properties) {
    const [value, dispatch] = useReducer(reducer, 0);
    useEffect(() => {
        if (properties.ready) {
            dispatch({ type: "set", value: properties.value });
        }
    }, [properties.ready, properties.value]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useLayoutEffect, useState } from "react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useLayoutEffect(() => {
        setCount(properties.initialCount);
    }, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
				options: [{ environment: "standard" }],
			},

			// NotifyParent - existing
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => {
        onChange(value);
    }, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties) {
    useEffect(() => {
        properties.onChange?.(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ "onChange": handleChange = fallbackChange, value }) {
    useEffect(() => {
        handleChange(value);
    }, [handleChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => {
        if (value) onChange(value);
    }, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component(properties) {
    React.useEffect(() => {
        properties.onChange(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties = {}) {
    useEffect(() => {
        properties.onChange(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useInsertionEffect } from "@rbxts/react";

function Component({ onMount }) {
    useInsertionEffect(() => {
        onMount();
    }, [onMount]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},

			// EventFlag - existing
			{
				code: `
import * as React from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = React.useState(false);
    React.useEffect(() => {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            setSubmitted(false);
            sendForm();
        }
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            sendForm();
            setSubmitted(false);
        }
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) return;
        setSubmitted(false);
        sendForm();
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) {
            return;
        }
        sendForm();
        setSubmitted(false);
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},

			// ========== NEW: NAMED FUNCTION RESOLUTION ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);

    function initEffect(): void {
        setCount(properties.initialValue);
    }
    useEffect(initEffect, [properties.initialValue]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);

    const initEffect = () => {
        setCount(properties.initialValue);
    };
    useEffect(initEffect, [properties.initialValue]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);

    const initEffect = function syncInitialCount(): void {
        setCount(properties.initialValue);
    };
    useEffect(initEffect, [properties.initialValue]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    function notify() {
        onChange(value);
    }
    useEffect(notify, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit() {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }
    useEffect(handleSubmit, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},

			// ========== NEW: emptyEffect ==========
			// Note: Empty arrow function bodies like `() => {}` may have subtle parsing
			// Differences. The following tests check for effects with truly empty bodies.

			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {}, []);
}
`,
				errors: [{ messageId: "emptyEffect" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        return;
    }, []);
}
`,
				errors: [{ messageId: "emptyEffect" }],
			},

			// ========== NEW: initializeState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [name, setName] = useState<string | undefined>();
    useEffect(() => {
        setName("Hello World");
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(42);
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [items, setItems] = useState<string[]>([]);
    useEffect(() => {
        setItems([]);
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [items, setItems] = useState<string[]>([]);
    useEffect(() => {
        setItems([properties.item]);
    }, [properties.item]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [config, setConfig] = useState({});
    useEffect(() => {
        setConfig({ value: properties.value });
    }, [properties.value]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [label, setLabel] = useState("");
    useEffect(() => {
        setLabel(\`\${properties.prefix}-\${properties.suffix}\`);
    }, [properties.prefix, properties.suffix]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [name, setName] = useState("");
    useEffect(() => {
        setName(properties.primary?.name);
    }, [properties.primary]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [status, setStatus] = useState("");
    useEffect(() => {
        setStatus(properties.ready ? "ready" : properties.fallback);
    }, [properties.ready, properties.fallback]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},

			// ========== NEW: resetState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [comment, setComment] = useState("");
    useEffect(() => {
        setComment("");
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ items }) {
    const [selection, setSelection] = useState<string | null>(null);
    useEffect(() => {
        setSelection(null);
    }, [items]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        setIsLoading(false);
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [items, setItems] = useState<string[]>([]);
    useEffect(() => {
        setItems([]);
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},

			// ========== NEW: adjustState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ items }) {
    const [selection, setSelection] = useState<string | null>(null);
    useEffect(() => {
        if (items.length > 0) {
            setSelection(items[0]);
        }
    }, [items]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ user }) {
    const [profile, setProfile] = useState<string | null>(null);
    useEffect(() => {
        if (user) {
            setProfile(user.name);
        } else {
            setProfile(null);
        }
    }, [user]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			// ========== NEW: eventSpecificLogic ==========
			// Note: This detection is intentionally conservative to avoid false positives
			// On legitimate synchronization patterns like "fetch data, then process it"
			// The eventFlag pattern handles the common "toggle flag -> run side effect" case
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            analytics.track("submitted");
        }
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventSpecificLogic" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [ready, setReady] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (ready) {
            setReady(false);
        } else {
            if (submitted) {
                sendForm();
            }
        }
    }, [ready, submitted]);
}
`,
				errors: [{ messageId: "eventSpecificLogic" }, { messageId: "effectChain" }],
			},

			// ========== NEW: mixedDerivedState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count, logger }) {
    const [localCount, setLocalCount] = useState(0);
    useEffect(() => {
        setLocalCount(count);
        logger.log(count);
    }, [count, logger]);
}
`,
				errors: [{ messageId: "mixedDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count, analytics, method }) {
    const [localCount, setLocalCount] = useState(0);
    useEffect(() => {
        setLocalCount(count);
        analytics[method](count);
    }, [count, analytics, method]);
}
`,
				errors: [{ messageId: "mixedDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count }) {
    const [localCount, setLocalCount] = useState(0);
    useEffect(() => {
        setLocalCount(count);
        calculate(count);
    }, [count]);
}
`,
				errors: [{ messageId: "mixedDerivedState" }],
			},

			// ========== NEW: passRefToParent ==========

			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component({ onRef }) {
    const myRef = useRef();
    useEffect(() => {
        onRef(myRef.current);
    }, [onRef, myRef]);
}
`,
				errors: [{ messageId: "passRefToParent" }],
			},
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component({ onReady }) {
    const containerRef = useRef();
    useEffect(() => {
        if (containerRef.current) {
            onReady(containerRef.current);
        }
    }, [onReady, containerRef]);
}
`,
				errors: [{ messageId: "passRefToParent" }],
			},

			// ========== NEW: externalStore ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);
}
`,
				errors: [{ messageId: "externalStore" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
}
`,
				errors: [{ messageId: "externalStore" }],
			},

			// ========== NEW: logOnly ==========

			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ value }) {
    useEffect(() => {
        console.log("Value changed:", value);
    }, [value]);
}
`,
				errors: [{ messageId: "logOnly" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        console.log("Component mounted");
    }, []);
}
`,
				errors: [{ messageId: "logOnly" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ count }) {
    useEffect(() => {
        console.log("Count:", count);
        console.warn("Warning message");
    }, [count]);
}
`,
				errors: [{ messageId: "logOnly" }],
			},

			// ========== NEW: duplicateDeps ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);

    useEffect(() => {
        getProfilePicture(userId);
    }, [userId]);
}
`,
				errors: [{ messageId: "duplicateDeps" }, { messageId: "duplicateDeps" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ count }) {
    useEffect(() => {
        logCount(count);
    }, [count]);

    useEffect(() => {
        sendAnalytics(count);
    }, [count]);

    useEffect(() => {
        updateTitle(count);
    }, [count]);
}
`,
				errors: [
					{ messageId: "duplicateDeps" },
					{ messageId: "duplicateDeps" },
					{ messageId: "duplicateDeps" },
				],
			},

			// ========== NEW: effectChain ==========
			// Note: EffectChain detection identifies chains of effects where one effect
			// Sets state that triggers another effect. The individual effects in the chain
			// May not trigger derivedState if they use callback form setters or set constants.

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [card, setCard] = useState(null);
    const [goldCardCount, setGoldCardCount] = useState(0);

    useEffect(() => {
        if (card !== null && card.gold) {
            setGoldCardCount(c => c + 1);
        }
    }, [card]);

    useEffect(() => {
        if (goldCardCount > 3) {
            setCard(null);
        }
    }, [goldCardCount]);
}
`,
				// Only effectChain, not derivedState for individual effects
				errors: [{ messageId: "effectChain" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, setValue] = useState(0);
    const [doubled, setDoubled] = useState(0);

    useEffect(() => {
        setDoubled(value * 2);
    }, [value]);

    useEffect(() => {
        setValue(doubled + 1);
    }, [doubled]);
}
`,
				errors: [{ messageId: "derivedState" }, { messageId: "effectChain" }, { messageId: "derivedState" }],
			},
		],
		valid: [
			// ========== EXISTING VALID TESTS ==========
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect();
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(createEffect(), []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const sync = async () => {
        await fetchData();
    };
    useEffect(sync, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    const sync = () => fetchData();
    useEffect(sync, []);
}
`,
			},
			{
				code: `
import { useEffect, useRef, useState } from "@rbxts/react";

function Component({ count, onReady }) {
    const [localCount, setLocalCount] = useState(0);
    const ref = useRef();
    useEffect(() => {
        setLocalCount(count);
        onReady(ref.current);
        console.log(count);
    }, [count, onReady, ref]);
}
`,
				options: [
					{
						reportDerivedState: false,
						reportLogOnly: false,
						reportMixedDerivedState: false,
						reportPassRefToParent: false,
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count }) {
    const [localCount] = useState(0);
    useEffect(() => {
        sendAnalytics(count);
    }, [count]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count }) {
    const [localCount, , resetCount] = useState(0);
    useEffect(() => {
        sendAnalytics(count);
    }, [count]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ mode }) {
    const [status, setStatus] = useState("idle");
    useEffect(() => {
        setStatus("ready");
    }, [mode]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [card, setCard] = useState(null);
    const [goldCardCount, setGoldCardCount] = useState(0);

    useEffect(() => {
        if (card !== null && card.gold) {
            setGoldCardCount(c => c + 1);
        }
    }, [card]);

    useEffect(() => {
        if (goldCardCount > 3) {
            setCard(null);
        }
    }, [goldCardCount]);
}
`,
				options: [{ reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count, analytics }) {
    const [localCount, setLocalCount] = useState(0);
    useEffect(() => {
        setLocalCount(count);
        analytics.trackEvent(count);
    }, [count, analytics]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count, onReady }) {
    const [localCount, setLocalCount] = useState(0);
    useEffect(() => {
        setLocalCount(count);
        onReady();
    }, [count, onReady]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ items, selected }) {
    const [selection, setSelection] = useState<string | undefined>(selected);
    useEffect(() => {
        if (selection !== undefined) {
            keepSelection(selection);
        } else if (items.length > 0) {
            setSelection(items[0]);
        }
    }, [items, selection]);
}
`,
			},

			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => onChange(value), [onChange, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ [getKey()]: handleChange, value }) {
    useEffect(() => {
        handleChange(value);
    }, [handleChange, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange: { nested }, value }) {
    useEffect(() => {
        nested(value);
    }, [nested, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        const connection = connect();
        return () => disconnect(connection);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(async () => {
        await fetchData();
    }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        setValue(properties.count);
        logChange(properties.count);
    }, [properties.count]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => {
        if (!value) return;
        logChange(value);
        onChange(value);
    }, [onChange, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => {
        getNotifier(onChange)(value);
    }, [onChange, value]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component(properties) {
    React["useEffect"](() => {
        properties.onChange?.(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        return () => cleanup();
        function helper() {
            return () => ignored();
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        for (const item of items) {
            return () => cleanup(item);
        }
    }, [items]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        for (let index = 0; index < 1; index += 1) {
            return () => cleanup(index);
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        label: {
            return () => cleanup();
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        switch (getMode()) {
            case "open":
                return () => cleanup();
            default:
                return;
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        try {
            start();
        } catch (error) {
            return () => report(error);
        } finally {
            return () => stop();
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        while (shouldContinue()) {
            return () => stop();
        }
    }, []);
}
`,
			},

			// ========== NEW VALID: Legitimate useEffect usage ==========

			// Data fetching with cleanup
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [data, setData] = useState(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchUser(userId, { signal: controller.signal })
            .then(setData);
        return () => controller.abort();
    }, [userId]);
}
`,
			},

			// External system sync without setState
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ title }) {
    useEffect(() => {
        document.title = title;
    }, [title]);
}
`,
			},

			// Analytics tracking
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        trackPageView("/home");
    }, []);
}
`,
			},

			// Named function with actual side effects
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ isOpen }) {
    function handleToggle(): void {
        document.body.style.overflow = isOpen ? "hidden" : "";
    }
    useEffect(handleToggle, [isOpen]);
}
`,
			},

			// WebSocket connection
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ channelId }) {
    useEffect(() => {
        const ws = new WebSocket(\`wss://example.com/\${channelId}\`);
        ws.onmessage = (event) => {
            handleMessage(event.data);
        };
        return () => ws.close();
    }, [channelId]);
}
`,
			},

			// Third-party library integration
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component() {
    const canvasRef = useRef();
    useEffect(() => {
        const chart = new Chart(canvasRef.current, { type: "line" });
        return () => chart.destroy();
    }, []);
}
`,
			},

			// Timer/interval
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        const interval = setInterval(() => {
            pollServer();
        }, 5000);
        return () => clearInterval(interval);
    }, []);
}
`,
			},

			// Local storage sync (external system)
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ key, value }) {
    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);
}
`,
			},

			// Animation library integration
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component({ isOpen }) {
    const ref = useRef();
    useEffect(() => {
        const animation = animate(ref.current, { opacity: isOpen ? 1 : 0 });
        return () => animation.cancel();
    }, [isOpen]);
}
`,
			},

			// Effect with non-empty deps but no state setting
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ query }) {
    useEffect(() => {
        sendSearchAnalytics(query);
    }, [query]);
}
`,
			},

			// Named effect function with external side effects
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ userId }) {
    function syncUser(): void {
        api.syncUser(userId);
    }
    useEffect(syncUser, [userId]);
}
`,
			},

			// Different dependency arrays (not duplicate)
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ userId, projectId }) {
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);

    useEffect(() => {
        fetchProject(projectId);
    }, [projectId]);
}
`,
			},

			// Effect chain with actual side effects (valid)
			// This has no state setters in the second effect, so it's legitimate
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [data, setData] = useState(null);

    useEffect(() => {
        // Async data fetching - legitimate synchronization
        void (async () => {
            const result = await fetchData(userId);
            setData(result);
        })();
    }, [userId]);

    useEffect(() => {
        if (data) {
            processData(data);
        }
    }, [data]);
}
`,
			},

			// ========== REGRESSION: False-positive guards ==========

			// Duplicate deps across separate hooks should be valid
			{
				code: `
import { useEffect } from "react";

export function usePrimary(total: number, sync?: (value: number) => void): void {
    function runPrimarySync(): void {
        sync?.(total + 1);
    }
    useEffect(runPrimarySync, [total, sync]);
}

export function useSecondary(total: number, sync?: (value: number) => void): void {
    function runSecondarySync(): void {
        sync?.(total + 2);
    }
    useEffect(runSecondarySync, [total, sync]);
}
`,
				options: [{ environment: "standard" }],
			},

			// Subscription lifecycle with cleanup
			{
				code: `
import { useEffect, useState } from "react";

type Channel = {
    listen: (listener: (next: string) => void) => () => void;
};

export function useChannelValue(channel: Channel): string {
    const [value, setValue] = useState("");

    useEffect(() => {
        return channel.listen((next) => {
            setValue(next);
        });
    }, [channel]);

    return value;
}
`,
				options: [{ environment: "standard" }],
			},

			// Async resolution with cancellation guard
			{
				code: `
import { useEffect, useState } from "react";

export function useAsyncTitle(task: Promise<string>): string | undefined {
    const [title, setTitle] = useState<string | undefined>(undefined);

    function syncAsyncTitle(): () => void {
        let cancelled = false;

        task.then((nextTitle) => {
            if (cancelled) return;
            setTitle(nextTitle);
        });

        return () => {
            cancelled = true;
        };
    }

    useEffect(syncAsyncTitle, [task]);
    return title;
}
`,
				options: [{ environment: "standard" }],
			},

			// Timer orchestration with cleanup
			{
				code: `
import { useEffect, useRef, useState } from "react";

export function useStaggeredVisibility(isVisible: boolean, waitMs: number): boolean {
    const [shown, setShown] = useState(isVisible);
    const pendingTimer = useRef<number | undefined>(undefined);

    function applyVisibility(): () => void {
        if (isVisible) {
            if (pendingTimer.current !== undefined) {
                clearTimeout(pendingTimer.current);
                pendingTimer.current = undefined;
            }
            setShown(true);
            return () => {};
        }

        pendingTimer.current = window.setTimeout(() => {
            setShown(false);
            pendingTimer.current = undefined;
        }, waitMs);

        return () => {
            if (pendingTimer.current !== undefined) {
                clearTimeout(pendingTimer.current);
                pendingTimer.current = undefined;
            }
        };
    }

    useEffect(applyVisibility, [isVisible, waitMs]);
    return shown;
}
`,
				options: [{ environment: "standard" }],
			},

			// Imperative animation bridge
			{
				code: `
import { useEffect } from "react";

type MotionController = {
    pushTarget: (next: number) => void;
};

export function useMotionBridge(goal: number, controller: MotionController): void {
    useEffect(() => {
        controller.pushTarget(goal);
    }, [goal, controller]);
}
`,
				options: [{ environment: "standard" }],
			},

			// Observer registration with teardown
			{
				code: `
import { useEffect, useState } from "react";

type Watch = (key: "focus" | "hover", listener: (value: boolean) => void) => () => void;

export function useFocusHoverState(watch: Watch): boolean {
    const [active, setActive] = useState(false);

    function bindObservers(): () => void {
        const stopFocus = watch("focus", (value) => {
            setActive(value);
        });
        const stopHover = watch("hover", (value) => {
            setActive(value);
        });

        return () => {
            stopFocus();
            stopHover();
        };
    }

    useEffect(bindObservers, [watch]);
    return active;
}
`,
				options: [{ environment: "standard" }],
			},

			// Custom hook callback notification
			{
				code: `
import { useEffect } from "react";

interface ReadySignalInput {
    readonly ready: boolean;
    readonly onReady?: () => void;
}

export function useReadySignal({ ready, onReady }: ReadySignalInput): void {
    function notifyReady(): void {
        if (!ready) return;
        onReady?.();
    }

    useEffect(notifyReady, [ready, onReady]);
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect } from "react";

export const hooks = {
    useReadySignal({ ready, onReady }: ReadySignalInput): void {
        useEffect(() => {
            if (!ready) return;
            onReady?.();
        }, [ready, onReady]);
    },
};
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect } from "react";

export class ReadySignal {
    useReadySignal({ ready, onReady }: ReadySignalInput): void {
        useEffect(() => {
            if (!ready) return;
            onReady?.();
        }, [ready, onReady]);
    }
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        while (shouldContinue())
            return () => stop();
    }, []);
}
`,
			},

			// InitializeState disabled via options
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [name, setName] = useState<string | undefined>();
    useEffect(() => {
        setName("Hello World");
    }, []);
}
`,
				options: [{ reportInitializeState: false }],
			},

			// LogOnly disabled via options
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ value }) {
    useEffect(() => {
        console.log("Value changed:", value);
    }, [value]);
}
`,
				options: [{ reportLogOnly: false }],
			},

			// ExternalStore disabled via options
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, []);
}
`,
				options: [{ reportExternalStore: false }],
			},
		],
	});
});
