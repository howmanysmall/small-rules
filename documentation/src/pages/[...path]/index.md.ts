import { getCollection } from "astro:content";

import { createMarkdownResponse } from "@/utilities/create-markdown-response";

import type { APIRoute, GetStaticPaths, GetStaticPathsResult } from "astro";

export const getStaticPaths = (async (): Promise<GetStaticPathsResult> => {
	const entries = await getCollection("docs");
	return entries
		.filter((entry) => entry.id !== "")
		.map((entry) => ({
			params: { path: entry.id },
			// oxlint-disable-next-line small-rules/prevent-abbreviations -- bruh.
			props: { body: entry.body },
		}));
}) satisfies GetStaticPaths;

// oxlint-disable-next-line small-rules/require-async-suffix small-rules/prevent-abbreviations typescript/require-await -- bruh.
export const GET: APIRoute = async ({ props: properties }): Promise<Response> => {
	const { body } = properties;

	if (!body) {
		return createMarkdownResponse({ body: "", status: 404 });
	}

	return createMarkdownResponse({ body });
};
