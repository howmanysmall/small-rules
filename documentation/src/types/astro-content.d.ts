import type { ComponentRenderer, MarkdownHeading } from "astro";

declare module "astro:content" {
	interface CollectionEntry<TCollection extends string = string> {
		body: string;
		collection: TCollection;
		data: Record<string, unknown>;
		id: string;
		render: () => Promise<{
			Content: ComponentRenderer;
			headings: Array<MarkdownHeading>;
			remarkPluginFrontmatter: Record<string, unknown>;
		}>;
		slug: string;
	}
}
