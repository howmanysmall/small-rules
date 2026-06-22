import { describe, expect, it } from "vitest";
import { createCamelCaseDetector } from "$oxc-utilities/recognizers/camel-case-detector";
import { createContainsDetector } from "$oxc-utilities/recognizers/contains-detector";
import { recognize } from "$oxc-utilities/recognizers/detector";
import { createEndWithDetector } from "$oxc-utilities/recognizers/end-with-detector";
import { createKeywordsDetector } from "$oxc-utilities/recognizers/keywords-detector";

describe("createContainsDetector utility", () => {
	describe("string patterns", () => {
		it("finds a plain string pattern", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, ["for("]);

			expect(detector.scan("for(let i=0;i<n;i++)")).toBe(1);
		}, 5000);

		it("is case-sensitive for string patterns", () => {
			expect.assertions(2);

			const detector = createContainsDetector(0.5, ["import"]);

			expect(detector.scan("import 'x'")).toBe(1);
			expect(detector.scan("Import 'x'")).toBe(0);
		}, 5000);

		it("finds multiple occurrences of the same pattern", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, ["this."]);

			expect(detector.scan("this.x = this.y")).toBe(2);
		}, 5000);

		it("finds across multiple patterns", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, ["for(", "if("]);

			expect(detector.scan("for(let i=0;i<n;i++){if(x)break}")).toBe(2);
		}, 5000);

		it("returns 0 when no pattern matches", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, ["for("]);

			expect(detector.scan("const x = 1")).toBe(0);
		}, 5000);

		it("counts empty pattern positions", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, [""]);

			expect(detector.scan("foo")).toBe(4);
		}, 5000);
	});

	describe("regex patterns", () => {
		it("uses regex source against whitespace-compressed text", () => {
			expect.assertions(2);

			const detector = createContainsDetector(0.5, [/\breturn\b/u]);

			expect(detector.scan("return 42")).toBe(0);
			expect(detector.scan("return(42)")).toBe(1);
		}, 5000);

		it("counts multiple regex matches in compressed text", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, [/\bconst\b/gu]);

			expect(detector.scan("const a = 1; const b = 2")).toBe(0);
		}, 5000);

		it("matches regex patterns without word boundaries in compressed text", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, [/return/u]);

			expect(detector.scan("return 42")).toBe(1);
		}, 5000);
	});

	describe("whitespace compression", () => {
		it("matches patterns ignoring whitespace", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, ["for("]);

			expect(detector.scan("for  (  let i=0;i<n;i++)")).toBe(1);
		}, 5000);

		it("compresses whitespace before matching", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, ["if("]);

			expect(detector.scan("  if  (  x  )  ")).toBe(1);
		}, 5000);
	});

	describe("regex special characters in string patterns", () => {
		it("escapes dots in string patterns literally", () => {
			expect.assertions(2);

			const detector = createContainsDetector(0.5, ["this."]);

			expect(detector.scan("this.x")).toBe(1);
			expect(detector.scan("thisX")).toBe(0);
		}, 5000);

		it("escapes parentheses in string patterns literally", () => {
			expect.assertions(1);

			const detector = createContainsDetector(0.5, ["require("]);

			expect(detector.scan("require('fs')")).toBe(1);
		}, 5000);
	});

	describe("lastIndex safety", () => {
		it("resets lastIndex between scans", () => {
			expect.assertions(3);

			const detector = createContainsDetector(0.5, ["const"]);

			expect(detector.scan("const x = 1")).toBe(1);
			expect(detector.scan("let y = 2")).toBe(0);
			expect(detector.scan("const z = 3")).toBe(1);
		}, 5000);

		it("does not leak state across repeated scan calls", () => {
			expect.assertions(10);

			const detector = createContainsDetector(0.5, [/var/u]);
			for (let iteration = 0; iteration < 10; iteration += 1) {
				expect(detector.scan("var x = 1")).toBe(1);
			}
		}, 5000);
	});
});

describe("createEndWithDetector utility", () => {
	describe("basic matching", () => {
		it("detects line ending with semicolon", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("const x = 1;")).toBe(1);
		}, 5000);

		it("detects line ending with closing brace", () => {
			expect.assertions(2);

			const detector = createEndWithDetector(0.95, ["}", "{"]);

			expect(detector.scan("function foo() {")).toBe(1);
			expect(detector.scan("}")).toBe(1);
		}, 5000);

		it("returns 0 when line does not end with target", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("const x = 1")).toBe(0);
		}, 5000);
	});

	describe("whitespace handling", () => {
		it("skips trailing whitespace", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("const x = 1;   ")).toBe(1);
		}, 5000);

		it("skips trailing tabs", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("const x = 1;\t\t")).toBe(1);
		}, 5000);
	});

	describe("comment marker handling", () => {
		it("skips trailing comment markers", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("const x = 1; */")).toBe(1);
		}, 5000);

		it("skips trailing asterisk", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("const x = 1; *")).toBe(1);
		}, 5000);
	});

	describe("empty and edge cases", () => {
		it("returns 0 for empty string", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("")).toBe(0);
		}, 5000);

		it("returns 0 for whitespace-only string", () => {
			expect.assertions(1);

			const detector = createEndWithDetector(0.95, [";"]);

			expect(detector.scan("   ")).toBe(0);
		}, 5000);
	});

	describe("multiple endings", () => {
		it("matches any of the specified endings", () => {
			expect.assertions(4);

			const detector = createEndWithDetector(0.95, ["}", ";", "{"]);

			expect(detector.scan("x = 1;")).toBe(1);
			expect(detector.scan("if (true) {")).toBe(1);
			expect(detector.scan("}")).toBe(1);
			expect(detector.scan("x = 1")).toBe(0);
		}, 5000);
	});
});

