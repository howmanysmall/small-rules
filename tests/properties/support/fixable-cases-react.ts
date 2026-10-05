import nodePath from "node:path";
import { fc } from "@fast-check/vitest";

import { defineFixableCase } from "./fixable-case";
import {
	blockArbitrary,
	capitalize,
	expressionArbitrary,
	identifierArbitrary,
	jsxElementArbitrary,
	pascalIdentifierArbitrary,
	stringLiteralArbitrary,
	wordArbitrary,
} from "./syntax";

import type { FixableCase } from "./fixable-case";

/**
 * Rules that look for a local component resolve it from the project on disk,
 * so these files sit inside the fixture projects their own tests use.
 *
 * @param rule - The fixture directory named after the rule.
 * @param project - The fixture project inside it.
 * @returns A screen file path inside the fixture project.
 */
function getFixtureScreen(rule: string, project: string): string {
	return nodePath.join(import.meta.dirname, "..", "..", "fixtures", rule, project, "src", "screens", "generated.tsx");
}

function wrapInProviders(child: string, providers: ReadonlyArray<readonly [string, string]>): string {
	let element = child;
	for (const [name, value] of providers.toReversed()) {
		element = `<${name}Context.Provider value={${value}}>${element}</${name}Context.Provider>`;
	}
	return element;
}

const providerArbitrary = fc.tuple(pascalIdentifierArbitrary, expressionArbitrary);

const preferContextStack = defineFixableCase({
	filename: getFixtureScreen("prefer-context-stack", "with-context-stack"),
	render: ({ child, providers }, id) => ({
		module: ['import ContextStack from "../providers/context-stack";'],
		statements: [`const providers${id} = ${wrapInProviders(child, providers)};`],
	}),
	rule: "prefer-context-stack",
	trigger: fc.record({
		child: jsxElementArbitrary,
		providers: fc.uniqueArray(providerArbitrary, { minLength: 2, selector: ([name]) => name }),
	}),
});

const preferLocalPortalComponent = defineFixableCase({
	filename: getFixtureScreen("prefer-local-portal-component", "with-portal"),
	render: ({ content, target }, id) => ({
		module: ['import Portal from "../components/portal";', 'import { createPortal } from "@rbxts/react-roblox";'],
		statements: [`const portal${id} = createPortal(${content}, ${target});`],
	}),
	rule: "prefer-local-portal-component",
	trigger: fc.record({
		content: fc.oneof(jsxElementArbitrary, identifierArbitrary),
		target: identifierArbitrary,
	}),
});

const paddingSidesArbitrary = fc.shuffledSubarray(["PaddingBottom", "PaddingLeft", "PaddingRight", "PaddingTop"], {
	maxLength: 4,
	minLength: 4,
});

const preferPaddingComponents = defineFixableCase({
	filename: getFixtureScreen("prefer-padding-components", "with-components"),
	render: ({ horizontal, sides, vertical }, id) => {
		const attributes = sides.map((side) => {
			const value = side === "PaddingBottom" || side === "PaddingTop" ? vertical : horizontal;
			return ` ${side}={${value}}`;
		});
		return {
			module: [
				'import { EqualPadding } from "../ui/equal-padding";',
				'import { DirectionalPadding } from "../ui/directional-padding";',
			],
			statements: [`const padding${id} = <uipadding${attributes.join("")} />;`],
		};
	},
	rule: "prefer-padding-components",
	// Equal padding when `horizontal` is absent, directional padding otherwise.
	trigger: fc
		.record({
			horizontal: fc.option(identifierArbitrary, { nil: undefined }),
			sides: paddingSidesArbitrary,
			vertical: identifierArbitrary,
		})
		.map(({ horizontal, sides, vertical }) => ({ horizontal: horizontal ?? vertical, sides, vertical })),
});

const conditionArbitrary = fc.oneof(
	identifierArbitrary.map((name) => ({ negated: `!${name}`, positive: name })),
	fc.tuple(identifierArbitrary, stringLiteralArbitrary, fc.boolean()).map(([name, literal, swapped]) => ({
		negated: swapped ? `${literal} !== ${name}` : `${name} !== ${literal}`,
		positive: `${name} === ${literal}`,
	})),
);

const preferTernaryConditionalRendering = defineFixableCase({
	render: ({ alternate, condition, consequent }, id) => ({
		statements: [
			`const view${id} = <>{${condition.positive} && ${consequent}}{${condition.negated} && ${alternate}}</>;`,
		],
	}),
	rule: "prefer-ternary-conditional-rendering",
	trigger: fc.record({
		alternate: jsxElementArbitrary,
		condition: conditionArbitrary,
		consequent: jsxElementArbitrary,
	}),
});

const requireNamedEffectFunctions = defineFixableCase({
	options: [{ environment: "standard", inlineFunctionDeclarations: true }],
	render: ({ name, body, dependencies, hook }, id) => ({
		module: [`import { ${hook} } from "react";`],
		statements: [
			`function ${name}${id}(): void {\n${body}\n}`,
			`${hook}(${name}${id}, [${dependencies.join(", ")}]);`,
		],
	}),
	rule: "require-named-effect-functions",
	trigger: fc.record({
		name: identifierArbitrary,
		body: blockArbitrary,
		dependencies: fc.array(identifierArbitrary, { size: "xsmall" }),
		hook: fc.constantFrom("useEffect", "useLayoutEffect"),
	}),
});

interface State {
	readonly name: string;
	readonly inDependencies: boolean;
	readonly read: boolean;
}

function renderComponent(component: string, hook: string, states: ReadonlyArray<State>): ReadonlyArray<string> {
	const declarations = new Array<string>();
	const reads = new Array<string>();
	const dependencies = new Array<string>();
	for (const { name, inDependencies, read } of states) {
		declarations.push(`const [${name}, set${capitalize(name)}] = useState(${JSON.stringify(name)});`);
		if (read) reads.push(name);
		if (inDependencies) dependencies.push(name);
	}

	return [
		`function ${component}() {`,
		...declarations,
		`${hook}(() => {\nprint(${reads.join(", ")});\n}, [${dependencies.join(", ")}]);`,
		"return <frame />;",
		"}",
	];
}

const stateArbitrary = fc.record({ name: wordArbitrary, inDependencies: fc.boolean(), read: fc.boolean() });

const useExhaustiveDependencies = defineFixableCase({
	render: ({ component, hook, states }, id) => ({
		module: [`import { ${hook}, useState } from "react";`],
		statements: renderComponent(`${component}${id}`, hook, states),
	}),
	rule: "use-exhaustive-dependencies",
	trigger: fc.record({
		component: pascalIdentifierArbitrary,
		hook: fc.constantFrom("useCallback", "useEffect", "useLayoutEffect", "useMemo"),
		states: fc.uniqueArray(stateArbitrary, { minLength: 1, selector: ({ name }) => name }),
	}),
});

export const REACT_FIXABLE_CASES: ReadonlyArray<FixableCase> = [
	preferContextStack,
	preferLocalPortalComponent,
	preferPaddingComponents,
	preferTernaryConditionalRendering,
	requireNamedEffectFunctions,
	useExhaustiveDependencies,
];
