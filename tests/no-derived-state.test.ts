import { describe } from "vitest";
import rule from "$oxc-rules/no-derived-state";

import { tsx } from "./rule-testers";

describe("no-derived-state", () => {
	tsx.run("no-derived-state", rule, {
		invalid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');

  const [fullName, setFullName] = useState('');
  useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
}
`,
				documentation: { id: "fail", title: "Derived state stored by an effect" },
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    const name = firstName + ' ' + lastName;
    setFullName(name)
  }, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  const [fullName, setFullName] = useState('');
  const name = firstName + ' ' + lastName;

  useEffect(() => {
    setFullName(name)
  }, [name]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";
import { usePrefix } from 'library';

function Component() {
  const [name, setName] = useState();
  const [prefixedName, setPrefixedName] = useState();
  const prefix = usePrefix(name);

  useEffect(() => {
    const newValue = prefix + name;
    setPrefixedName(newValue);
  }, [prefix, name])
}
`,
				errors: [{ data: { state: "prefixedName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ firstName, lastName }) {
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ firstName, lastName }) {
  const [fullName, setFullName] = useState('');
  const prefixedName = 'Dr. ' + firstName;

  useEffect(() => {
    setFullName(prefixedName + ' ' + lastName);
  }, [prefixedName, lastName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleList({ list }) {
  const [doubleList, setDoubleList] = useState([]);

  useEffect(() => {
    setDoubleList(list.concat(list));
  }, [list]);
}
`,
				errors: [{ data: { state: "doubleList" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleList() {
  const [list, setList] = useState([]);
  const [doubleList, setDoubleList] = useState([]);

  useEffect(() => {
    setDoubleList(list.concat(list));
  }, [list]);
}
`,
				errors: [{ data: { state: "doubleList" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ title }) {
  const [name, setName] = useState('Dwayne');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(title + ' ' + name);
  }, [title, name]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ title }) {
  const [name, setName] = useState('Dwayne');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    const newFullName = title + ' ' + name;
    setFullName(newFullName);
  }, [title, name]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const prefix = useQuery('/prefix');
  const [name, setName] = useState();
  const [prefixedName, setPrefixedName] = useState();

  useEffect(() => {
    setPrefixedName(prefix + name)
  }, [prefix, name]);
}
`,
				errors: [{ data: { state: "prefixedName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "react";

function CountAccumulator({ count }) {
  const [total, setTotal] = useState(count);

  useEffect(() => {
    setTotal((prev) => prev + count);
  }, [count]);
}
`,
				errors: [{ data: { state: "total" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter({ count }) {
  const [doubleCount, setDoubleCount] = useState(0);

  const derivedSetter = (count) => setDoubleCount(count * 2);

  useEffect(() => {
    derivedSetter(count);
  }, [count]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ firstName, lastName }) {
  const [formData, setFormData] = useState({
    title: 'Dr.',
    fullName: '',
  });

  useEffect(() => {
    setFormData({
      ...formData,
      fullName: firstName + ' ' + lastName,
    });
  }, [firstName, lastName, formData]);
}
`,
				errors: [{ data: { state: "formData" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ firstName, lastName }) {
  const [formData, setFormData] = useState({
    title: 'Dr.',
    fullName: '',
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      fullName: firstName + ' ' + lastName,
    }));
  }, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "formData" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ firstName, lastName }) {
  const [formData, setFormData] = useState({
    title: 'Dr.',
    fullName: '',
  });

  const setFullName = (fullName) => setFormData({ ...formData, fullName });

  useEffect(() => {
    setFormData({
      ...formData,
      fullName: firstName + ' ' + lastName,
    });
  }, [firstName, lastName, formData]);
}
`,
				errors: [{ data: { state: "formData" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    console.log(name);

    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    const computeName = () => firstName + ' ' + lastName;

    setFullName(computeName());
  }, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    function computeName() {
      return firstName + ' ' + lastName;
    }

    setFullName(computeName());
  }, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  const computeName = () => firstName + ' ' + lastName;

  useEffect(() => {
    setFullName(computeName());
  }, [computeName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    const doSet = () => {
      setFullName(firstName + ' ' + lastName);
    }

    doSet();
  }, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "react";

function DoubleCounter() {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => setDoubleCount(count * 2), [count]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import * as React from "react";

function DoubleCounter() {
  const [count, setCount] = React.useState(0);
  const [doubleCount, setDoubleCount] = React.useState(0);

  React.useEffect(() => {
    setDoubleCount(count * 2);
  }, [count]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const DoubleCounter = memo(({ count }) => {
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => setDoubleCount(count), [count]);
});
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const DoubleCounter = () => {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => { setDoubleCount(count * 2); setDoubleCount(count * 2); }, [count]);
}
`,
				errors: [
					{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" },
					{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" },
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const DoubleCounter = () => {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(function() { setDoubleCount(count * 2); }, [count]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter(props) {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => setDoubleCount(props.count * 2), [props.count]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter({ propCount }) {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => setDoubleCount(propCount * 2), [propCount]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter({ count: countProp }) {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => setDoubleCount(countProp * 2), [countProp]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter(props) {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => setDoubleCount(props.nested.count * 2), [props.nested.count]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter() {
  const [count, setCount] = useState({ value: 0 });
  const [doubleCount, setDoubleCount] = useState({ value: 0 });

  useEffect(() => {
    setDoubleCount({ value: count.value * 2 });
  }, [count]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter({ count }) {
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => {
    setDoubleCount((count?.value ?? 1) * 2);
  }, [count?.value]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter(props) {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => setDoubleCount(props.count * 2), [props]);
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const DoubleCounter = () => {
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
import { useEffect, useState } from "@rbxts/react";

function SecondPost({ posts }) {
  const [secondPost, setSecondPost] = useState();

  useEffect(() => {
    const [, second] = posts;
    setSecondPost(second);
  }, [posts]);
}
`,
				errors: [{ data: { state: "secondPost" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "react";

function AttemptCounter() {
  const [, setAttempts] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setAttempts((prev) => {
      return prev + count;
    });
  }, [count]);
}
`,
				errors: [{ data: { state: "setAttempts" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function AttemptCounter() {
  const [attempts, setAttempts] = useState(0);
  const [count] = useState(0);

  useEffect(() => {
    setAttempts(count);
  }, [count]);
}
`,
				errors: [{ data: { state: "attempts" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useCustomHook() {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => {
    setDoubleCount(count * 2);
  }, [count]);

  return state;
}

function Component() {
  const customState = useCustomHook();
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useCustomHook(prop) {
  const [state, setState] = useState(0);

  useEffect(() => {
    setState(prop);
  }, [prop]);

  return state;
}
`,
				errors: [{ data: { state: "state" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const useCustomHook = ({ prop }) => {
  const [state, setState] = useState(0);

  useEffect(() => {
    setState(prop);
  }, [prop]);

  return state;
}
`,
				errors: [{ data: { state: "state" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter() {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  if (count > 10) {
    useEffect(() => {
      setDoubleCount(count * 2);
    }, [count]);
  }
}
`,
				errors: [{ data: { state: "doubleCount" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');

  function setDerivedName() {
    setName(firstName + ' ' + lastName);
  }

  useEffect(setDerivedName, [firstName, lastName]);
}
`,
				errors: [{ data: { state: "name" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function FilteredPosts({ posts }) {
  const [filteredPosts, setFilteredPosts] = useState([]);

  useEffect(() => {
    setFilteredPosts(
      posts.filter(([, value]) => value !== "")
    );
  }, [posts]);
}
`,
				errors: [{ data: { state: "filteredPosts" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Component = () => {
  const [data, setData] = useState();
  const setDataWrapper = setData;

  useEffect(() => {
    setDataWrapper(data);
  }, [data]);
}
`,
				errors: [{ data: { state: "data" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Component = () => {
  const [data, setData] = useState();
  const { setData: setDataAlias } = { setData };

  useEffect(() => {
    setDataAlias(data);
  }, [data]);
}
`,
				errors: [{ data: { state: "data" }, messageId: "avoidDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const Component = () => {
  const [data, setData] = useState();
  const setDataWrapper = (v) => setData(v);

  useEffect(() => {
    setDataWrapper(data);
  }, [data]);
}
`,
				errors: [{ data: { state: "data" }, messageId: "avoidDerivedState" }],
			},
			{
				// The upstream bare-`return;` cleanup fix: a bare return is NOT cleanup,
				// so a derived-state setter before it still reports.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(firstName + '!');
    return;
  }, [firstName]);
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
import { useEffect as effect, useState as state } from "react";

function Form() {
  const [firstName, setFirstName] = state('Taylor');
  const [fullName, setFullName] = state('');

  effect(() => {
    setFullName(firstName + '!');
  }, [firstName]);
}
`,
				errors: [{ data: { state: "fullName" }, messageId: "avoidDerivedState" }],
				options: [{ environment: "standard" }],
			},
		],

		valid: [
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');

  const fullName = firstName + ' ' + lastName;
}
`,
				documentation: { id: "pass", title: "Value derived during render" },
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form({ firstName, lastName }) {
  const fullName = firstName + ' ' + lastName;
}
`,
			},
			{
				// No dependency array: the rule requires array deps to analyze.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(firstName + '!');
  });
}
`,
			},
			{
				// Setter passed as a callback argument is not a synchronous call chain.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('Taylor');

  useEffect(() => {
    registerCallback(setFullName);
  }, [firstName]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Feed() {
  const { data: posts } = useQuery('/posts');
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    setScrollPosition(0);
  }, [posts]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Feed() {
  const { data: posts } = useQuery('/posts');
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const initialPosition = 0;
    setScrollPosition(initialPosition);
  }, [posts]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Feed() {
  const { data: posts } = useQuery('/posts');
  const [selectedPost, setSelectedPost] = useState();

  useEffect(() => {
    setSelectedPost(posts[0]);
  }, [posts]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Todos() {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    fetch('/todos').then((todos) => {
      setTodos(todos);
    });
  }, []);
}
`,
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
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
  const [name, setName] = useState();
  const [model] = useState(
    () => new FormModel(props)
  );

  useEffect(() => {
    model.setFieldDescriptor(name);
    return () => model.removeField(name);
  }, [model, name]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";
import { subscribeToStatus } from 'library';

function Status({ topic }) {
  const [status, setStatus] = useState();

  useEffect(() => {
    const unsubscribe = subscribeToStatus(topic, (status) => {
      setStatus(status);
    });

    return () => unsubscribe();
  }, [topic]);

  return <div>{status}</div>;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleCounter({ count }) {
  const [doubleCount, setDoubleCount] = useState(0);

  const derivedSetter = () => {
    const multipler = fetch('/multipler');
    setDoubleCount(multiplier);
  }

  useEffect(() => {
    derivedSetter();
  }, [count]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Counter({ count }) {
  const [multipliedCount, setMultipliedCount] = useState();

  useEffect(() => {
    fetch('/multiplier')
      .then((res) => res.json())
      .then((multiplier) => setMultipliedCount(count * multiplier));
  }, [count]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function DoubleList() {
  const [list, setList] = useState([]);
  const [doubleList, setDoubleList] = useState([]);

  useEffect(() => {
    doubleList.push(...list);
  }, [list]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useHasOverflow({ contentRef, maxHeight }) {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const resizeObserver = createResizeObserver((element) => {
      const hasContentOverflow = element.scrollHeight > maxHeight;
      setHasOverflow(hasContentOverflow);
    })

    resizeObserver.observe(contentRef.current);
  }, [contentRef, maxHeight]);

  return hasOverflow;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function ComponentOne() {
  const [data, setData] = useState();
}

function ComponentTwo() {
  const setData = (data) => {
    console.log(data);
  }

  useEffect(() => {
    setData('hello');
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Feed() {
  const { data } = useQuery('/posts');
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    setScrollPosition(0);
  }, [data.posts]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

export const App = () => {
  const [response, setResponse] = useState(null);

  const fetchYesNoApi = () => {
    return (async () => {
      try {
        const response = await fetch('https://yesno.wtf/api');
        if (!response.ok) {
          throw new Error('Network error');
        }
        const data = await response.json();
        setResponse(data);
      } catch (err) {
        console.error(err);
      }
    })();
  };

  useEffect(() => {
    (async () => {
      await fetchYesNoApi();
    })();
  }, []);

  return (
    <div>{response}</div>
  );
};
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
  const [count, setCount] = useState(0);
  const [doubleCount, setDoubleCount] = useState(0);

  useEffect(() => {
    function handleClick() {
      setDoubleCount(count * 2);
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [count]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  const doSet = (arg1, arg2) => {
    console.log(arg1, arg2);
  }

  useEffect(() => {
    doSet(firstName, lastName);
  }, [firstName, lastName]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Counter({ count }) {
  const [countJson, setCountJson] = useState();

  useEffect(() => {
    setCountJson(JSON.stringify(count));
  }, [count]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  function computeName(firstName, lastName) {
    console.log('meow');
    return firstName + ' ' + lastName;
  }

  useEffect(() => {
    setFullName(computeName(firstName, lastName));
  }, [firstName, lastName]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  const computeName = (firstName, lastName) => {
    return firstName + ' ' + lastName;
  }

  useEffect(() => {
    const newFullName = computeName(firstName, lastName);
    setFullName(newFullName);
  }, [firstName, lastName, computeName]);
}
`,
			},
			{
				code: `
import { useCallback, useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Dwayne');
  const [lastName, setLastName] = useState('The Rock');
  const [fullName, setFullName] = useState('');

  const computeName = useCallback(() => firstName + ' ' + lastName, [firstName, lastName]);

  useEffect(() => {
    setFullName(computeName());
  }, [computeName]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
  const api = useFetchWrapper();
  const [state, setState] = useState();

  useEffect(() => {
    async function fetchIt() {
      const response = await fetch('/endpoint');
      setState(response);
    }

    void fetchIt();
  }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
  const api = useFetchWrapper();
  const [state, setState] = useState();

  useEffect(() => {
    async function fetchIt() {
      const response = await api.doFetch('/endpoint');
      setState(response);
    }

    void fetchIt();
  }, [api]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
  const api = useFetchWrapper();
  const [state, setState] = useState();

  useEffect(() => {
    (async function fetchIt() {
      const response = await api.doFetch('/endpoint');
      setState(response);
    })();
  }, [api]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useHasOverflow({ contentRef, maxHeight }) {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((element) => {
      const hasContentOverflow = element.scrollHeight > maxHeight;
      setHasOverflow(hasContentOverflow);
    })

    resizeObserver.observe(contentRef.current);
  }, [contentRef, maxHeight]);

  return hasOverflow;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useHasOverflow({ contentRef, maxHeight }) {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const fn = (element) => {
      const hasContentOverflow = element.scrollHeight > maxHeight;
      setHasOverflow(hasContentOverflow);
    }
    const resizeObserver = new ResizeObserver(fn)

    resizeObserver.observe(contentRef.current);
  }, [contentRef, maxHeight]);

  return hasOverflow;
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function useHasOverflow({ contentRef, maxHeight }) {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const fn = (element) => {
      const hasContentOverflow = element.scrollHeight > maxHeight;
      setHasOverflow(hasContentOverflow);
    }
    const resizeObserver = createResizeObserver(fn)

    resizeObserver.observe(contentRef.current);
  }, [contentRef, maxHeight]);

  return hasOverflow;
}
`,
			},
			{
				code: `
import { useEffect as effect, useState as state } from "react";

function Form() {
  const [firstName, setFirstName] = state('Taylor');
  const [lastName, setLastName] = state('Swift');

  const fullName = firstName + ' ' + lastName;

  effect(() => {
    console.log(fullName);
  }, [fullName]);
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect as effect, useState as state } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = state('Taylor');

  function effect(callback) {
    callback();
  }

  effect(() => {
    setFirstName('Swift');
  });
}
`,
			},
			{
				code: `
import { useEffect } from "preact/hooks";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');

  useEffect(() => {
    setFirstName('Swift');
  }, [firstName]);
}
`,
				options: [{ environment: "standard" }],
			},
			{
				// useLayoutEffect is deliberately excluded from the focused rules.
				code: `
import { useLayoutEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [fullName, setFullName] = useState('');

  useLayoutEffect(() => {
    setFullName(firstName + '!');
  }, [firstName]);
}
`,
			},
			{
				// A state setter returned from the effect is not inside any call callee,
				// so `getCallExpression` cannot resolve it.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (firstName.length > 0) {
      return setFullName;
    }
  }, [firstName]);
}
`,
			},
			{
				// A setter bound to the name `useState` matches `isUseState` itself, so
				// `getStateName` finds no destructured declaration and yields undefined.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [data, useState] = useState();
  const [firstName, setFirstName] = useState('Taylor');

  useEffect(() => {
    useState(5);
  }, [data]);
}
`,
			},
			{
				// An unimported `useEffect` resolves to no variable: the binding-aware
				// import check returns false and the effect is not analyzed.
				code: `
function Form() {
  const [fullName, setFullName] = useState('Taylor');

  useEffect(() => {
    setFullName('x');
  }, []);
}
`,
			},
			{
				// A computed-member callee is never a recognized effect call.
				code: `
import { useState } from "@rbxts/react";

function Form() {
  const [fullName, setFullName] = useState('Taylor');
  const effectCallbacks = { useEffect: (fn) => fn() };

  effectCallbacks["useEffect"](() => {
    setFullName('x');
  });
}
`,
			},
			{
				// A namespace import called directly resolves to an ImportBinding that is
				// not an ImportSpecifier, so the binding-aware check rejects it.
				code: `
import * as React from "@rbxts/react";

function Form() {
  const [fullName, setFullName] = useState('Taylor');

  React(() => {
    setFullName('x');
  });
}
`,
			},
			{
				// A member-expression callback resolves to no function node.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [fullName, setFullName] = useState('Taylor');
  const actions = { update: () => setFullName('x') };

  useEffect(actions.update, []);
}
`,
			},
			{
				// An unresolvable identifier callback produces no effect analysis.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [fullName, setFullName] = useState('Taylor');

  useEffect(missingCallback, []);
}
`,
			},
			{
				// An identifier bound to an initializer-less declaration cannot be resolved.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [fullName, setFullName] = useState('Taylor');
  let deferredCallback;

  useEffect(deferredCallback, []);
}
`,
			},

			{
				// A three-element useState destructure is not a recognized state pair.
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [first, second, third] = useState('Taylor');

  useEffect(() => {
    second('x');
  }, [first]);
}
`,
			},
			{
				// An alias initializer inside the effect is a state call whose call
				// expression cannot be resolved (the ref is not a callee).
				code: `
import { useEffect, useState } from "@rbxts/react";

function Form() {
  const [fullName, setFullName] = useState('Taylor');

  useEffect(() => {
    const alias = setFullName;
    alias('x');
  }, []);
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
