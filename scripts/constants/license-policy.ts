import type { LicensePolicy } from "$script-utilities/licenses";

/**
 * The licenses `node --run licenses:check` accepts for what ships: the
 * plugin's own `dependencies` and the documentation site's. Dev tooling is
 * not checked.
 *
 * Patterns match platform binaries by prefix because macOS and Linux install
 * different ones.
 */
export const LICENSE_POLICY: LicensePolicy = {
	exceptions: [
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
	],
	tiers: [
		{
			name: "shipped",
			allowed: [
				"0BSD",
				"Apache-2.0",
				"BlueOak-1.0.0",
				"BSD-2-Clause",
				"BSD-3-Clause",
				"CC0-1.0",
				"ISC",
				"MIT",
				"MIT-0",
			],
			scoped: [{ license: "OFL-1.1", packages: "@fontsource*" }],
		},
	],
};
