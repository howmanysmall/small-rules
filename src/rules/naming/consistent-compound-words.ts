import { Predicate } from "effect";

import { forEachScopeVariable } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

const DEFAULT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
	["backGround", "background"],
	["callBack", "callback"],
	["checkBox", "checkbox"],
	["clipBoard", "clipboard"],
	["codeBase", "codebase"],
	["dataBase", "database"],
	["downLoad", "download"],
	["feedBack", "feedback"],
	["foreGround", "foreground"],
	["frameWork", "framework"],
	["headLine", "headline"],
	["keyBoard", "keyboard"],
	["keyFrame", "keyframe"],
	["lifeCycle", "lifecycle"],
	["metaData", "metadata"],
	["midPoint", "midpoint"],
	["nameSpace", "namespace"],
	["overRide", "override"],
	["passWord", "password"],
	["payLoad", "payload"],
	["placeHolder", "placeholder"],
	["preView", "preview"],
	["screenShot", "screenshot"],
	["sideBar", "sidebar"],
	["subClass", "subclass"],
	["subDirectory", "subdirectory"],
	["subDomain", "subdomain"],
	["subMenu", "submenu"],
	["subProcess", "subprocess"],
	["subString", "substring"],
	["subTree", "subtree"],
	["subType", "subtype"],
	["subTitle", "subtitle"],
	["timeOut", "timeout"],
	["timeStamp", "timestamp"],
	["toolBar", "toolbar"],
	["toolKit", "toolkit"],
	["toolTip", "tooltip"],
	["touchScreen", "touchscreen"],
	["unSubscribe", "unsubscribe"],
	["underScore", "underscore"],
	["upLoad", "upload"],
	["userName", "username"],
	["viewPort", "viewport"],
	["webCam", "webcam"],
	["webHook", "webhook"],
	["webSite", "website"],
	["weekEnd", "weekend"],
	["whiteSpace", "whitespace"],
	["wildCard", "wildcard"],
	["workFlow", "workflow"],
	["workSpace", "workspace"],
];

const DEFAULT_REPLACEMENTS_MAP = new Map(DEFAULT_REPLACEMENTS);
const REGEXP_ESCAPE_PATTERN = /[\\^$.*+?()[\]{}|]/gu;
const BOUNDARY = String.raw`(?=$|[\d_$]|\p{Uppercase_Letter})`;

interface RuleOptions {
	readonly allowList: ReadonlySet<string>;
	readonly checkProperties: boolean;
	readonly checkShorthandProperties: boolean;
	readonly checkVariables: boolean;
	readonly replacementRegExp: RegExp | undefined;
	readonly replacements: ReadonlyMap<string, string>;
}

type RawOptions = NonNullable<InferContextFromRule<typeof consistentCompoundWords>["options"][0]>;

function escapeRegExp(value: string): string {
	return value.replaceAll(REGEXP_ESCAPE_PATTERN, String.raw`\$&`);
}

function upperFirst(value: string): string {
	const first = value.at(0);
	/* v8 ignore next -- replacement keys are non-empty identifiers in practice. @preserve */
	if (first === undefined) return value;
	return `${first.toUpperCase()}${value.slice(1)}`;
}

function lowerFirst(value: string): string {
	const first = value.at(0);
	/* v8 ignore next -- replacement keys are non-empty identifiers in practice. @preserve */
	if (first === undefined) return value;
	return `${first.toLowerCase()}${value.slice(1)}`;
}

function isUpperCase(value: string): boolean {
	return value === value.toUpperCase();
}

function isUpperFirst(value: string): boolean {
	const first = value.at(0);
	return first?.toUpperCase() === first && first !== undefined;
}

function buildReplacementRegExp(replacements: ReadonlyMap<string, string>): RegExp | undefined {
	if (replacements.size === 0) return undefined;
	const lowerFirstForms = new Array<string>();
	const upperFirstForms = new Array<string>();
	for (const discouragedName of replacements.keys()) {
		lowerFirstForms.push(escapeRegExp(discouragedName));
		upperFirstForms.push(escapeRegExp(upperFirst(discouragedName)));
	}
	return new RegExp(`(?:^(?:${lowerFirstForms.join("|")})|(?:${upperFirstForms.join("|")}))${BOUNDARY}`, "gu");
}

