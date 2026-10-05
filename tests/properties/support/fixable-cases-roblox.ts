import { fc } from "@fast-check/vitest";

import { defineFixableCase } from "./fixable-case";
import {
	assignableArbitrary,
	capitalize,
	expressionArbitrary,
	identifierArbitrary,
	integerLiteralArbitrary,
	jsxAttributesArbitrary,
	pascalIdentifierArbitrary,
	stringLiteralArbitrary,
	wordArbitrary,
} from "./syntax";

import type { FixableCase } from "./fixable-case";

const JECS_IMPORT = 'import { world } from "@rbxts/jecs";';

const noHasBeforeRemoveInJecs = defineFixableCase({
	language: "ts",
	render: ({ braced, component, entity }, id) => {
		const removal = `world${id}.remove(${entity}, ${component});`;
		const consequent = braced ? `{\n${removal}\n}` : removal;
		return {
			module: [JECS_IMPORT],
			statements: [`const world${id} = world();`, `if (world${id}.has(${entity}, ${component})) ${consequent}`],
		};
	},
	rule: "no-has-before-remove-in-jecs",
	trigger: fc.record({
		braced: fc.boolean(),
		component: pascalIdentifierArbitrary,
		entity: identifierArbitrary,
	}),
});

const queriedComponentArbitrary = fc.record({
	binding: fc.constantFrom("hole", "unused", "used"),
	component: pascalIdentifierArbitrary,
});

const membershipFilterArbitrary = fc.record({
	components: fc.array(pascalIdentifierArbitrary, { size: "xsmall" }),
	method: fc.constantFrom("with", "without"),
});

const preferMembershipFilterInJecs = defineFixableCase({
	language: "ts",
	render: ({ components, filter }, id) => {
		const bindings = components.map(({ binding, component }) =>
			binding === "hole" ? "" : `${component.toLowerCase()}${id}`,
		);
		const uses = [`entity${id}`];
		for (const { binding, component } of components) {
			if (binding === "used") uses.push(`${component.toLowerCase()}${id}`);
		}
		const query = `world${id}.query(${components.map(({ component }) => component).join(", ")})`;
		const filtered = filter === undefined ? query : `${query}.${filter.method}(${filter.components.join(", ")})`;
		return {
			module: [JECS_IMPORT],
			statements: [
				`const world${id} = world();`,
				`for (const [entity${id}, ${bindings.join(", ")}] of ${filtered}) {\nuse(${uses.join(", ")});\n}`,
			],
		};
	},
	rule: "prefer-membership-filter-in-jecs",
	trigger: fc.record({
		components: fc.uniqueArray(queriedComponentArbitrary, { minLength: 1, selector: ({ component }) => component }),
		filter: fc.option(membershipFilterArbitrary, { nil: undefined }),
	}),
});

const preferSingleWorldQueryInJecs = defineFixableCase({
	language: "ts",
	render: ({ components, entity, worldReference }) => ({
		statements: components.map(
			(component) => `const ${component.toLowerCase()} = ${worldReference}.get(${entity}, ${component});`,
		),
	}),
	rule: "prefer-single-world-query-in-jecs",
	trigger: fc.record({
		components: fc.uniqueArray(pascalIdentifierArbitrary, { minLength: 2 }),
		entity: identifierArbitrary,
		worldReference: fc.constantFrom("world", "this.world", "gameWorld"),
	}),
});

// A single numeric argument is a length, which only some environments fix.
const severalElementsArbitrary = fc.array(expressionArbitrary, { minLength: 2 });
const singleStringArbitrary = fc.tuple(stringLiteralArbitrary);

const noArrayConstructorElements = defineFixableCase({
	render: ({ elements, typeArgument }, id) => ({
		statements: [`const values${id} = new Array${typeArgument ? "<unknown>" : ""}(${elements.join(", ")});`],
	}),
	rule: "no-array-constructor-elements",
	trigger: fc.record({
		elements: fc.oneof(severalElementsArbitrary, singleStringArbitrary),
		typeArgument: fc.boolean(),
	}),
});

const noArrayConstructorIndexAssignment = defineFixableCase({
	language: "ts",
	render: ({ declaration, interleaved, values }, id) => ({
		statements: [
			`${declaration} values${id} = new Array<number>();`,
			...interleaved.map((value, index) => `const between${id}${index} = ${value};`),
			...values.map((value, index) => `values${id}[${index}] = ${value};`),
		],
	}),
	rule: "no-array-constructor-index-assignment",
	trigger: fc.record({
		declaration: fc.constantFrom("const", "let"),
		interleaved: fc.array(integerLiteralArbitrary, { size: "xsmall" }),
		values: fc.array(expressionArbitrary, { minLength: 1 }),
	}),
});

const noArraySizeAssignment = defineFixableCase({
	language: "ts",
	options: [{ allowAutofix: true }],
	render: ({ array, value }) => ({ statements: [`${array}[${array}.size()] = ${value};`] }),
	rule: "no-array-size-assignment",
	trigger: fc.record({ array: assignableArbitrary, value: expressionArbitrary }),
});

const colorChannelArbitrary = fc.constantFrom("0", "0.25", "0.5", "1", "128", "255");

const noColor3Constructor = defineFixableCase({
	language: "ts",
	render: (channels, id) => ({ statements: [`const color${id} = new Color3(${channels.join(", ")});`] }),
	rule: "no-color3-constructor",
	trigger: fc.array(colorChannelArbitrary, { maxLength: 3, minLength: 1 }),
});

