import { describe } from "vitest";
import rule from "$oxc-rules/no-pass-data-to-parent";

import { tsx } from "./rule-testers";

describe("no-pass-data-to-parent", () => {
	tsx.run("no-pass-data-to-parent", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onFetched }) => {
  const data = useSomeAPI();

  useEffect(() => {
    onFetched(data);
  }, [onFetched, data]);
}
`,
				documentation: { id: "fail", title: "Effect passes fetched data to a parent" },
				errors: [
					{
						data: { data: '"useSomeAPI"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onFetched }) => {
  const data = useSomeAPI();

  useEffect(() => {
    onFetched(data);
  });
}
`,
				errors: [
					{
						data: { data: '"useSomeAPI"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onFetched }) => {
  const data = useSomeAPI();

  useEffect(() => {
    onFetched(data);
  }, []);
}
`,
				errors: [
					{
						data: { data: '"useSomeAPI"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const useCustomHook = ({ onFetched }) => {
  const data = useSomeAPI();

  useEffect(() => {
    onFetched(data);
  }, [onFetched, data]);
}
`,
				errors: [
					{
						data: { data: '"useSomeAPI"', name: '"useCustomHook"' },
						messageId: "avoidPassingDataToParentInHook",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onFetched }) => {
  const data = useSomeAPI();
  const firstElement = data[0];

  useEffect(() => {
    onFetched(firstElement);
  }, [onFetched, firstElement]);
}
`,
				errors: [
					{
						data: { data: '"useSomeAPI"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onResult }) => {
  const data = useSomeAPI();
  const meta = useOtherAPI();

  useEffect(() => {
    onResult(data, meta);
  }, [onResult, data, meta]);
}
`,
				errors: [
					{
						data: { data: '"useSomeAPI" and "useOtherAPI"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const [count, setCount] = useState(0);
  const data = useSomeAPI();

  useEffect(() => {
    onChanged(data, count);
  }, [onChanged, data, count]);
}
`,
				errors: [
					{
						data: { data: '"useSomeAPI"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
			{
				// A memo-wrapped arrow component reports the declared component name.
				code: `
import { memo, useEffect, useState } from "@rbxts/react";

const Child = memo(({ onFetched }) => {
  const data = useSomeAPI();

  useEffect(() => {
    onFetched(data);
  }, [onFetched, data]);
});
`,
				errors: [
					{
						data: { data: '"useSomeAPI"', name: '"Child"' },
						messageId: "avoidPassingDataToParentInComponent",
					},
				],
			},
		],
		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  useEffect(() => {
    onTextChanged("Hello World");
  }, [onTextChanged]);
}
`,
				documentation: { id: "pass", title: "Parent owns the data" },
			},
			{
				// Passing the `useState` callee itself as data is not flagged.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  useEffect(() => {
    onChanged(useState);
  }, [onChanged]);
}
`,
			},
			{
				// Passing the `useRef` callee itself as data is not flagged.
				code: `
import { useEffect, useRef } from "@rbxts/react";

const Child = ({ onChanged }) => {
  useEffect(() => {
    onChanged(useRef);
  }, [onChanged]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  const hello = "Hello";
  const world = "World";
  const greeting = hello + " " + world;
  useEffect(() => {
    onTextChanged(greeting);
  }, [onTextChanged]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    onTextChanged(text);
  }, [onTextChanged, text]);

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ text, onTextChanged }) => {
  useEffect(() => {
    onTextChanged(text);
  }, [onTextChanged, text]);

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ onClose }) {
  const [name, setName] = useState();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      onClose();
    }
  }, [isOpen]);

  return (
    <button onClick={() => setIsOpen(false)}>Close</button>
  )
}
`,
			},
			{
				// This might be an anti-pattern in the first place...
				code: `
import { useEffect, useState } from "@rbxts/react";

function Child({ getData }) {
  useEffect(() => {
    console.log(getData());
  }, [getData]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";
import { withRouter } from 'react-router-dom';

const MyComponent = withRouter(({ history }) => {
  const [option, setOption] = useState();

  useEffect(() => {
    history.push(option);
  }, [option]);
});
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";
import { withRouter } from 'react-router-dom';

const MyComponent = withRouter(({ history }) => {
  const data = useSomeAPI();

  useEffect(() => {
    if (data.error) {
      history.push('/error');
    }
  }, [data]);
});
`,
			},
			{
				code: `
import { useEffect, useRef, useState } from "@rbxts/react";

const Child = ({ onRef }) => {
  const ref = useRef();

  useEffect(() => {
    onRef(ref.current);
  }, [onRef, ref.current]);
}
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/37
				// Alternate solutions exist, but this is arguably the most readable.
				code: `
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

function DeleteDropTarget({ onDelete }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const cleanup = dropTargetForElements({
      element,
      onDrop: ({ source }) => {
        onDelete(source.data);
      },
    });

    return cleanup;
  }, [onDelete]);

  return <div ref={ref}>Drop an item here to delete</div>;
};
`,
				options: [{ environment: "standard" }],
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/43
				code: `
import { useEffect, useState } from "@rbxts/react";

function useActorLogger(actorRef) {
  useEffect(() => {
    return actorRef.system.inspect((next) => {
      if (next.type === '@xstate.snapshot') {
        console.log('ACTOR SNAPSHOT', next.snapshot);
      }
    }).unsubscribe;
  }, [actorRef]);
}
`,
			},
			{
				code: `
import { useEffect, useRef, useState } from "@rbxts/react";

const Child = ({ onClicked }) => {
  const ref = useRef();

  useEffect(() => {
    ref.current.addEventListener('click', (event) => {
      onClicked(event);
    });
  }, [onClicked, ref]);
}
`,
			},
			{
				code: `
import { useEffect, useRef, useState } from "@rbxts/react";

const Child = ({ ref }) => {
  useEffect(() => {
    ref.current.addEventListener('click', (event) => {
      console.log('Clicked', event);
    });
  }, [ref]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onResized }) => {
  useEffect(() => {
    window.addEventListener('resize', (event) => {
      onResized({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });
    return () => window.removeEventListener('resize', handleResize);
  }, [onResized]);
}
`,
			},
			{
				// A member expression that is not a React hook is treated as data.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const api = { useState };

  useEffect(() => {
    onChanged(api.useState);
  }, [onChanged]);
}
`,
			},
			{
				// A member expression that is not a React hook is treated as data.
				code: `
import { useEffect, useRef } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const api = { useRef };

  useEffect(() => {
    onChanged(api.useRef);
  }, [onChanged]);
}
`,
			},
			{
				// An alias of a prop callback that is itself passed as an argument
				// has a prop-call chain but no call expression.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const data = useSomeAPI();

  useEffect(() => {
    const wrapper = onChanged;
    registerCallback(wrapper);
  }, [onChanged, data]);
}
`,
			},
			{
				// A prop callback passed as an argument (not called) has no call expression.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  useEffect(() => {
    registerCallback(onChanged);
  }, [onChanged]);
}
`,
			},
			{
				// A callback used asynchronously is not considered a synchronous call.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const data = useSomeAPI();

  useEffect(() => {
    fetch('/data').then(() => onChanged(data));
  }, [onChanged, data]);
}
`,
			},
			{
				// A ref object received from props has its `current` access skipped as data.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged, ref }) => {
  useEffect(() => {
    onChanged(ref.current);
  }, [onChanged, ref]);
}
`,
			},
		],
	});
});
