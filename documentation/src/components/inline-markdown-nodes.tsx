import { Fragment } from "react";

import { parseInlineMarkdown } from "$utilities/inline-markdown";

import type { ReactNode } from "react";

interface InlineMarkdownNodesProperties {
	text: string;
}

export function InlineMarkdownNodes({ text }: Readonly<InlineMarkdownNodesProperties>): ReactNode {
	const nodes = new Array<ReactNode>();
	let segmentIndex = 0;

	for (const segment of parseInlineMarkdown(text)) {
		const inlineContent = segment.code ? <code>{segment.text}</code> : segment.text;
		const content = segment.bold ? <strong>{inlineContent}</strong> : inlineContent;
		nodes.push(<Fragment key={`segment-${String(segmentIndex++)}`}>{content}</Fragment>);
	}

	return nodes;
}