const defaultPropertyArbitrary = fc.constantFrom(
	["frame", "BackgroundTransparency={0}"],
	["textlabel", 'Text=""'],
	["uicorner", "CornerRadius={new UDim(0, 0)}"],
	["uiaspectratioconstraint", "AspectRatio={1}"],
);

const noUselessDefault = defineFixableCase({
	render: ({ defaults, extra }, id) => {
		const [tag, attribute] = defaults;
		return { statements: [`const view${id} = <${tag} ${attribute}${extra} />;`] };
	},
	rule: "no-useless-default",
	trigger: fc.record({
		defaults: defaultPropertyArbitrary,
		extra: jsxAttributesArbitrary,
	}),
});

const preferIdiv = defineFixableCase({
	language: "ts",
	render: ({ dividend, divisor }, id) => ({
		statements: [`const quotient${id} = math.floor(${dividend} / ${divisor});`],
	}),
	rule: "prefer-idiv",
	trigger: fc.record({ dividend: expressionArbitrary, divisor: expressionArbitrary }),
});

const preferMathMinMax = defineFixableCase({
	language: "ts",
	render: ({ limit, operator, swapped, value }, id) => {
		const [consequent, alternate] = swapped ? [value, limit] : [limit, value];
		return { statements: [`const clamped${id} = ${value} ${operator} ${limit} ? ${consequent} : ${alternate};`] };
	},
	rule: "prefer-math-min-max",
	trigger: fc.record({
		limit: integerLiteralArbitrary,
		operator: fc.constantFrom("<", "<=", ">", ">="),
		swapped: fc.boolean(),
		value: identifierArbitrary,
	}),
});

const preferModdingInspect = defineFixableCase({
	language: "ts",
	render: ({ name, exported, keys, recordType }, id) => {
		const entries = keys.map((key) => `${key}: true`).join(", ");
		const declaration = `const ${name}${id}: ${recordType}<${capitalize(name)}Kind, true> = { ${entries} };`;
		return { module: [exported ? `export ${declaration}` : declaration] };
	},
	rule: "prefer-modding-inspect",
	trigger: fc.record({
		name: identifierArbitrary,
		exported: fc.boolean(),
		keys: fc.uniqueArray(wordArbitrary, { minLength: 1 }),
		recordType: fc.constantFrom("ReadonlyRecord", "Record"),
	}),
});

const preferNativeCollectionCopy = defineFixableCase({
	language: "ts",
	render: ({ key, braced, collection, value }, id) => {
		const loop =
			collection === "Map"
				? [`for (const [${key}, ${value}] of source${id})`, `copy${id}.set(${key}, ${value});`]
				: [`for (const ${value} of source${id})`, `copy${id}.add(${value});`];
		const [head, body] = loop;
		return {
			statements: [
				`const source${id} = new ${collection}(entries${id});`,
				`const copy${id} = new ${collection}();`,
				braced ? `${head} {\n${body}\n}` : `${head} ${body}`,
			],
		};
	},
	rule: "prefer-native-collection-copy",
	trigger: fc.record({
		key: wordArbitrary,
		braced: fc.boolean(),
		collection: fc.constantFrom("Map", "Set"),
		// The suffix keeps it distinct from the key.
		value: wordArbitrary.map((word) => `${word}Value`),
	}),
});

const colorSequenceArbitrary = fc
	.tuple(integerLiteralArbitrary, integerLiteralArbitrary, integerLiteralArbitrary)
	.map(([red, green, blue]) => ({
		sequenceClass: "ColorSequence",
		value: `Color3.fromRGB(${red}, ${green}, ${blue})`,
	}));

const numberSequenceArbitrary = integerLiteralArbitrary.map((value) => ({ sequenceClass: "NumberSequence", value }));

const preferSequenceOverloads = defineFixableCase({
	language: "ts",
	render: ({ sequenceClass, value }, id) => ({
		statements: [`const sequence${id} = new ${sequenceClass}(${value}, ${value});`],
	}),
	rule: "prefer-sequence-overloads",
	trigger: fc.oneof(colorSequenceArbitrary, numberSequenceArbitrary),
});

const preferUdim2Shorthand = defineFixableCase({
	language: "ts",
	render: ({ kind, x, y }, id) => ({
		statements: [
			kind === "scale"
				? `const size${id} = new UDim2(${x}, 0, ${y}, 0);`
				: `const size${id} = new UDim2(0, ${x}, 0, ${y});`,
		],
	}),
	rule: "prefer-udim2-shorthand",
	trigger: fc.record({
		kind: fc.constantFrom("offset", "scale"),
		x: integerLiteralArbitrary,
		y: integerLiteralArbitrary,
	}),
});

export const ROBLOX_FIXABLE_CASES: ReadonlyArray<FixableCase> = [
	noArrayConstructorElements,
	noArrayConstructorIndexAssignment,
	noArraySizeAssignment,
	noColor3Constructor,
	noHasBeforeRemoveInJecs,
	noUselessDefault,
	preferIdiv,
	preferMathMinMax,
	preferMembershipFilterInJecs,
	preferModdingInspect,
	preferNativeCollectionCopy,
	preferSequenceOverloads,
	preferSingleWorldQueryInJecs,
	preferUdim2Shorthand,
];
