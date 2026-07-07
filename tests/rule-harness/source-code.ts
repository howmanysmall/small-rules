import { harnessVisitorKeys } from "./ast";
import { createLocationIndex } from "./locations";
// oxlint-disable unicorn/no-null -- SourceCode token helpers return null when no neighboring token exists.
import { buildScopeManager } from "./scope";
import { createComments, tokenize } from "./tokens";

import type {
	HarnessComment,
	HarnessNode,
	HarnessScope,
	HarnessSourceCode,
	HarnessToken,
	HarnessVariable,
	RangeLike,
	ScopeManager,
} from "./types";

export function createSourceCode(
	text: string,
	ast: HarnessNode,
	rawComments: ReadonlyArray<unknown>,
): HarnessSourceCode {
	const locationIndex = createLocationIndex(text);
	const comments = createComments(rawComments, locationIndex);
	const tokens = tokenize(text, comments, locationIndex);
	const scopeManager = buildScopeManager(ast);
	ast.tokens = tokens;
	ast.comments = comments;

	return {
		ast,
		comments,
		commentsExistBetween(left, right): boolean {
			return commentsExistBetween(comments, left, right);
		},
		getAllComments(): Array<HarnessComment> {
			return [...comments];
		},
		getCommentsAfter(node): Array<HarnessComment> {
			return getCommentsAfter(comments, tokens, node);
		},
		getCommentsBefore(node): Array<HarnessComment> {
			return getCommentsBefore(comments, tokens, node);
		},
		getCommentsInside(node): Array<HarnessComment> {
			return comments.filter((comment) => comment.range[0] >= node.range[0] && comment.range[1] <= node.range[1]);
		},
		getDeclaredVariables(node): Array<HarnessVariable> {
			return scopeManager.declaredVariables.get(node) ?? [];
		},
		getScope(node): HarnessScope {
			return getScope(scopeManager, node);
		},
		getText(node, beforeCount = 0, afterCount = 0): string {
			if (node === undefined) return text;
			const start = Math.max(0, node.range[0] - beforeCount);
			const end = Math.min(text.length, node.range[1] + afterCount);
			return text.slice(start, end);
		},
		getTokenAfter(node): HarnessToken | null {
			return tokens.find((token) => token.range[0] >= node.range[1]) ?? null;
		},
		getTokenBefore(node): HarnessToken | null {
			for (let index = tokens.length - 1; index >= 0; index -= 1) {
				const token = tokens[index];
				if (token !== undefined && token.range[1] <= node.range[0]) return token;
			}
			return null;
		},
		isGlobalReference(node): boolean {
			const scope = getScope(scopeManager, node);
			const name = typeof node.name === "string" ? node.name : undefined;
			if (name === undefined) return false;
			let current: HarnessScope | null = scope;
			while (current !== null) {
				if (current.set.has(name)) return false;
				current = current.upper;
			}
			return true;
		},
		scopeManager,
		text,
		tokens,
		visitorKeys: harnessVisitorKeys,
	};
}

function getScope(scopeManager: ScopeManager, node: HarnessNode): HarnessScope {
	let current: HarnessNode | null | undefined = node;
	while (current !== null && current !== undefined) {
		const scope = scopeManager.nodeToScope.get(current);
		if (scope !== undefined) return scope;
		current = current.parent;
	}
	return scopeManager.globalScope;
}

function commentsExistBetween(comments: ReadonlyArray<HarnessComment>, left: RangeLike, right: RangeLike): boolean {
	return comments.some((comment) => comment.range[0] >= left.range[1] && comment.range[1] <= right.range[0]);
}

function getCommentsBefore(
	comments: ReadonlyArray<HarnessComment>,
	tokens: ReadonlyArray<HarnessToken>,
	node: RangeLike,
): Array<HarnessComment> {
	const tokenAfterComments = new Map<HarnessComment, HarnessToken | null>();
	return comments.filter((comment) => {
		if (comment.range[1] > node.range[0]) return false;
		if (!tokenAfterComments.has(comment)) {
			tokenAfterComments.set(comment, tokens.find((token) => token.range[0] >= comment.range[1]) ?? null);
		}
		const nextToken = tokenAfterComments.get(comment) ?? null;
		return nextToken === null || nextToken.range[0] >= node.range[0];
	});
}

function getCommentsAfter(
	comments: ReadonlyArray<HarnessComment>,
	tokens: ReadonlyArray<HarnessToken>,
	node: RangeLike,
): Array<HarnessComment> {
	const tokenBeforeComments = new Map<HarnessComment, HarnessToken | null>();
	return comments.filter((comment) => {
		if (comment.range[0] < node.range[1]) return false;
		if (!tokenBeforeComments.has(comment)) {
			tokenBeforeComments.set(comment, getPreviousToken(tokens, comment) ?? null);
		}
		const previousToken = tokenBeforeComments.get(comment) ?? null;
		return previousToken === null || previousToken.range[1] <= node.range[1];
	});
}

function getPreviousToken(tokens: ReadonlyArray<HarnessToken>, node: RangeLike): HarnessToken | undefined {
	for (let index = tokens.length - 1; index >= 0; index -= 1) {
		const token = tokens[index];
		if (token !== undefined && token.range[1] <= node.range[0]) return token;
	}
	return undefined;
}
