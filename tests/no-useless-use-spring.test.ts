import { describe } from "vitest";
import rule from "$oxc-rules/no-useless-use-spring";

import { ts } from "./rule-testers";

describe("no-useless-use-spring", () => {
	ts.run("no-useless-use-spring", rule, {
		invalid: [
			// Only `from` without `to` is still useless
			{
				code: `
const springs = useSpring({
  from: { x: 0 },
});
`,
				documentation: { id: "fail", title: "Spring with only initial value" },
				errors: [{ messageId: "uselessSpring" }],
			},
			// Only `to` without `from` is still useless
			{
				code: `
const springs = useSpring({
  to: { x: 1 },
});
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
import { config } from "./config";
import { UDim2 } from "./roblox";

const topDecorPositionSpring = useSpring(
  {
    config: config.default,
    position: UDim2.fromScale(0.31, 0.11),
  },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
import { config } from "./config";

const starSizeSpring = useSpring(
  {
    config: config.default,
    size: UDim2.fromScale(0.55, 0.45),
  },
  [],
).size;
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
import { config } from "./config";

const { japaneseTextPositionSpring, japaneseTextTransparencySpring } = useSpring(
  {
    config: config.default,
    japaneseTextPositionSpring: UDim2.fromScale(0.375, 0.95),
    japaneseTextTransparencySpring: 0.2,
    rotation: 25,
  },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const opacitySpring = useSpring(
  { opacity: 1 },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const spring = useSpring({ ["from"]: {}, to: {} }, []);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const opacitySpring = useSpring({ opacity: 1 });
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const ALWAYS = 1;

function Component() {
  const spring = useSpring({ opacity: 1 }, [ALWAYS]);
  return spring;
}
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const CONFIG = { opacity: 1 } as const;

function Component() {
  const spring = useSpring(CONFIG, []);
  return spring;
}
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const spring = useMotion({ opacity: 1 }, []);
`,
				errors: [{ messageId: "uselessSpring" }],
				options: [
					{
						springHooks: ["useMotion"],
					},
				],
			},
			{
				code: `
const spring = useSpring({ opacity: (1 as const) }, []);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
import { StaticCtor } from "./ctors";
const STATIC_OBJ = { value: 1 } as const;

const spring = useSpring(
  {
    unary: -1,
    binary: 1 + 2,
    logical: true && false,
    conditional: true ? 1 : 2,
    template: \`static\`,
    array: [1, 2, \`x\`],
    memberComputed: STATIC_OBJ?.["value"],
    call: StaticCtor.create(1),
    instance: new StaticCtor(0),
    sequence: (1, 2),
  },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
import * as Numbers from "./numbers";

const spring = useSpring({ value: Numbers["ONE"] }, []);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const colorSpring = useSpring(
  { color: Color3.fromRGB(255, 0, 0) },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const spring = animated.useSpring(
  { opacity: 1 },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const spring = useSpring(
  { sequence: new NumberSequence(0, 1) },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
			},
			{
				code: `
const spring = useSpring(
  { value: CustomFactory.make(1) },
  [],
);
`,
				errors: [{ messageId: "uselessSpring" }],
				options: [
					{
						staticGlobalFactories: ["CustomFactory"],
					},
				],
			},
		],
		valid: [
			// Mount animations with from/to are valid
			{
				code: `
const springs = useSpring({
  from: { x: 0 },
  to: { x: 1 },
});
`,
				documentation: { id: "pass", title: "Spring with mount animation" },
			},
			{
				code: `
const springs = useSpring({
  from: { x: 0 },
  to: { x: 1 },
}, []);
`,
			},
			{
				code: `
import { config } from "./config";

const springs = useSpring({
  config: config.default,
  from: { position: UDim2.fromScale(0.5, 0.41) },
  to: { position: UDim2.fromScale(0.5, 0.31) },
});
`,
			},
			{
				code: `
const MOUNT_ANIM = {
  from: { opacity: 0 },
  to: { opacity: 1 },
} as const;

const springs = useSpring(MOUNT_ANIM);
`,
			},
			{
				code: `
import { config } from "./config";
import { UDim2 } from "./roblox";

function Component({ x, y }) {
  const spring = useSpring(
    {
      config: config.default,
      position: UDim2.fromScale(x, y),
    },
    [x, y],
  );
  return spring;
}
`,
			},
			{
				code: `
function Component() {
  const [isOpen] = useState(false);
  const opacitySpring = useSpring({ opacity: isOpen ? 1 : 0 }, [isOpen]);
  return opacitySpring;
}
`,
			},
			{
				code: `
import { UDim2 } from "./roblox";

function Component({ x }) {
  const spring = useSpring({ position: UDim2.fromScale(0.3, 0.1) }, [x]);
  return spring;
}
`,
			},
			{
				code: `
import { config } from "./config";

function Component({ x }) {
  const spring = useSpring(
    {
      config: config.default,
      size: UDim2.fromScale(0.55, 0.45),
    },
    [x],
  );
  return spring;
}
`,
			},
			{
				code: `
function Component() {
  const options = getSpringOptions();
  const spring = useSpring({ opacity: 1 }, options);
  return spring;
}
`,
			},
			{
				code: `
const opacitySpring = useSpring(
  { opacity: 1 },
  [],
);
`,
				options: [
					{
						treatEmptyDepsAsViolation: false,
					},
				],
			},
			{
				code: `
const spring = useMotion({ opacity: 1 }, []);
`,
			},
			{
				code: `
const spring = useSpring({ opacity: MISSING }, []);
`,
			},
			{
				code: `
import configObj from "./configObj";

const spring = useSpring(configObj, []);
`,
			},
			{
				code: `
function Component(deps) {
  const spring = useSpring({ opacity: 1 }, [...deps]);
  return spring;
}
`,
			},
			{
				code: `
const NON_STATIC = () => {};
const spring = useSpring({ fn: NON_STATIC }, []);
`,
			},
			{
				code: `
const spring = useSpring({ created: new Date() }, []);
`,
			},
			{
				code: `
function Component({ x }) {
  const spring = animated.useSpring(
    { position: UDim2.fromScale(0.3, 0.1) },
    [x],
  );
  return spring;
}
`,
			},
			{
				code: `
const spring = useSpring(
  { value: CustomFactory.make(1) },
  [],
);
`,
			},
			{
				code: `
const spring = animated["useSpring"]({ opacity: 1 }, []);
`,
			},
			{
				code: `
const spring = useSpring(1, []);
`,
			},
			{
				code: `
declare const CONFIG: unknown;
const spring = useSpring(CONFIG, []);
`,
			},
			{
				code: `
const CONFIG = 1;
const spring = useSpring(CONFIG, []);
`,
			},
			{
				code: `
const spring = animated.useMotion({ opacity: 1 }, []);
`,
			},
			{
				code: `
const SPRING_ARGS = [{ opacity: 1 }, []] as const;
const spring = useSpring(...SPRING_ARGS);
`,
			},
			{
				code: `
import { CONFIG } from "./config";

const spring = useSpring(CONFIG, []);
`,
			},
		],
	});
});
