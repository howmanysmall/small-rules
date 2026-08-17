import type { ComponentRenderer, MarkdownHeading } from "astro";

declare module "astro:content" {
	interface CollectionEntry<TCollection extends string = string> {
		id: string;
		body: string;
		collection: TCollection;
		data: Record<string, unknown>;
		render: () => Promise<{
			Content: ComponentRenderer;
			headings: Array<MarkdownHeading>;
			remarkPluginFrontmatter: Record<string, unknown>;
		}>;
		slug: string;
	}
}
