declare module "satteri" {
	import type { Element, RootContent as HastRootContent } from "hast";
	import type {
		BlockContent,
		DefinitionContent,
		Parent,
		PhrasingContent,
		RootContent as MdastRootContent,
	} from "mdast";
	import type { ContainerDirectiveData, LeafDirectiveData, TextDirectiveData } from "mdast-util-directive";

	export interface MdastPluginContext {
		readonly fileURL?: string;
		readonly textContent: (node: unknown) => string;
	}

	interface DirectiveFields {
		readonly attributes?: Record<string, string | null | undefined> | null;
		readonly name: string;
	}

	export interface ContainerDirective extends DirectiveFields, Parent {
		readonly children: Array<BlockContent | DefinitionContent>;
		readonly data?: ContainerDirectiveData;
		readonly type: "containerDirective";
	}

	export interface LeafDirective extends DirectiveFields, Parent {
		readonly children: Array<PhrasingContent>;
		readonly data?: LeafDirectiveData;
		readonly type: "leafDirective";
	}

	export interface TextDirective extends DirectiveFields, Parent {
		readonly children: Array<PhrasingContent>;
		readonly data?: TextDirectiveData;
		readonly type: "textDirective";
	}

	export interface MdastPluginDefinition {
		readonly containerDirective?: (
			node: ContainerDirective,
			context: MdastPluginContext,
		) => MdastRootContent | undefined;
		readonly leafDirective?: (node: LeafDirective, context: MdastPluginContext) => MdastRootContent | undefined;
		readonly name: string;
		readonly textDirective?: (node: TextDirective, context: MdastPluginContext) => MdastRootContent | undefined;
	}

	export type MdastPluginInput = MdastPluginDefinition | (() => MdastPluginDefinition);

	export interface HastPluginContext {
		readonly fileURL?: string;
		readonly setProperty: (node: Element, key: string, value: string) => void;
		readonly textContent: (node: unknown) => string;
	}

	export interface HastElementVisitor {
		readonly filter?: ReadonlyArray<string>;
		readonly visit: (node: Element, context: HastPluginContext) => HastRootContent | undefined;
	}

	export interface RawNode {
		readonly value: string;
	}

	export interface HastPluginDefinition {
		readonly element?: HastElementVisitor | ReadonlyArray<HastElementVisitor>;
		readonly name: string;
		readonly raw?: (
			node: RawNode,
			context: HastPluginContext,
		) => { readonly type: "raw"; readonly value: string } | undefined;
	}

	export type HastPluginInput = HastPluginDefinition | (() => HastPluginDefinition);
}

declare module "@astrojs/markdown-satteri" {
	import type { HastPluginDefinition, HastPluginInput, MdastPluginInput } from "satteri";

	export interface SatteriMarkdownProcessor {
		readonly name: string;
		readonly options: {
			features: {
				directive?: boolean;
			};
			hastPlugins: Array<HastPluginInput>;
			mdastPlugins: Array<MdastPluginInput>;
		};
	}

	export const isSatteriProcessor: (processor: unknown) => processor is SatteriMarkdownProcessor;
	export const satteriHeadingIdsPlugin: () => HastPluginDefinition;
}
