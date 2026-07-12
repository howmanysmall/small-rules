import { readFile } from "node:fs/promises";
import { fdir } from "fdir";
import { parseSync, Visitor } from "oxc-parser";

import type { CallExpression, JSXElementName, JSXMemberExpression, JSXOpeningElement, ParseResult } from "oxc-parser";

export const enum ScanType {
	Both = "both",
	React = "tsx",
	TypeScript = "ts",
}

const GATHER_TO_SCAN_TYPE: Record<ScanType, fdir> = {
	[ScanType.Both]: new fdir().glob("**/*.{ts,tsx}").withFullPaths(),
	[ScanType.TypeScript]: new fdir().glob("**/*.ts").withFullPaths(),
	[ScanType.React]: new fdir().glob("**/*.tsx").withFullPaths(),
};

function isAllLowerCase(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.codePointAt(index);
		if (code !== undefined && code >= 65 && code <= 90) return false;
	}
	return value.length > 0;
}

function resolveJsxElementName(jsxElementName: JSXElementName): string {
	switch (jsxElementName.type) {
		case "JSXIdentifier":
			return jsxElementName.name;

		case "JSXMemberExpression":
			return `${resolveJsxMemberObject(jsxElementName.object)}.${jsxElementName.property.name}`;

		case "JSXNamespacedName":
			return `${jsxElementName.namespace.name}:${JSON.stringify(jsxElementName.name)}`;

		default: {
			const error = new Error(`Unknown JSXElementName type: ${JSON.stringify(jsxElementName)}`);
			Error.captureStackTrace(error, resolveJsxElementName);
			throw error;
		}
	}
}

function resolveJsxMemberObject(object: JSXMemberExpression["object"]): string {
	switch (object.type) {
		case "JSXIdentifier":
			return object.name;

		case "JSXMemberExpression":
			return `${resolveJsxMemberObject(object.object)}.${object.property.name}`;

		default: {
			const error = new Error(`Unknown JSXMemberExpression object type: ${JSON.stringify(object)}`);
			Error.captureStackTrace(error, resolveJsxMemberObject);
			throw error;
		}
	}
}

function isCreateElementCall(callee: CallExpression["callee"]): boolean {
	if (callee.type === "Identifier") return callee.name === "createElement";

	if (callee.type === "MemberExpression" && !callee.computed) {
		if (callee.property.name !== "createElement") return false;

		const { object } = callee;
		if (object.type === "Identifier") return object.name === "React";
	}

	return false;
}

function getFirstStringArgument(parameters: ReadonlyArray<CallExpression["arguments"][number]>): string | undefined {
	const [firstParameter] = parameters;
	return firstParameter?.type === "Literal" && typeof firstParameter.value === "string"
		? firstParameter.value
		: undefined;
}

interface FileWithSource {
	readonly path: string;
	readonly sourceText: string;
}

async function readAllFilesAsync(paths: ReadonlyArray<string>): Promise<ReadonlyArray<FileWithSource>> {
	const results = await Promise.all(
		paths.map(async (path) => {
			try {
				const sourceText = await readFile(path, "utf8");
				return { path, sourceText };
			} catch {
				return undefined;
			}
		}),
	);
	return results.filter((result): result is FileWithSource => result !== undefined);
}

const TSX = { lang: "tsx" } as const;

export async function scanDirectoryAsync(directory: string, scanType: ScanType): Promise<ReadonlyArray<string>> {
	const files = await GATHER_TO_SCAN_TYPE[scanType].crawl(directory).withPromise();
	const instances = new Set<string>();

	const fileResults = await readAllFilesAsync(files);

	for (const { sourceText } of fileResults) {
		let parseResult: ParseResult;
		try {
			parseResult = parseSync("file.tsx", sourceText, TSX);
		} catch {
			continue;
		}

		const visitor = new Visitor({
			CallExpression(node: CallExpression): void {
				if (!isCreateElementCall(node.callee)) return;
				const tag = getFirstStringArgument(node.arguments);
				if (tag !== undefined && isAllLowerCase(tag)) instances.add(tag);
			},
			JSXOpeningElement(node: JSXOpeningElement): void {
				const name = resolveJsxElementName(node.name);
				if (isAllLowerCase(name)) instances.add(name);
			},
		});

		visitor.visit(parseResult.program);
	}

	return [...instances].toSorted();
}
