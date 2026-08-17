import { describe } from "vitest";
import noAdjustStateOnPropChange from "$oxc-rules/react/no-adjust-state-on-prop-change";
import noChainStateUpdates from "$oxc-rules/react/no-chain-state-updates";
import noDerivedState from "$oxc-rules/react/no-derived-state";
import noEventHandler from "$oxc-rules/react/no-event-handler";
import noExternalStoreSubscription from "$oxc-rules/react/no-external-store-subscription";
import noInitializeState from "$oxc-rules/react/no-initialize-state";
import noPassDataToParent from "$oxc-rules/react/no-pass-data-to-parent";
import noPassLiveStateToParent from "$oxc-rules/react/no-pass-live-state-to-parent";
import noResetAllStateOnPropChange from "$oxc-rules/react/no-reset-all-state-on-property-change";

import { tsx } from "./rule-testers";

// Sanity check that runs the focused effect rules on common + valid real-world
// code, as opposed to contrived test cases. Each snippet must pass all nine
// rules.
const realWorldSnippets: ReadonlyArray<{ readonly code: string; readonly name: string }> = [
	{
		name: "useLayoutEffect",
		code: `
import { useEffect, useLayoutEffect, useRef, useState } from "@rbxts/react";

function Input({ count }) {
  const ref = useRef();

  useLayoutEffect(() => {
    if (count == 0) {
      ref.current?.focus();
    }
  }, [count]);

  return (
    <input ref={ref} value={count} />
  )
}
`,
	},
	{
		name: "Managing a timer",
		code: `
import { useEffect, useState } from "@rbxts/react";

function Timer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    }
  }, []);

  return <div>{seconds}</div>;
}
`,
	},
	{
		name: "Debouncing",
		code: `
import { useEffect, useState } from "@rbxts/react";

function useDebouncedState(value, delay) {
  const [state, setState] = useState(value);
  const [debouncedState, setDebouncedState] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedState(state);
    }, delay);

    return () => {
      clearTimeout(timeout);
    };
  }, [delay, state]);

  return [state, debouncedState, setState];
}
`,
	},
	{
		name: "Debouncing via Lodash",
		code: `
import { useEffect, useState } from "@rbxts/react";
import debounce from 'lodash/debounce';

export const useDebouncedState = (delay) => {
  const [value] = useState(0);

  const debouncedFunction = debounce((newValue) => {
    console.log(newValue);
  }, delay);

  useEffect(() => {
    debouncedFunction(value);
  }, [value, debouncedFunction]);

  return [];
};
`,
	},
	{
		name: "Listening for window events",
		code: `
import { useEffect, useState } from "@rbxts/react";

function WindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div>{size.width} x {size.height}</div>;
}
`,
	},
	{
		name: "ResizeObserver",
		code: `
import { useEffect, useState } from "@rbxts/react";

function useHasOverflow({ contentRef, maxHeight }) {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((element) => {
      const hasContentOverflow = element.scrollHeight > maxHeight;
      setHasOverflow(hasContentOverflow);
    })

    if (contentRef.current != null) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [contentRef, maxHeight]);

  return hasOverflow;
}
`,
	},
	{
		name: "Play/pausing DOM video",
		code: `
import { useEffect, useRef, useState } from "@rbxts/react";

function VideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef();

  useEffect(() => {
    if (isPlaying) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  return <div>
    <video ref={videoRef} />
    <button onClick={() => setIsPlaying((p) => !p)} />
  </div>
}
`,
	},
	{
		name: "Saving to LocalStorage",
		code: `
import { useEffect, useState } from "@rbxts/react";

function Notes() {
  const [notes, setNotes] = useState(() => {
    const savedNotes = localStorage.getItem('notes');
    return savedNotes ? JSON.parse(savedNotes) : [];
  });

  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  return <input
    type="text"
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
  />
}
`,
	},
	{
		name: "Logging/Analytics",
		code: `
import { useEffect, useState } from "@rbxts/react";

function Nav() {
  const [page, setPage] = useState('home');

  useEffect(() => {
    console.log("page viewed", page);
  }, [page]);

  return (
    <div>
      <button onClick={() => setPage('home')}>Home</button>
      <button onClick={() => setPage('about')}>About</button>
      <div>{page}</div>
    </div>
  )
}
`,
	},
	{
		name: "CountryPicker",
		code: `
import { useEffect, useState } from "@rbxts/react";

function CountryPicker({ withEmoji }) {
  const { translation, getCountries } = useContext();

  const [state, setState] = useState({
    countries: [],
    selectedCountry: null,
  });
  const setCountries = (countries) => setState({ ...state, countries });

  useEffect(() => {
    let cancel = false;
    getCountries(translation)
      .then((countries) => (cancel ? null : setCountries(countries)))
      .catch(console.warn);

    return () => {
      cancel = true;
    };
  }, [translation, withEmoji]);
}
`,
	},
	{
		name: "navigation.setOptions",
		code: `
import { useNavigation } from '@react-navigation/native';
import { useState, useLayoutEffect } from 'react';

function ProfileScreen({ route }) {
  const navigation = useNavigation();
  const [value, onChangeText] = React.useState(route.params.title);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: value === '' ? 'No title' : value,
    });
  }, [navigation, route]);
}
`,
	},
	{
		name: "Keyboard state listener",
		code: `
import { useEffect, useState } from "@rbxts/react";
import keyboardReducer from './reducers';

let globalKeyboardState = {
  recentlyUsed: []
};

export const keyboardStateListeners = new Set();

const setKeyboardState = (action) => {
  globalKeyboardState = keyboardReducer(globalKeyboardState, action);
  keyboardStateListeners.forEach((listener) => listener(globalKeyboardState));
};

export const useKeyboardStore = () => {
  const [keyboardState, setState] = useState(globalKeyboardState);

  useEffect(() => {
    const listener = () => setState(globalKeyboardState);
    keyboardStateListeners.add(listener);
    return () => {
      keyboardStateListeners.delete(listener);
    };
  }, [keyboardState]);

  return { keyboardState, setKeyboardState };
};

useKeyboardStore.setKeyboardState = setKeyboardState;
`,
	},
	{
		name: "Indexing ref state with internal state",
		code: `
import { useEffect, useRef, useState } from "@rbxts/react";

const someArray = [{ id: 1 }, { id: 2 }, { id: 3 }];

const Component = ({ value }) => {
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current?.[index]?.focus();
  }, [value, index]);

  return (
    <>
      {someArray.map((item, index) => (
        <input
          key={item.id}
          ref={(el) => (inputRefs.current[index] = el)}
        />
      ))}
    </>
  )
}
`,
	},
	{
		name: "Ref callback",
		code: `
import { useCallback, useEffect, useState } from "@rbxts/react";

export const useOnScreen = () => {
    const [element, setElement] = useState(null);
    const [isIntersecting, setIntersecting] = useState(false);

    const ref = useCallback((element) => {
        setElement(element);
    }, []);

    useEffect(() => {
        if (!element) {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => {
            setIntersecting(entry?.isIntersecting ?? false);
        });

        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, [element]);

    return { ref, isIntersecting };
};
`,
	},
	{
		name: "Effect with recursion",
		code: `
import { useEffect } from "@rbxts/react";

function Component() {
  useEffect(() => {
    const container = ctnDom.current
    if (!container) return

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false })
    const gl = renderer.gl
    const program = new Program(gl, {
      vertex: vert,
      fragment: frag,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
        hue: { value: hue },
        hover: { value: 0 },
        rot: { value: 0 },
        hoverIntensity: { value: hoverIntensity },
      },
    })
    const mesh = new Mesh(gl, { geometry, program })

    let rafId
    let lastTime = 0
    let currentRot = 0
    const rotationSpeed = 0.3

    const update = (t) => {
      rafId = requestAnimationFrame(update)
      const dt = (t - lastTime) * 0.001
      lastTime = t
      const currentTime = t * 0.001
      program.uniforms.iTime.value = currentTime

      if (cycleHue) {
        const cyclicHue = (hue + currentTime * hueCycleSpeed) % 360
        program.uniforms.hue.value = cyclicHue
      } else {
        program.uniforms.hue.value = hue
      }

      program.uniforms.hoverIntensity.value = hoverIntensity

      const effectiveHover = forceHoverState ? 1 : targetHover
      program.uniforms.hover.value += (effectiveHover - program.uniforms.hover.value) * 0.1

      if (rotateOnHover && effectiveHover > 0.5) {
        currentRot += dt * rotationSpeed
      }
      program.uniforms.rot.value = currentRot

      renderer.render({ scene: mesh })
    }
    rafId = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mouseleave", handleMouseLeave)
      container.removeChild(gl.canvas)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }, [
    hue,
    hoverIntensity,
    rotateOnHover,
    forceHoverState,
    cycleHue,
    hueCycleSpeed,
    size,
  ])
}
`,
	},
	{
		name: "TanStack useInfinityQuery useInView",
		code: `
import React from 'react'
import { useInView } from 'react-intersection-observer'
import { useInfiniteQuery } from '@tanstack/react-query'

function Example() {
  const { ref, inView } = useInView()

  const {
    status,
    data,
    error,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
  } = useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: async ({
      pageParam,
    }) => {
      const response = await fetch('/api/projects?cursor=' + pageParam)
      return await response.json()
    },
    initialPageParam: 0,
    getPreviousPageParam: (firstPage) => firstPage.previousId,
    getNextPageParam: (lastPage) => lastPage.nextId,
  })

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])
}
`,
	},
	{
		name: "React Query: fresh data synced to state",
		code: `
import { useEffect, useState } from "@rbxts/react";
import { useQuery } from '@tanstack/react-query'

function Items() {
  const [filter, setFilter] = useState('all')
  const { data } = useQuery({
    queryKey: ['items', filter],
    queryFn: () => fetchItems(filter),
  })
  const [items, setItems] = useState([])

  useEffect(() => {
    if (data) {
      setItems(data)
    }
  }, [data])

  return <div>{items}</div>
}
`,
	},
	{
		name: "TanStack useInfinityQuery useInView with state, prop and data in queryKey",
		code: `
import React from 'react'
import { useInView } from 'react-intersection-observer'
import { useInfiniteQuery } from '@tanstack/react-query'

function Example(props) {
  const { ref, inView } = useInView()
  const [state] = React.useState(0)
  const search = useSearchParams()

  const {
    status,
    data,
    error,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
  } = useInfiniteQuery({
    queryKey: ['projects', state, props, search],
    queryFn: async ({
      pageParam,
    }) => {
      const response = await fetch('/api/projects?cursor=' + pageParam)
      return await response.json()
    },
    initialPageParam: 0,
    getPreviousPageParam: (firstPage) => firstPage.previousId,
    getNextPageParam: (lastPage) => lastPage.nextId,
  })

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])
}
`,
	},
];

describe("react effect rules on real-world code", () => {
	// Each snippet must pass all nine focused rules.
	tsx.run("no-adjust-state-on-prop-change", noAdjustStateOnPropChange, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-chain-state-updates", noChainStateUpdates, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-derived-state", noDerivedState, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-event-handler", noEventHandler, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-external-store-subscription", noExternalStoreSubscription, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-initialize-state", noInitializeState, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-pass-data-to-parent", noPassDataToParent, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-pass-live-state-to-parent", noPassLiveStateToParent, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
	tsx.run("no-reset-all-state-on-prop-change", noResetAllStateOnPropChange, {
		invalid: [],
		valid: realWorldSnippets.map(({ code }) => code),
	});
});
