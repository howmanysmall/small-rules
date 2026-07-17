import { describe } from "vitest";
import rule from "$oxc-rules/no-god-components";

import { tsx } from "./rule-testers";

describe("no-god-components", () => {
	tsx.run("no-god-components", rule, {
		invalid: [
			{
				code: `
function Big() {
    const a = 1;
    const b = 2;
    const c = 3;
    return <div />;
}
`,
				documentation: { id: "fail", title: "Component exceeds maximum lines" },
				errors: [{ messageId: "exceedsMaxLines" }],
				options: [{ enforceTargetLines: false, maxLines: 5, targetLines: 5 }],
			},
			{
				code: `
function OverTarget() {
    const a = 1;
    const b = 2;
    return <div />;
}
`,
				errors: [{ messageId: "exceedsTargetLines" }],
				options: [{ enforceTargetLines: true, maxLines: 10, targetLines: 3 }],
			},
			{
				code: `
function Deep() {
    return (
        <div>
            <span>
                <b />
            </span>
        </div>
    );
}
`,
				errors: [{ messageId: "tsxNestingTooDeep" }],
				options: [
					{
						enforceTargetLines: false,
						maxLines: 1000,
						maxStateHooks: 1000,
						maxTsxNesting: 2,
						targetLines: 1000,
					},
				],
			},
			{
				code: `
function Statey() {
    const [a, setA] = useState(0);
    const [b, setB] = useState(0);
    return <div />;
}
`,
				errors: [{ messageId: "tooManyStateHooks" }],
				options: [
					{
						enforceTargetLines: false,
						maxLines: 1000,
						maxStateHooks: 1,
						stateHooks: ["useState"],
						targetLines: 1000,
					},
				],
			},
			{
				code: `
function Propsy({ a, b, c }) {
    return <div />;
}
`,
				errors: [{ messageId: "tooManyProps" }],
				options: [
					{
						enforceTargetLines: false,
						maxDestructuredProps: 2,
						maxLines: 1000,
						targetLines: 1000,
					},
				],
			},
			{
				code: `
function Nullish() {
    const value = null;
    return <div>{value}</div>;
}
`,
				errors: [{ messageId: "nullLiteral" }],
				options: [
					{
						enforceTargetLines: false,
						maxLines: 1000,
						maxStateHooks: 1000,
						maxTsxNesting: 1000,
						targetLines: 1000,
					},
				],
			},
			{
				code: `
const MemberState = () => {
    const [a, setA] = React.useState(0);
    const [b, setB] = React.useState(0);
    return <div />;
};
`,
				errors: [{ messageId: "tooManyStateHooks" }],
				options: [
					{
						enforceTargetLines: false,
						maxDestructuredProps: 1000,
						maxLines: 1000,
						maxStateHooks: 1,
						maxTsxNesting: 1000,
						stateHooks: ["useState"],
						targetLines: 1000,
					},
				],
			},
			{
				code: `
const BadMemo = memo(() => {
    const [a, setA] = useState(0);
    const [b, setB] = useState(0);
    return <div />;
});
`,
				errors: [{ messageId: "tooManyStateHooks" }],
				options: [
					{
						enforceTargetLines: false,
						maxDestructuredProps: 1000,
						maxLines: 1000,
						maxStateHooks: 1,
						maxTsxNesting: 1000,
						stateHooks: ["useState"],
						targetLines: 1000,
					},
				],
			},
			{
				code: `
const ReactBad = React.memo(function ReactBad() {
    const value = null;
    return <div>{value}</div>;
});
`,
				errors: [{ messageId: "nullLiteral" }],
				options: [
					{
						enforceTargetLines: false,
						maxDestructuredProps: 1000,
						maxLines: 1000,
						maxStateHooks: 1000,
						maxTsxNesting: 1000,
						targetLines: 1000,
					},
				],
			},
			{
				code: `
export default memo(function DefaultBad() {
    const a = 1;
    const b = 2;
    const c = 3;
    return <div />;
});
`,
				errors: [{ messageId: "exceedsMaxLines" }],
				options: [{ enforceTargetLines: false, maxLines: 3, targetLines: 3 }],
			},
			{
				code: `
const Components = {
    BigProp: function () {
        const value = null;
        return <div>{value}</div>;
    },
};
`,
				errors: [{ messageId: "nullLiteral" }],
				options: [
					{
						enforceTargetLines: false,
						maxDestructuredProps: 1000,
						maxLines: 1000,
						maxStateHooks: 1000,
						maxTsxNesting: 1000,
						targetLines: 1000,
					},
				],
			},
			{
				code: `
class View {
    BigClassMethod() {
        const value = null;
        return <div>{value}</div>;
    }
}
`,
				errors: [{ messageId: "nullLiteral" }],
				options: [
					{
						enforceTargetLines: false,
						maxDestructuredProps: 1000,
						maxLines: 1000,
						maxStateHooks: 1000,
						maxTsxNesting: 1000,
						targetLines: 1000,
					},
				],
			},
			{
				code: `
let Assigned;
Assigned = memo(function Assigned() {
    const a = 1;
    const b = 2;
    const c = 3;
    return <div />;
});
`,
				errors: [{ messageId: "exceedsMaxLines" }],
				options: [{ enforceTargetLines: false, maxLines: 3, targetLines: 3 }],
			},
		],
		valid: [
			{
				code: `
function Small({ a, b }) {
    const [count, setCount] = useState(0);
    if (count > 0) setCount(count - 1);
    return <div><span>{a}{b}</span></div>;
}
`,
				documentation: { id: "pass", title: "Component within configured limits" },
			},
			{
				code: `
function PlainProps(props) {
    return <div>{props.label}</div>;
}
`,
			},
			// Export default HOC with named function expression (covers getComponentNameFromCallParent export default case)
			{
				code: `
export default memo(function DefaultMemo() {
    return <div />;
});
`,
			},
			// HOC call with non-function argument (covers CallExpression early-return)
			{
				code: `
function Wrapper() {
    const Component = () => <div />;
    memo(Component);
    return <div />;
}
`,
			},
			// Assignment pattern destructuring (covers countDestructuredProps assignment pattern)
			{
				code: `
function DefaultProps({ a, b } = {}) {
    return <div>{a}{b}</div>;
}
`,
			},
			{
				code: `
function RestProps({ a, ...rest }) {
    return <div>{a}{rest.label}</div>;
}
`,
			},
			{
				code: `
declare function DeclaredComponent(): JSX.Element;
`,
			},
			// Member-expression hook + computed hook access (covers getHookName member/undefined branches)
			{
				code: `
function Hooks() {
    React.useState(0);
    React["useState"](0);
    return <div />;
}
`,
			},
			// Non-React member call should not be treated as a React HOC (covers isReactComponentHOC fallback)
			{
				code: `
function NotReact() {
    obj.memo(() => <div />);
    return <div />;
}
`,
			},
			// Direct HOC call expression without assignment (covers getComponentNameFromCallParent undefined path)
			{
				code: `
memo(function DirectMemo() {
    return <div />;
});
`,
			},
			{
				code: `
function TypeNull() {
    type N = null;
    return <div />;
}
`,
			},
			{
				code: `
function Ignored() {
    const value = null;
    return <div>{value}</div>;
}
`,
				options: [
					{
						enforceTargetLines: false,
						ignoreComponents: ["Ignored"],
						maxDestructuredProps: 1000,
						maxLines: 1000,
						maxStateHooks: 1000,
						maxTsxNesting: 1000,
						targetLines: 1000,
					},
				],
			},
			{
				code: `
function helper() {
    const value = null;
    return value;
}
`,
			},
			{
				code: `
const helpers = {
    helper: function () {
        const value = null;
        return value;
    },
};
`,
			},
			{
				code: `
class View {
    helper() {
        const value = null;
        return value;
    }
}
`,
			},
		],
	});
});
