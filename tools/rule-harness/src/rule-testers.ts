import { createRuleTester } from "./runner";

export const js = createRuleTester({ language: "js", sourceType: "module" });
export const jsx = createRuleTester({ language: "jsx", sourceType: "module" });
export const ts = createRuleTester({ language: "ts", sourceType: "module" });
export const tsx = createRuleTester({ language: "tsx", sourceType: "module" });
