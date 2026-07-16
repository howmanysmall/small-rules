import { createRuleTester } from "./rule-harness/runner";

export { createRuleTester } from "./rule-harness/runner";

export type { RuleCaseDocumentation, RuleTestError } from "./rule-harness/types";

export const js = createRuleTester({ language: "js", sourceType: "module" });
export const jsx = createRuleTester({ language: "jsx", sourceType: "module" });
export const ts = createRuleTester({ language: "ts", sourceType: "module" });
export const tsx = createRuleTester({ language: "tsx", sourceType: "module" });
