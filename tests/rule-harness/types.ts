type TestSourceType = "commonjs" | "module" | "script" | "unambiguous";

export type TestLanguage = "dts" | "js" | "jsx" | "ts" | "tsx";
export type Range = [number, number];

export interface Position {
	column: number;
	line: number;
}

export interface SourceLocation {
	end: Position;
	start: Position;
}

export interface HarnessNode {
	loc: SourceLocation;
	parent?: HarnessNode | null;
	range: Range;
	type: string;
	[key: string]: unknown;
}

export interface HarnessComment {
	loc: SourceLocation;
	range: Range;
	type: "Block" | "Line";
	value: string;
}

export interface HarnessToken {
	loc: SourceLocation;
	range: Range;
	type: string;
	value: string;
}

export interface HarnessReference {
	from: HarnessScope;
	identifier: HarnessNode;
	isRead: () => boolean;
	isReadOnly: () => boolean;
	isReadWrite: () => boolean;
	isWrite: () => boolean;
	isWriteOnly: () => boolean;
	resolved?: HarnessVariable;
}

export interface HarnessDefinition {
	name: HarnessNode;
	node: HarnessNode;
	parent: HarnessNode | null;
	type: string;
}

export interface HarnessVariable {
	defs: Array<HarnessDefinition>;
	identifiers: Array<HarnessNode>;
	name: string;
	references: Array<HarnessReference>;
	scope: HarnessScope;
}

export interface HarnessScope {
	block: HarnessNode;
	childScopes: Array<HarnessScope>;
	references: Array<HarnessReference>;
	set: Map<string, HarnessVariable>;
	through: Array<HarnessReference>;
	type: string;
	upper: HarnessScope | null;
	variables: Array<HarnessVariable>;
}

export interface ScopeManager {
	declaredVariables: WeakMap<object, Array<HarnessVariable>>;
	globalScope: HarnessScope;
	nodeToScope: WeakMap<object, HarnessScope>;
}

export interface HarnessSourceCode {
	ast: HarnessNode;
	comments: Array<HarnessComment>;
	commentsExistBetween: (left: RangeLike, right: RangeLike) => boolean;
	getAllComments: () => Array<HarnessComment>;
	getCommentsAfter: (node: RangeLike) => Array<HarnessComment>;
	getCommentsBefore: (node: RangeLike) => Array<HarnessComment>;
	getCommentsInside: (node: RangeLike) => Array<HarnessComment>;
	getDeclaredVariables: (node: HarnessNode) => Array<HarnessVariable>;
	getScope: (node: HarnessNode) => HarnessScope;
	getText: (node?: RangeLike, beforeCount?: number, afterCount?: number) => string;
	getTokenAfter: (node: RangeLike) => HarnessToken | null;
	getTokenBefore: (node: RangeLike) => HarnessToken | null;
	isGlobalReference: (node: HarnessNode) => boolean;
	scopeManager: ScopeManager;
	text: string;
	tokens: Array<HarnessToken>;
	visitorKeys: Record<string, ReadonlyArray<string>>;
}

export interface RangeLike {
	loc?: SourceLocation;
	range: Range;
}

export interface RuleTestRunner {
	run: (ruleName: string, rule: unknown, cases: RuleTestCases) => void;
}

export interface RuleRunnerDefaults {
	language?: TestLanguage;
	sourceType?: TestSourceType;
}

export interface RuleTestCases {
	invalid: ReadonlyArray<InvalidRuleCase>;
	valid: ReadonlyArray<string | ValidRuleCase>;
}

export interface BaseRuleCase {
	code: string;
	filename?: string;
	language?: TestLanguage;
	only?: boolean;
	options?: ReadonlyArray<unknown>;
	settings?: Record<string, unknown>;
	skip?: boolean;
	sourceType?: TestSourceType;
}

export type ValidRuleCase = BaseRuleCase;

export interface InvalidRuleCase extends BaseRuleCase {
	errors: number | ReadonlyArray<RuleTestError>;
	output?: null | string;
}

export interface RuleTestError {
	column?: number;
	data?: Record<string, unknown>;
	endColumn?: number;
	endLine?: number;
	line?: number;
	message?: string;
	messageId?: string;
	suggestions?: number | ReadonlyArray<RuleTestSuggestion>;
}

export interface RuleTestSuggestion {
	data?: Record<string, unknown>;
	desc?: string;
	message?: string;
	messageId?: string;
	output?: string;
}

export interface NormalizedRuleCase {
	code: string;
	filename: string;
	language: TestLanguage;
	only?: boolean;
	options: ReadonlyArray<unknown>;
	settings: Record<string, unknown>;
	skip?: boolean;
	sourceType: TestSourceType;
}

export interface NormalizedValidCase extends NormalizedRuleCase {
	kind: "valid";
}

export interface NormalizedInvalidCase extends NormalizedRuleCase {
	errors: ReadonlyArray<RuleTestError>;
	kind: "invalid";
	output?: null | string;
}

export type NormalizedCase = NormalizedInvalidCase | NormalizedValidCase;

export interface RuntimeDiagnostic {
	column?: number;
	data: Record<string, unknown>;
	endColumn?: number;
	endLine?: number;
	fix?: FixProvider;
	line?: number;
	loc?: SourceLocation;
	message: string;
	messageId?: string;
	node?: HarnessNode;
	suggestions: Array<RuntimeSuggestion>;
}

export interface RuntimeSuggestion {
	data: Record<string, unknown>;
	desc: string;
	fix?: FixProvider;
	messageId?: string;
}

export interface Fix {
	range: Range;
	text: string;
}

export interface Fixer {
	insertTextAfter: (node: RangeLike, text: string) => Fix;
	insertTextAfterRange: (range: Range, text: string) => Fix;
	insertTextBefore: (node: RangeLike, text: string) => Fix;
	insertTextBeforeRange: (range: Range, text: string) => Fix;
	remove: (node: RangeLike) => Fix;
	removeRange: (range: Range) => Fix;
	replaceText: (node: RangeLike, text: string) => Fix;
	replaceTextRange: (range: Range, text: string) => Fix;
}

export type FixProvider = (fixer: Fixer) => Fix | ReadonlyArray<Fix> | undefined;

export interface HarnessContext {
	filename: string;
	id: string;
	options: ReadonlyArray<unknown>;
	physicalFilename: string;
	report: (diagnostic: unknown) => void;
	settings: Record<string, unknown>;
	sourceCode: HarnessSourceCode;
}

export interface RuleExecutionResult {
	diagnostics: Array<RuntimeDiagnostic>;
	sourceCode: HarnessSourceCode;
}
