/**
 * Single source of truth for third-party code vendored into this repository.
 *
 * Adding a component means adding one entry to {@linkcode VENDORED_COMPONENTS}
 * and running `node --run generate:third-party-notices`. Both consumers derive
 * from this module, so they cannot drift:
 *
 * - `THIRD-PARTY-NOTICES.md`, shipped in the npm tarball, via
 *   {@linkcode renderNoticesMarkdown}.
 * - The `dist/index.js` legal banner, via {@linkcode renderBundleBanner},
 * wired into
 *   `tsdown.config.ts`.
 *
 * See `docs/vendoring.md` for the full procedure.
 */

/**
 * License texts keyed by SPDX identifier, with `{{copyright}}` standing in for
 * the component's copyright line.
 *
 * Only permissive licenses whose full text is a copyright substitution away
 * belong here. Anything with extra obligations — Apache-2.0 requires a
 * `NOTICE` file and a statement of changes, the copyleft family requires
 * source offers — is deliberately absent so that vendoring it fails to compile
 * rather than shipping a notice that does not cover the obligation.
 */
const LICENSE_TEMPLATES = {
	"BSD-2-Clause": `BSD 2-Clause License

{{copyright}}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,

	"BSD-3-Clause": `BSD 3-Clause License

{{copyright}}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,

	ISC: `ISC License

{{copyright}}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`,

	MIT: `MIT License

{{copyright}}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
} as const;

/** SPDX identifiers this repository knows how to render a notice for. */
type LicenseIdentifier = keyof typeof LICENSE_TEMPLATES;

/** One vendored file and the upstream file it came from. */
interface VendoredFile {
	/** Path within {@linkcode VendoredComponent.directory}. */
	readonly local: string;
	/** Path within the upstream repository. */
	readonly upstream: string;
}

/** A third-party project with code copied into this repository. */
export interface VendoredComponent {
	/** Display name, used as the notices heading. */
	readonly name: string;
	/** Upstream commit the files were taken from. */
	readonly commit: string;
	/** Upstream copyright line, verbatim. */
	readonly copyright: string;
	/**
	 * Directory the files live in, repository-relative, with a trailing slash.
	 */
	readonly directory: string;
	/**
	 * Vendored files, listed in the order they should appear in the notices
	 * table.
	 */
	readonly files: ReadonlyArray<VendoredFile>;
	/** SPDX identifier; unsupported licenses are a compile error by design. */
	readonly license: LicenseIdentifier;
	/** Upstream project URL. */
	readonly source: string;
	/** Whether the vendored files are byte-for-byte copies. */
	readonly verbatim: boolean;
}

/** Where the shipped notices file lives, for the bundle banner to point at. */
const NOTICES_URL = "https://github.com/howmanysmall/small-rules/blob/main/THIRD-PARTY-NOTICES.md";

/** Every third-party project vendored into this repository. */
export const VENDORED_COMPONENTS: ReadonlyArray<VendoredComponent> = [
	{
		name: "anti-slop",
		commit: "446268e5d15baa968eaec669ff65358d36ae6259",
		copyright: "Copyright (c) 2026 Dillon Mulroy",
		directory: "src/rules/anti-slop/",
		files: [
			{ local: "no-chained-type-assertions.ts", upstream: "src/rules/no-chained-type-assertions.ts" },
			{
				local: "no-conditional-empty-object-spread.ts",
				upstream: "src/rules/no-conditional-empty-object-spread.ts",
			},
			{ local: "no-known-value-widening.ts", upstream: "src/rules/no-known-value-widening.ts" },
			{ local: "no-module-mocking.ts", upstream: "src/rules/no-module-mocking.ts" },
			{ local: "no-object-parameters.ts", upstream: "src/rules/no-object-parameters.ts" },
			{ local: "no-reflect-apply.ts", upstream: "src/rules/no-reflect-apply.ts" },
			{ local: "no-reflect-get.ts", upstream: "src/rules/no-reflect-get.ts" },
			{ local: "no-runtime-typeof.ts", upstream: "src/rules/no-runtime-typeof.ts" },
			{ local: "no-shape-in-symbol-names.ts", upstream: "src/rules/no-shape-in-symbol-names.ts" },
			{ local: "no-unknown-parameters.ts", upstream: "src/rules/no-unknown-parameters.ts" },
			{ local: "no-unknown-returns.ts", upstream: "src/rules/no-unknown-returns.ts" },
			{ local: "no-unknown-type-aliases.ts", upstream: "src/rules/no-unknown-type-aliases.ts" },
			{ local: "no-unsafe-dictionary-type.ts", upstream: "src/rules/no-unsafe-dictionary-type.ts" },
			{ local: "no-widen-then-assert.ts", upstream: "src/rules/no-widen-then-assert.ts" },
			{
				local: "require-safety-comment-for-type-assertion.ts",
				upstream: "src/rules/require-safety-comment-for-type-assertion.ts",
			},
		],
		license: "MIT",
		source: "https://github.com/dmmulroy/anti-slop",
		verbatim: false,
	},
	{
		name: "anti-slop shared helpers",
		commit: "446268e5d15baa968eaec669ff65358d36ae6259",
		copyright: "Copyright (c) 2026 Dillon Mulroy",
		directory: "src/utilities/anti-slop/",
		files: [
			{ local: "dictionary-types.ts", upstream: "src/shared/dictionary-types.ts" },
			{ local: "lexical-type-parameters.ts", upstream: "src/shared/lexical-type-parameters.ts" },
			{ local: "reflect-method.ts", upstream: "src/shared/reflect-method.ts" },
		],
		license: "MIT",
		source: "https://github.com/dmmulroy/anti-slop",
		verbatim: false,
	},
	{
		name: "eslint-plugin-roblox-ts",
		commit: "e1581d4f3d83a3d05b015a0a216507c3a20016de",
		copyright: "Copyright (c) 2025-PRESENT roblox-ts",
		directory: "src/rules/roblox/",
		files: [
			{
				local: "no-unsupported-syntax.ts",
				upstream: "src/rules/no-unsupported-syntax/rule.ts",
			},
		],
		license: "MIT",
		source: "https://github.com/roblox-ts/eslint-plugin-roblox-ts",
		verbatim: false,
	},
];

/**
 * Resolves a component's license text, copyright line substituted in.
 * @param component - The component whose license text is wanted.
 * @returns The full license text.
 */
export function renderLicenseText(component: VendoredComponent): string {
	return LICENSE_TEMPLATES[component.license].split("{{copyright}}").join(component.copyright);
}

/**
 * Renders the contents of `THIRD-PARTY-NOTICES.md`.
 * @returns The full Markdown document.
 */
export function renderNoticesMarkdown(): string {
	const sections = VENDORED_COMPONENTS.map((component, index) => {
		const rows = component.files.map((file) => `| \`${file.local}\` | \`${file.upstream}\` |`);
		const provenance = component.verbatim ? "verbatim" : "adapted rather than verbatim";

		return `---

## ${index + 1}. \`${component.name}\`

- **Source:** <${component.source}>
- **Vendored commit:** \`${component.commit}\`
- **Copyright:** ${component.copyright}
- **License:** ${component.license}

Vendored into \`${component.directory}\`, ${provenance}:

| This project | Upstream |
| --- | --- |
${rows.join("\n")}

\`\`\`text
${renderLicenseText(component)}
\`\`\`
`;
	});

	return `<!-- Generated by \`node --run generate:third-party-notices\`. Do not edit by hand. -->
<!-- Source of truth: scripts/utilities/vendored-notices.ts -->

# Third-Party Notices

\`@pobammer-ts/small-rules\` incorporates material from the third-party projects listed
below. The original copyright notices and the license terms under which that material
was received are reproduced here.

This file is distributed in the published npm package. The same notices are embedded in
\`dist/index.js\`.

${sections.join("\n")}`;
}

/**
 * Prefixes each line of a block so it can sit inside a block comment.
 * @param block - The text to prefix.
 * @returns The block with every line prefixed by an asterisk.
 */
function prefixLines(block: string): string {
	return block
		.split("\n")
		.map((line) => (line === "" ? " *" : ` * ${line}`))
		.join("\n");
}

/**
 * Renders the legal comment prepended to `dist/index.js`.
 *
 * Emitted as `/*!` and attached through rolldown's `postBanner` so that
 * neither the minifier nor the comment stripper can drop it. The
 * vendored sources' own `//` provenance headers do not survive minify.
 * @returns The bundle banner, as a legal comment.
 */
export function renderBundleBanner(): string {
	const blocks = VENDORED_COMPONENTS.map((component) =>
		prefixLines(
			`${component.name} <${component.source}>
${component.copyright}
SPDX-License-Identifier: ${component.license}

${renderLicenseText(component)}`,
		),
	);

	return `/*!
 * This bundle includes code from the following third-party projects.
 * Full notices: ${NOTICES_URL}
 *
${blocks.join("\n *\n")}
 */`;
}
