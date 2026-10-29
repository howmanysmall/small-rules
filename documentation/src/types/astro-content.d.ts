import type { ComponentRenderer, MarkdownHeading } from "astro";
import type { UnknownRecord } from "type-fest";

interface RenderResult {
	Content: ComponentRenderer;
	headings: Array<MarkdownHeading>;
	remarkPluginFrontmatter: UnknownRecord;
}

declare module "astro:content" {
	interface CollectionEntry<TCollection extends string = string> {
		id: string;
		body: string;
		collection: TCollection;
		data: UnknownRecord;
		render: () => Promise<RenderResult>;
		slug: string;
	}
}
