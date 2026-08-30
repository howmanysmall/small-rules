export interface ExtractionContext {
	readonly relativePath: string;
	readonly sourceText: string;
}

interface SourcePosition {
	readonly column: number;
	readonly line: number;
}

function getSourcePosition(sourceText: string, offset: number): SourcePosition {
	const prefix = Buffer.from(sourceText).subarray(0, offset).toString("utf8");
	const lastLineBreak = prefix.lastIndexOf("\n");
	return { column: prefix.length - lastLineBreak, line: prefix.split("\n").length };
}

export class ExtractionError extends Error {
	public override readonly name = "ExtractionError";

	public constructor(
		{ relativePath, sourceText }: ExtractionContext,
		offset: number,
		reason: string,
		errorOptions?: ErrorOptions,
	) {
		const { column, line } = getSourcePosition(sourceText, offset);
		super(`${relativePath}:${line}:${column}: ${reason}`, errorOptions);
	}
}
