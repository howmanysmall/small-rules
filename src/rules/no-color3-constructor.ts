import { isNamedGlobalCall, isNumericLiteral } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function mapComponentToRgbRange(value: number): number {
	return Math.round(value > 1 ? value : value * 255);
}

interface NoColor3ConstructorOptions {
	readonly reportUnknownComponents?: boolean;
}

type NumericComponentCollection = readonly [allZero: boolean, components: ReadonlyArray<number>];

function normalizeOptions(value: unknown): Required<NoColor3ConstructorOptions> {
	return {
		reportUnknownComponents:
			typeof value === "object" && value !== null && "reportUnknownComponents" in value
				? value.reportUnknownComponents === true
				: true,
	};
}

function collectNumericComponents(parameters: ReadonlyArray<ESTree.Node>): NumericComponentCollection | undefined {
	const components = new Array<number>();
	let size = 0;
	let allZero = true;

	for (const parameter of parameters) {
		if (!isNumericLiteral(parameter)) return undefined;

		const mapped = mapComponentToRgbRange(parameter.value);
		components[size++] = mapped;
		if (mapped !== 0) allZero = false;
	}

	return [allZero, components];
}

const noColor3Constructor = defineRule({
	create(context): Visitor {
		const options = normalizeOptions(context.options[0]);

		return {
			NewExpression(node): void {
				if (!isNamedGlobalCall(node, "Color3")) return;

				const parameters = node.arguments;
				if (parameters.length === 0) return;

				const collected = collectNumericComponents(parameters);
				if (!collected) {
					if (options.reportUnknownComponents) {
						context.report({
							messageId: parameters.length < 3 ? "useFromRGB" : "onlyZeroArgs",
							node,
						});
					}
					return;
				}

				if (parameters.length < 3) {
					// oxlint-disable-next-line prefer-destructuring -- wtf do you expect?
					const [red, green = 0] = collected[1];
					context.report({
						fix: (fixer) => fixer.replaceText(node, `Color3.fromRGB(${red}, ${green}, 0)`),
						messageId: "useFromRGB",
						node,
					});
					return;
				}

				if (!collected[0]) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, `Color3.fromRGB(${collected[1].join(", ")})`),
						messageId: "onlyZeroArgs",
						node,
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Ban new Color3(...) except new Color3() or new Color3(0, 0, 0). Use Color3.fromRGB() instead.",
		},
		fixable: "code",
		messages: {
			onlyZeroArgs:
				"Use Color3.fromRGB() instead of new Color3(). new Color3() uses floats [0-1] and performs worse than Color3.fromRGB() which uses [0-255]. Only 'new Color3()' or 'new Color3(0, 0, 0)' are allowed.",
			useFromRGB:
				"Use Color3.fromRGB() instead of new Color3(). new Color3() uses floats [0-1] and performs worse than Color3.fromRGB() which uses [0-255].",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					reportUnknownComponents: {
						default: true,
						description:
							"Report new Color3(...) calls when one or more components are not numeric literals.",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noColor3Constructor;