describe("createKeywordsDetector utility", () => {
	describe("basic matching", () => {
		it("counts keyword occurrences", () => {
			expect.assertions(2);

			const detector = createKeywordsDetector(0.3, ["const", "let", "var"]);

			expect(detector.scan("const x = 1")).toBe(1);
			expect(detector.scan("const x = 1; let y = 2")).toBe(2);
		}, 5000);

		it("returns 0 when no keyword matches", () => {
			expect.assertions(1);

			const detector = createKeywordsDetector(0.3, ["const"]);

			expect(detector.scan("let x = 1")).toBe(0);
		}, 5000);
	});

	describe("word boundary splitting", () => {
		it("splits on spaces", () => {
			expect.assertions(1);

			const detector = createKeywordsDetector(0.3, ["return"]);

			expect(detector.scan("return 42")).toBe(1);
		}, 5000);

		it("splits on parentheses", () => {
			expect.assertions(1);

			const detector = createKeywordsDetector(0.3, ["if"]);

			expect(detector.scan("if(x)")).toBe(1);
		}, 5000);

		it("splits on braces", () => {
			expect.assertions(1);

			const detector = createKeywordsDetector(0.3, ["else"]);

			expect(detector.scan("else{x}")).toBe(1);
		}, 5000);

		it("splits on tabs", () => {
			expect.assertions(1);

			const detector = createKeywordsDetector(0.3, ["const"]);

			expect(detector.scan("const\tx = 1")).toBe(1);
		}, 5000);
	});

	describe("multi-word lines", () => {
		it("counts multiple keyword occurrences across split words", () => {
			expect.assertions(1);

			const detector = createKeywordsDetector(0.3, ["return"]);

			expect(detector.scan("return return")).toBe(2);
		}, 5000);

		it("does not match partial keywords embedded in other tokens", () => {
			expect.assertions(1);

			const detector = createKeywordsDetector(0.7, ["++"]);

			expect(detector.scan("x++ || y++")).toBe(0);
		}, 5000);
	});
});

describe("createCamelCaseDetector utility", () => {
	describe("detection", () => {
		it("detects camelCase pattern", () => {
			expect.assertions(1);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("const myVariable = 1")).toBe(1);
		}, 5000);

		it("detects camelCase at different positions", () => {
			expect.assertions(2);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("myVariable")).toBe(1);
			expect(detector.scan("const fooBarBaz")).toBe(1);
		}, 5000);

		it("returns 0 for all-lowercase", () => {
			expect.assertions(1);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("const myvariable = 1")).toBe(0);
		}, 5000);

		it("returns 0 for all-uppercase with no lowercase prefix", () => {
			expect.assertions(1);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("CONST")).toBe(0);
		}, 5000);

		it("detects space-to-uppercase transition as camelCase-like", () => {
			expect.assertions(1);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("CONST MYVARIABLE")).toBe(1);
		}, 5000);
	});

	describe("edge cases", () => {
		it("returns 0 for empty string", () => {
			expect.assertions(1);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("")).toBe(0);
		}, 5000);

		it("returns 0 for single character", () => {
			expect.assertions(1);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("a")).toBe(0);
		}, 5000);

		it("returns 0 for two lowercase characters", () => {
			expect.assertions(1);

			const detector = createCamelCaseDetector(0.5);

			expect(detector.scan("ab")).toBe(0);
		}, 5000);
	});
});

describe("recognize (detector probability)", () => {
	it("returns 0 for zero matches", () => {
		expect.assertions(1);

		const detector = createKeywordsDetector(0.5, ["xyz"]);

		expect(recognize(detector, "hello world")).toBe(0);
	}, 5000);

	it("returns probability for single match", () => {
		expect.assertions(1);

		const detector = createKeywordsDetector(0.5, ["const"]);

		expect(recognize(detector, "const x = 1")).toBeCloseTo(0.5, 10);
	}, 5000);

	it("increases probability for multiple matches", () => {
		expect.assertions(2);

		const detector = createKeywordsDetector(0.5, ["const"]);
		const probability = recognize(detector, "const x = 1; const y = 2");

		expect(probability).toBeGreaterThan(0.5);
		expect(probability).toBeLessThan(1);
	}, 5000);

	it("computes 1 - (1-p)^matches correctly", () => {
		expect.assertions(1);

		const detector = createKeywordsDetector(0.3, ["return"]);
		const probability = recognize(detector, "return return return");
		const expected = 1 - (1 - 0.3) ** 3;

		expect(probability).toBeCloseTo(expected, 10);
	}, 5000);
});
