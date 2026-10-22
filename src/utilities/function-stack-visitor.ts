import type { CallbackFunction } from "@small-rules/oxlint-utilities";
import type { Visitor } from "oxlint-plugin-utilities";

/**
 * Builds the function enter/exit visitors that keep a stack of the functions
 * enclosing the current node.
 *
 * @template TEntry - The value tracked for each enclosing function.
 * @param stack - Stack to push onto when entering a function and pop when
 *   leaving it.
 * @param enter - Called on entry; its result is pushed onto the stack.
 * @returns Visitor entries for arrow functions, function declarations, and
 *   function expressions.
 */
export function createFunctionStackVisitor<TEntry>(
	stack: Array<TEntry>,
	enter: (node: CallbackFunction) => TEntry,
): Visitor {
	function pushFunction(node: CallbackFunction): void {
		stack.push(enter(node));
	}

	function popFunction(): void {
		stack.pop();
	}

	return {
		ArrowFunctionExpression: pushFunction,
		"ArrowFunctionExpression:exit": popFunction,
		FunctionDeclaration: pushFunction,
		"FunctionDeclaration:exit": popFunction,
		FunctionExpression: pushFunction,
		"FunctionExpression:exit": popFunction,
	};
}