function parseReplacements(raw: RawOptions["replacements"] | undefined, extendDefault: boolean): Map<string, string> {
	const merged = new Map(extendDefault ? DEFAULT_REPLACEMENTS_MAP : undefined);
	if (!Predicate.isObject(raw)) return merged;
	for (const [key, value] of Object.entries(raw)) {
		if (value === false) {
			merged.delete(key);
			continue;
		}
		if (Predicate.isString(value) && value.length > 0) merged.set(key, value);
	}
	return merged;
}

function parseOptions(rawOptions: RawOptions | undefined): RuleOptions {
	const options = Predicate.isObject(rawOptions) ? rawOptions : {};
	const extendDefaultReplacements = options.extendDefaultReplacements !== false;
	const replacements = parseReplacements(options.replacements, extendDefaultReplacements);
	const allowList = new Set<string>();
	if (Predicate.isObject(options.allowList)) {
		for (const key of Object.keys(options.allowList)) allowList.add(key);
	}
	return {
		allowList,
		checkProperties: options.checkProperties === true,
		checkShorthandProperties: options.checkShorthandProperties === true,
		checkVariables: options.checkVariables !== false,
		replacementRegExp: buildReplacementRegExp(replacements),
		replacements,
	};
}

function getReplacementForPart(part: string, replacements: ReadonlyMap<string, string>): string | undefined {
	const replacement = replacements.get(part) ?? replacements.get(lowerFirst(part));
	/* v8 ignore next -- matched parts always come from the replacements map keys. @preserve */
	if (replacement === undefined) return undefined;
	return isUpperFirst(part) ? upperFirst(replacement) : lowerFirst(replacement);
}

function getNameReplacement(
	name: string,
	{ allowList, replacementRegExp, replacements }: RuleOptions,
): string | undefined {
	if (replacementRegExp === undefined || isUpperCase(name) || allowList.has(name)) return undefined;
	replacementRegExp.lastIndex = 0;
	/* v8 ignore next -- matched parts always resolve through the replacements map. @preserve */
	const replacement = name.replaceAll(replacementRegExp, (part) => getReplacementForPart(part, replacements) ?? part);
	return replacement === name ? undefined : replacement;
}

function isShorthandPropertyValue(node: ESTree.Node): boolean {
	const { parent } = node;
	return parent?.type === "Property" && parent.shorthand && parent.value === node;
}

function shouldReportPropertyIdentifier(node: ESTree.Node): boolean {
	const { parent } = node;
	/* v8 ignore next -- Identifier visitors always have parents in parser ASTs. @preserve */
	if (parent === null) return false;
	return (
		(parent.type === "Property" && parent.key === node && !parent.computed) ||
		(parent.type === "PropertyDefinition" && parent.key === node && !parent.computed) ||
		(parent.type === "MethodDefinition" && parent.key === node && !parent.computed)
	);
}

const consistentCompoundWords = createRule("consistent-compound-words", "naming", {
	create(context): Visitor {
		const options = parseOptions(context.options[0]);

		function reportName(node: ESTree.Node, name: string): void {
			const replacement = getNameReplacement(name, options);
			if (replacement === undefined) return;
			context.report({
				data: { name, replacement },
				messageId: "error",
				node,
			});
		}

		return {
			Identifier(node): void {
				if (
					!options.checkProperties ||
					node.name === "__proto__" ||
					node.parent.type === "ExportSpecifier" ||
					!shouldReportPropertyIdentifier(node)
				) {
					return;
				}
				reportName(node, node.name);
			},
			"Program:exit"(): void {
				if (!options.checkVariables) return;
				forEachScopeVariable(context.sourceCode, (variable) => {
					/* v8 ignore next -- scope variables without defs are not local bindings. @preserve */
					if (variable.defs.length === 0) return;
					const [definition] = variable.defs;
					/* v8 ignore next -- non-empty defs arrays always yield a first entry. @preserve */
					if (
						definition === undefined ||
						(!options.checkShorthandProperties && isShorthandPropertyValue(definition.name))
					) {
						return;
					}
					reportName(definition.name, variable.name);
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Enforce consistent spelling of compound words in identifiers.",
			recommended: false,
		},
		messages: {
			error: "Prefer `{{replacement}}` over `{{name}}`.",
			rename: "Rename to `{{replacement}}`.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowList: {
						additionalProperties: { enum: [true] },
						type: "object",
					},
					checkProperties: { type: "boolean" },
					checkShorthandProperties: { type: "boolean" },
					checkVariables: { type: "boolean" },
					extendDefaultReplacements: { type: "boolean" },
					replacements: {
						additionalProperties: {
							anyOf: [{ enum: [false] }, { minLength: 1, type: "string" }],
						},
						type: "object",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default consistentCompoundWords;
