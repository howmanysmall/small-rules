import { describe } from "vitest";
import rule from "$oxc-rules/require-react-component-keys";
import parser from "@typescript-eslint/parser";

import { tsx } from "./rule-testers";

describe("require-react-component-keys", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	// And this test file intentionally passes the rule as-is for runtime validation.
	tsx.run("require-react-component-keys", rule, {
		invalid: [
			// Elements in fragment
			{
				code: `
function Bad1() {
    return (
        <>
            <div />
            <span />
        </>
    );
}
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Single element in fragment
			{
				code: `
function Bad2() {
    return (
        <>
            <div />
        </>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Nested elements
			{
				code: `
function Bad3() {
    return (
        <div>
            <span />
            <p />
        </div>
    );
}
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Nested fragments
			{
				code: `
function Bad4() {
    return (
        <div>
            <>
                <span />
            </>
        </div>
    );
}
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Root component with key
			{
				code: `
function Bad5() {
    return <div key="bad" />;
}
`,
				errors: [{ messageId: "rootComponentWithKey" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Arrow function root component with key
			{
				code: `
const Bad6 = () => <span key="bad" />;
`,
				errors: [{ messageId: "rootComponentWithKey" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Map callback missing key
			{
				code: `
function Bad7(items) {
    return items.map((item) => <div />);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Dynamic callee callback missing key
			{
				code: `
function DynamicMapped(items, getMapper) {
    return getMapper()((item) => <div />);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Computed member callback missing key
			{
				code: `
function ComputedMapped(items) {
    return items["map"]((item) => <div />);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Map callback with block body missing key
			{
				code: `
function Bad7Block(items) {
    return items.map((item) => {
        const value = item.value;
        if (value <= 0) return;
        return <div>{value}</div>;
    });
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Map with spread operator missing key
			{
				code: `
function HealthBar() {
    const enemies = [];
    return (
        <screengui>
            {...enemies.map((entity) => {
                const health = { current: 10 };
                if (health.current <= 0) return;

                return (
                    <billboardgui>
                        <frame key="health" />
                    </billboardgui>
                );
            })}
        </screengui>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Named callback passed to map without keys
			{
				code: `
const renderEnemy = (enemy) => <billboardgui />;

function EnemyList(enemies) {
    return enemies.map(renderEnemy);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Named callback reused by iteration and memoization without keys
			{
				code: `
const renderEnemy = (enemy) => <billboardgui />;

function EnemyList(enemies) {
    enemies.map(renderEnemy);
    return useMemo(renderEnemy, [enemies]);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array.from named fragment callback reused by memoization
			{
				code: `
const renderEnemy = (enemy) => (
    <>
        <billboardgui />
    </>
);

function EnemyList(enemies) {
    Array.from(enemies, renderEnemy);
    return useMemo(renderEnemy, [enemies]);
}
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array.from named fragment callback without key
			{
				code: `
const renderEnemy = (enemy) => (
    <>
        <billboardgui key={enemy.id} />
    </>
);

function EnemyList(enemies) {
    return Array.from(enemies, renderEnemy);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array.from without key in mapping callback
			{
				code: `
function FromList(iterable) {
    return Array.from(iterable, (item) => <frame />);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array.prototype.map.call without key
			{
				code: `
function CallMapped(items) {
    return Array.prototype.map.call(items, (item) => <span />);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array.prototype.map.call named fragment callback without key
			{
				code: `
const renderEnemy = (enemy) => (
    <>
        <billboardgui key={enemy.id} />
    </>
);

function EnemyList(enemies) {
    return Array.prototype.map.call(enemies, renderEnemy);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Spread inline callback without key
			{
				code: `
function SpreadMapped(items) {
    return items.map(...((item) => <span />));
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// UseCallback missing key
			{
				code: `
function Bad10() {
    const renderLayout = useCallback(() => {
        return <div />;
    }, []);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// UseMemo missing key
			{
				code: `
function Bad11() {
    const element = useMemo(() => <span />, []);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Expression container map missing key
			{
				code: `
function Bad8(items) {
    return (
        <div>
            {items.map((item) => <span />)}
        </div>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array literal with single element without key
			{
				code: `
const elements = [<div />];
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array literal without keys
			{
				code: `
const elements = [<div />, <span />];
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Expression container siblings without key
			{
				code: `
function Bad9() {
    return (
        <div>
            {<span />}
            <p />
        </div>
    );
}
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// ForwardRef children still need keys
			{
				code: `
const Component = React.forwardRef((props, ref) => (
    <div>
        <span />
        <p />
    </div>
));
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Memo children still need keys
			{
				code: `
const Component = React.memo(() => (
    <Wrapper>
        <Child />
    </Wrapper>
));
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// ForwardRef root element should not have key
			{
				code: `
const Component = React.forwardRef((props, ref) => (
    <div key="bad" ref={ref} />
));
`,
				errors: [{ messageId: "rootComponentWithKey" }],
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Conditional element with siblings - needs key (user's original issue)
			{
				code: `
function Page({ navigation, title, children }) {
    return (
        <frame>
            <VerticalList key="vertical-list" />
            <Label key="page-label" />
            <NavigationPanel key="navigation-panel" />
            {navigation && <Label key="back-button" />}
            {children && <frame>{children}</frame>}
        </frame>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Multiple conditional siblings without keys
			{
				code: `
function MultipleConditionals({ showA, showB }) {
    return (
        <div>
            <Header key="header" />
            {showA && <ComponentA />}
            {showB && <ComponentB />}
        </div>
    );
}
`,
				errors: 2,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Logical expression as only child - needs key
			{
				code: `
function OnlyChild({ show }) {
    return (
        <div>
            {show && <span>Visible</span>}
        </div>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Logical expression (user's case) - needs key
			{
				code: `
function Fade({ aspectRatio }) {
    return (
        <frame>
            {aspectRatio !== undefined && <uiaspectratioconstraint AspectRatio={aspectRatio} />}
        </frame>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Map callback with logical fragment still needs key
			{
				code: `
function BadLogicalFragment(items) {
    return items.map((item) => item.show && (
        <>
            <span key="first" />
            <span key="second" />
        </>
    ));
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// JSX element passed via holder children prop needs key
			{
				code: `
function BadHolderChildren() {
    return <Frame holderChildren={<Child />} />;
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Parenthesized JSX child is still not a ternary child
			{
				code: `
function WrappedChild() {
    return (
        <div>
            {(<span />)}
        </div>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Type-asserted JSX child is still not a ternary child
			{
				code: `
function AssertedChild() {
    return (
        <div>
            {(<span /> as React.ReactNode)}
        </div>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Parenthesized fragment child still needs a key context
			{
				code: `
function WrappedFragmentChild() {
    return (
        <div>
            {(
                <>
                    <span key="first" />
                </>
            )}
        </div>
    );
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Spread arguments before an inline callback still leave the callback JSX needing a key
			{
				code: `
function CallWithSpread(items, render) {
    render(...items, (item) => <span />);
}
`,
				errors: 1,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
		],
		valid: [
			// Top-level return
			{
				code: `
function Good1() {
    return <div />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Arrow function top-level return
			{
				code: `
const Good2 = () => <span />;
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Arrow function with block body top-level return
			{
				code: `
const Good2Block = () => {
    return <div />;
};
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Proper keys
			{
				code: `
function Good3() {
    return (
        <>
            <div key="div1" />
            <span key="span1" />
        </>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Nested with keys
			{
				code: `
function Good4() {
    return (
        <div>
            <span key="span1" />
            <p key="p1" />
        </div>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// ReactTree.mount doesn't require key
			{
				code: `
const screenGui = screenGuiProvider.Get("ACTION_BAR");
ReactTree.mount(<ActionBarApp />, screenGui, "action-bar");
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Custom ignored call expression
			{
				code: `
Portal.render(<CustomComponent />);
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ ignoreCallExpressions: ["Portal.render"] }],
			},
			// CreateReactStory with function argument (default ignore)
			{
				code: `
import { CreateReactStory } from "@rbxts/ui-labs";
export = CreateReactStory(
    {
        controls: { maxValue: 100, value: 50 },
        summary: "Bar component demo.",
    },
    ({ controls }) => (
        <frame BackgroundTransparency={1}>
            <Bar {...controls} key="bar" />
        </frame>
    ),
);
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Allow root keys when configured
			{
				code: `
function Component() {
    return <div key="allowed" />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
				options: [{ allowRootKeys: true }],
			},
			// Map callback with keyed element
			{
				code: `
function Good5(items) {
    return items.map((item) => <span key={item.id} />);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Map callback with block body and keyed element
			{
				code: `
function Good5Block(items) {
    return items.map((item) => {
        const value = item.value;
        if (value <= 0) return;
        return <div key={item.id}>{value}</div>;
    });
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Map with spread operator and keyed element (user's scenario)
			{
				code: `
function HealthBar() {
    const enemies = [];
    return (
        <screengui>
            {...enemies.map((entity) => {
                const health = { current: 10 };
                if (health.current <= 0) return;

                return (
                    <billboardgui key={entity}>
                        <frame key="health" />
                    </billboardgui>
                );
            })}
        </screengui>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Named callback passed to map with keyed element
			{
				code: `
const renderEnemy = (enemy) => <billboardgui key={enemy} />;

function EnemyList(enemies) {
    return enemies.map(renderEnemy);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Function-valued object property return is not an iteration callback
			{
				code: `
const renderers = {
    renderEnemy: (enemy) => <billboardgui />,
};
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Direct callback invocation is not an iteration callback
			{
				code: `
const renderEnemy = (enemy) => <billboardgui />;

function EnemyList(enemy) {
    return renderEnemy(enemy);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array.from callback with keyed element
			{
				code: `
function FromList(iterable) {
    return Array.from(iterable, (item) => <frame key={item} />);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Callback assigned to an existing binding is not treated as a declared iterator callback
			{
				code: `
let renderEnemy;
renderEnemy = (enemy) => <billboardgui />;

function EnemyList(enemy) {
    return renderEnemy(enemy);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Array.prototype.map.call with keyed element
			{
				code: `
function CallMapped(items) {
    return Array.prototype.map.call(items, (item) => <span key={item} />);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Map callback wrapped in a type assertion with keyed element
			{
				code: `
function HealthBarWithAssertion() {
    const enemies = [];
    return (
        <screengui>
            {...enemies.map(((entity) => {
                return (
                    <billboardgui key={tostring(entity)}>
                        <frame key="health" />
                    </billboardgui>
                );
            }) as ((entity: unknown) => unknown))}
        </screengui>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// UseCallback with keyed elements
			{
				code: `
function Component() {
    const renderLayout = useCallback(() => {
        return <div key="layout" />;
    }, []);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// UseMemo with keyed elements
			{
				code: `
function Component() {
    const element = useMemo(() => <span key="memoized" />, []);
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// React.useMemo root shorthand fragment cannot be keyed
			{
				code: `
function Component() {
    const decorations = React.useMemo(
        () => (
            <>
                <Frame key="shadow" />
                <Halftones key="halftones" />
            </>
        ),
        [],
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Expression container sibling with keys
			{
				code: `
function Good6() {
    return (
        <div>
            {<span key="first" />}
            <p key="second" />
        </div>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Ternary conditional return (both branches are root)
			{
				code: `
function Good7({ condition }) {
    return condition ? <div /> : <span />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Logical expression return
			{
				code: `
function Good8({ show }) {
    return show && <Component />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Logical expression JSX child with fragment
			{
				code: `
function GoodLogicalFragment({ show }) {
    return (
        <div>
            {show && (
                <>
                    <span key="first" />
                    <span key="second" />
                </>
            )}
        </div>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// JSX fragment as prop value
			{
				code: `
function Good9() {
    return <Suspense fallback={<></>}><Content key="content" /></Suspense>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// JSX element as prop value
			{
				code: `
function Good10() {
    return <ErrorBoundary fallback={<div>Error</div>}><App key="app" /></ErrorBoundary>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// JSX element passed via holder children prop with key
			{
				code: `
function GoodHolderChildren() {
    return <Frame holderChildren={<Child key="child" />} />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Namespaced JSX attributes are still prop values
			{
				code: `
function GoodNamespacedAttribute() {
    return <Frame rbxts:child={<Child />}><Content key="content" /></Frame>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// JSX assigned through a type assertion
			{
				code: `
const cached = (<Child /> as React.ReactNode);
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// JSX assigned after declaration
			{
				code: `
let cached;
cached = <Child />;
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Parenthesized keyed JSX child
			{
				code: `
function GoodWrappedChild() {
    return (
        <div>
            {(<span key="child" />)}
        </div>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Type-asserted keyed JSX child
			{
				code: `
function GoodAssertedChild() {
    return (
        <div>
            {(<span key="child" /> as React.ReactNode)}
        </div>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Ternary with fragment in prop
			{
				code: `
function Good11({ placeholder }) {
    return <Suspense fallback={placeholder ?? <></>}><Content key="content" /></Suspense>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Nested ternary return
			{
				code: `
function Good12({ a, b }) {
    return a ? <div /> : b ? <span /> : <p />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Ternary JSX children are alternative single-child render paths
			{
				code: `
function GoodTernaryChild({ show }) {
    return <Frame>{show ? <Primary /> : <Fallback />}</Frame>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Ternary JSX children are also allowed inside shorthand fragments
			{
				code: `
function GoodTernaryChildInFragment({ show }) {
    return <>{show ? <Primary /> : <Fallback />}</>;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Type-asserted logical JSX children still need keys when rendered
			{
				code: `
function GoodAssertedLogicalChild({ show }) {
    return (
        <Frame>
            {(show && <Primary key="primary" />) as React.ReactNode}
        </Frame>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Logical JSX children may wrap the rendered element before the logical parent
			{
				code: `
function GoodWrappedLogicalOperand({ show }) {
    return (
        <Frame>
            {show && (<Primary key="primary" /> as React.ReactNode)}
        </Frame>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Logical fragment children are allowed inside shorthand fragments too
			{
				code: `
function GoodLogicalFragmentInFragment({ show }) {
    return (
        <>
            {show && (
                <>
                    <span key="first" />
                </>
            )}
        </>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// React.forwardRef - root return doesn't need key
			{
				code: `
const Component = React.forwardRef((props, ref) => {
    return <div ref={ref} />;
});
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// ForwardRef without React namespace
			{
				code: `
const Component = forwardRef((props, ref) => <span ref={ref} />);
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// React.memo - root return doesn't need key
			{
				code: `
const Component = React.memo(() => {
    return <div />;
});
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Memo without React namespace
			{
				code: `
const Component = memo(() => <span />);
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// ForwardRef with wrapper and children
			{
				code: `
const Component = React.forwardRef((props, ref) => (
    <ErrorBoundary>
        <div key="content" ref={ref} />
    </ErrorBoundary>
));
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Memo with wrapper and children
			{
				code: `
const Component = React.memo(() => (
    <Wrapper>
        <Child key="child" />
    </Wrapper>
));
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// HOC pattern with forwardRef (user's case)
			{
				code: `
function withErrorBoundary(Component) {
    return React.forwardRef((props, ref) => (
        <ErrorBoundary>
            <Component {...props} key="component" ref={ref} />
        </ErrorBoundary>
    ));
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Component registration with manager - top-level returns should not need keys
			{
				code: `
interface DialogProperties {
    readonly onClose: () => void;
    readonly title: string;
}

function SimpleDialog({ onClose, title }: DialogProperties): React.ReactNode {
    return (
        <frame
            AnchorPoint={center}
            BackgroundColor3={Color3.fromRGB(51, 51, 77)}
            BorderSizePixel={0}
            Position={centerScale}
            Size={UDim2.fromOffset(300, 150)}
        >
            <textlabel
                key="title"
                BackgroundTransparency={1}
                Size={UDim2.fromScale(1, 0.5)}
                Text={title}
                TextColor3={Color3.fromRGB(255, 255, 255)}
                TextSize={18}
            />
            <textbutton
                key="close-button"
                BackgroundColor3={Color3.fromRGB(77, 77, 77)}
                Event={{ Activated: onClose }}
                Position={new UDim2(0, 10, 1, -50)}
                Size={new UDim2(1, -20, 0, 40)}
                Text="Close"
                TextColor3={Color3.fromRGB(255, 255, 255)}
            />
        </frame>
    );
}

const manager = useWindowManager();
const dialog = manager.registerWindow("BasicDialog", SimpleDialog, {
    closeOnBackdrop: true,
    modal: true,
});
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Return inside if block should be recognized as root return
			{
				code: `
function ItemImage({ imageType }) {
    if (imageType === "button") {
        return <Button />;
    }
    return <ImageLabel />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Return inside else block
			{
				code: `
function Component({ condition }) {
    if (condition) {
        return <div />;
    } else {
        return <span />;
    }
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Nested if statements
			{
				code: `
function Component({ a, b }) {
    if (a) {
        if (b) {
            return <div />;
        }
        return <span />;
    }
    return <p />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Return inside switch case
			{
				code: `
function Component({ type }) {
    switch (type) {
        case "a":
            return <div />;
        case "b":
            return <span />;
        default:
            return <p />;
    }
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Return inside try block
			{
				code: `
function Component() {
    try {
        return <div />;
    } catch {
        return <ErrorDisplay />;
    }
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Return inside for loop
			{
				code: `
function Component({ items }) {
    for (const item of items) {
        if (item.isMatch) {
            return <MatchedItem />;
        }
    }
    return <NoMatch />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Early return pattern
			{
				code: `
function Component({ error, data }) {
    if (error) {
        return <ErrorDisplay />;
    }
    if (!data) {
        return <Loading />;
    }
    return <DataDisplay data={data} />;
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Fragments inside ternary as JSX child (mutually exclusive alternatives)
			{
				code: `
function Frame({ hasGlow, children }) {
    return (
        <frame>
            {hasGlow ? (
                <>
                    <frame key="inner" />
                    <Glow key="glow" />
                </>
            ) : (
                <>
                    {children}
                </>
            )}
        </frame>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Elements inside ternary as JSX child
			{
				code: `
function Component({ condition }) {
    return (
        <div>
            {condition ? <ComponentA /> : <ComponentB />}
        </div>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
			// Exact frame.tsx pattern with spreads and extraChildren
			{
				code: `
function Frame({ hasGlow, effectiveProperties, extraChildren, visualElements, children }) {
    return (
        <frame
            {...effectiveProperties.nativeProperties}
            BackgroundColor3={effectiveProperties.nativeProperties?.BackgroundColor3}
            BackgroundTransparency={hasGlow ? 1 : effectiveProperties.nativeProperties?.BackgroundTransparency}
        >
            {extraChildren}
            {hasGlow ? (
                <>
                    <frame key="inner" />
                    <Glow key="glow" />
                </>
            ) : (
                <>
                    {visualElements}
                    {children}
                </>
            )}
        </frame>
    );
}
`,
				languageOptions: {
					parser,
					parserOptions: {
						ecmaFeatures: { jsx: true },
					},
				},
			},
		],
	});
});
