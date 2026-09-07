import { describe, expect, it } from "vitest";

import { compactDefaultProperties } from "../../scripts/utilities/compact-default-properties";

const canonical = {
	classes: {
		Frame: {
			BackgroundColor3: { type: "Color3", value: [0.5, 0.5, 0.5] },
			Visible: { type: "bool", value: true },
		},
		Part: {
			Anchored: { type: "bool", value: false },
			Color: { type: "Color3", value: [0.5, 0.5, 0.5] },
			Material: { enumType: "Material", type: "Enum", value: "Plastic" },
		},
	},
};

describe("compactDefaultProperties", () => {
	it("sorts properties and deduplicates shared encoded values", () => {
		expect.assertions(1);

		expect(compactDefaultProperties(canonical)).toStrictEqual({
			classes: {
				Frame: [1, 3, 4, 2],
				Part: [0, 1, 2, 3, 3, 0],
			},
			properties: ["Anchored", "BackgroundColor3", "Color", "Material", "Visible"],
			values: [
				[0, "Material", "Plastic"],
				[1, false],
				[1, true],
				[3, [0.5, 0.5, 0.5]],
			],
			version: 1,
		});
	});

	it("passes infinite components through untouched", () => {
		expect.assertions(1);

		expect(
			compactDefaultProperties({
				classes: {
					Part: {
						Distance: { type: "number", value: "inf" },
						Size: { type: "Vector2", value: ["inf", "-inf"] },
					},
				},
			}),
		).toStrictEqual({
			classes: { Part: [0, 0, 1, 1] },
			properties: ["Distance", "Size"],
			values: [
				[4, "inf"],
				[9, ["inf", "-inf"]],
			],
			version: 1,
		});
	});

	it("compacts an empty class map", () => {
		expect.assertions(1);

		expect(compactDefaultProperties({ classes: {} })).toStrictEqual({
			classes: {},
			properties: [],
			values: [],
			version: 1,
		});
	});

	it("rejects unknown canonical value types", () => {
		expect.assertions(1);

		expect(() =>
			compactDefaultProperties({
				classes: { Part: { Size: { type: "Vector4", value: [1, 2, 3, 4] } } },
			}),
		).toThrow(TypeError);
	});

	it("rejects enum values without an enum type", () => {
		expect.assertions(1);

		expect(() =>
			compactDefaultProperties({
				classes: { Part: { Material: { type: "Enum", value: "Plastic" } } },
			}),
		).toThrow(TypeError);
	});

	it("rejects values that fail canonical validation", () => {
		expect.assertions(2);

		expect(() => compactDefaultProperties({ classes: { Part: { Anchored: { type: "bool" } } } })).toThrow(
			TypeError,
		);
		expect(() => compactDefaultProperties({ version: 1 })).toThrow(TypeError);
	});
});
