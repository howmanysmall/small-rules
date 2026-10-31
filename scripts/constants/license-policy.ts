import type { LicensePolicy } from "$script-utilities/licenses";

const FONT_LICENSES = [{ license: "OFL-1.1", packages: "@fontsource*" }];

const SHIPPED_LICENSES = [
	"0BSD",
	"Apache-2.0",
	"BlueOak-1.0.0",
	"BSD-2-Clause",
	"BSD-3-Clause",
	"CC0-1.0",
	"ISC",
	"MIT",
	"MIT-0",
];

/**
 * The licenses `node --run licenses:check` accepts. `shipped` covers the
 * plugin's own `dependencies` and the documentation site's; `workspace` covers
 * everything else installed.
 *
 * Patterns match platform binaries by prefix because macOS and Linux install
 * different ones.
 */
export const LICENSE_POLICY: LicensePolicy = {
	exceptions: [
		{
			license: "CC BY-SA 4.0",
			package: "@cspell/dict-en-common-misspellings",
			reason: "Means CC-BY-SA-4.0 but is not valid SPDX; a lint-only spelling dictionary.",
		},
		{
			license: "LGPL-3.0-or-later",
			package: "@img/sharp-libvips-*",
			reason: "libvips is loaded dynamically by sharp to optimize images at docs build time; none of it ships.",
		},
		{
			license: "MPL-2.0",
			package: "lightningcss*",
			reason: "Astro's CSS minifier at docs build time, used unmodified; none of it ships.",
		},
		{
			license: "Python-2.0",
			package: "argparse",
			reason: "A permissive PSF-style license; js-yaml's CLI parser, reached at docs build time.",
		},
	],
	tiers: [
		{
			name: "shipped",
			allowed: SHIPPED_LICENSES,
			scoped: FONT_LICENSES,
		},
		{
			name: "workspace",
			allowed: [
				...SHIPPED_LICENSES,
				"CC-BY-3.0",
				"CC-BY-4.0",
				"LGPL-3.0-only",
				"LGPL-3.0-or-later",
				"MPL-2.0",
				"Python-2.0",
			],
			scoped: FONT_LICENSES,
		},
	],
};
