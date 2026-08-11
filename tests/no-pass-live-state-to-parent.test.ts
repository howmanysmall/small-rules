import { describe } from "vitest";
import rule from "$oxc-rules/no-pass-live-state-to-parent";

import { tsx } from "./rule-testers";

describe("no-pass-live-state-to-parent", () => {
	tsx.run("no-pass-live-state-to-parent", rule, {
		invalid: [
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
      onChange={(e) => setText(e.target.value)}
    />
  );
}
`,
				documentation: { id: "fail", title: "Effect passes live state to a parent" },
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    onTextChanged(text);
  });

  return (
    <input
      type="text"
      onChange={(e) => setText(e.target.value)}
    />
  );
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    onTextChanged(text);
  }, []);

  return (
    <input
      type="text"
      onChange={(e) => setText(e.target.value)}
    />
  );
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const useCustomHook = ({ onTextChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    onTextChanged(text);
  }, [onTextChanged, text]);
}
`,
				errors: [
					{
						data: { name: '"useCustomHook"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInHook",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  const [text, setText] = useState();
  const data = useSomeAPI();

  useEffect(() => {
    onTextChanged(text, data);
  }, [onTextChanged, text, data]);

  return (
    <input
      type="text"
      onChange={(e) => setText(e.target.value)}
    />
  );
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    const firstChar = text[0];
    onTextChanged(firstChar);
  }, [onTextChanged, text]);

  return (
    <input
      type="text"
      onChange={(e) => setText(e.target.value)}
    />
  );
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onFetched }) => {
  const [data, setData] = useState();
  const onFetchedWrapper = (v) => onFetched(v);

  useEffect(() => {
    onFetchedWrapper(data);
  }, [onFetched, data]);
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"data"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = (props) => {
  const [data, setData] = useState();
  const { onFetched } = props;

  useEffect(() => {
    onFetched(data);
  }, [onFetched, data]);
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"data"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ onSubmit }) {
  const [name, setName] = useState();
  const [dataToSubmit, setDataToSubmit] = useState();

  useEffect(() => {
    if (!dataToSubmit) return;

    onSubmit(dataToSubmit);
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
					{
						data: { name: '"Form"', state: '"dataToSubmit"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const [text, setText] = useState();
  const [count, setCount] = useState(0);

  useEffect(() => {
    onChanged(text, count);
  }, [onChanged, text, count]);
}
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text" and "count"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
			{
				// An effect callback inside a custom hook reports the hook name.
				code: `
import { useEffect, useState } from "@rbxts/react";

function useCustomHook(onChanged) {
  const [text, setText] = useState();

  useEffect(() => {
    onChanged(text);
  }, [onChanged, text]);
}
`,
				errors: [
					{
						data: { name: '"useCustomHook"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInHook",
					},
				],
			},
			{
				// A memo-wrapped arrow reports the component's declared name.
				code: `
import { memo, useEffect, useState } from "@rbxts/react";

const Child = memo(({ onTextChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    onTextChanged(text);
  }, [onTextChanged, text]);
});
`,
				errors: [
					{
						data: { name: '"Child"', state: '"text"' },
						messageId: "avoidPassingLiveStateToParentInComponent",
					},
				],
			},
		],
		valid: [
			{
				// A literal callback argument is not live state, so there is nothing to report.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  useEffect(() => {
    onTextChanged("Hello World");
  }, [onTextChanged]);
}
`,
			},
			{
				code: `
import { useState } from "@rbxts/react";

function Parent() {
  const [text, setText] = useState('');

  return <Child text={text} onTextChanged={setText} />;
}
`,
				documentation: { id: "pass", title: "Parent owns the state" },
			},
			{
				// A setter passed as a callback argument is not a call, so there is nothing to report.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onTextChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    registerCallback(setText);
  }, [onTextChanged, setText]);
}
`,
			},
			{
				// An alias of a prop callback that is itself passed as an argument (not called)
				// has a prop-call chain but no call expression.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    const wrapper = onChanged;
    registerCallback(wrapper);
  }, [onChanged, text]);
}
`,
			},
			{
				// A wrapper arrow invoked later defers the callback outside the synchronous effect body.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ onChanged }) => {
  const [text, setText] = useState();

  useEffect(() => {
    const wrapper = (v) => onChanged(v);
    registerCallback(wrapper);
  }, [onChanged, text]);
}
`,
			},
			{
				// No idea why someone would do this, but maybe there's a less contrived pattern.
				// Plus the rule's message and linked docs only mention state - obviously you can't "lift" a prop.
				code: `
import { useEffect, useState } from "@rbxts/react";

const Child = ({ text, onTextChanged }) => {
  useEffect(() => {
    onTextChanged(text);
  }, [text, onTextChanged]);
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

const MyComponent = inject('ourStore')(observer(({ ourStore }) => {
  const [option, setOption] = useState();

  useEffect(() => {
    ourStore.push(option);
  }, [option]);
}));
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";
import { withRouter } from 'react-router-dom';

const MyComponent = ({ history }) => {
  const [option, setOption] = useState();

  useEffect(() => {
    history.push(option);
  }, [option]);
};

const wrapped = withRouter(MyComponent);
`,
			},
			{
				// https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/46
				code: `
import { useEffect, useState } from "@rbxts/react";
import { withRouter } from 'react-router-dom';

const MyComponent = ({ history }) => {
  const [option, setOption] = useState();

  useEffect(() => {
    history.push(option);
  }, [option]);
};

const EnhancedComponent = inject('ourStore')(observer(MyComponent))
export default EnhancedComponent
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
      history.push(data.error);
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

  return <div ref={ref}>Child</div>;
}
`,
			},
		],
	});
});
