import { ruleExamples } from "$data/rule-examples";
import { formatRuleTitle, ruleManifest } from "$data/rule-manifest";

import smallRules from "../../../src/index";
import { readRepositoryFile } from "./repository";
import { compareStrings } from "./types";

import type { RuleCategoryKey, RuleName } from "$data/rule-manifest";

import type { RuleCard, RuleCardExample } from "./types";

const inlineCodePattern = /`(?<code>[^`]+)`/gu;
const oxcUtilitiesPattern = /\$oxc-utilities\/(?<utility>[^"]+)"/gu;
const rationalePattern = /<Fragment slot="rationale">(?<rationale>[\s\S]*?)<\/Fragment>/u;
const whitespacePattern = /\s+/gu;

const exampleKinds = ["invalid", "valid"] satisfies ReadonlyArray<RuleCardExample["kind"]>;
const maxExamplesPerKind = 2;

function extractRationale(sourceText: string): string {
	const content = rationalePattern.exec(sourceText)?.groups?.rationale ?? "";
	return stripDelimitedSections(replaceMarkdownLinks(content), "<", ">")
		.replaceAll(inlineCodePattern, "$<code>")
		.replaceAll(whitespacePattern, " ")
		.trim();
}

function replaceMarkdownLinks(value: string): string {
	let result = "";
	let cursor = 0;
	while (cursor < value.length) {
		const labelStart = value.indexOf("[", cursor);
		if (labelStart === -1) return result + value.slice(cursor);
		const labelEnd = value.indexOf("](", labelStart + 1);
		const linkEnd = labelEnd === -1 ? -1 : value.indexOf(")", labelEnd + 2);
		if (labelEnd === -1 || linkEnd === -1) return result + value.slice(cursor);
		result += value.slice(cursor, labelStart) + value.slice(labelStart + 1, labelEnd);
		cursor = linkEnd + 1;
	}
	return result;
}

function stripDelimitedSections(value: string, opening: string, closing: string): string {
	let result = "";
	let cursor = 0;
	while (cursor < value.length) {
		const sectionStart = value.indexOf(opening, cursor);
		if (sectionStart === -1) return result + value.slice(cursor);
		const sectionEnd = value.indexOf(closing, sectionStart + opening.length);
		if (sectionEnd === -1) return result + value.slice(cursor);
		result += `${value.slice(cursor, sectionStart)} `;
		cursor = sectionEnd + closing.length;
	}
	return result;
}

function extractSharedUtilities(sourceText: string): ReadonlyArray<string> {
	const utilities = new Set<string>();
	for (const match of sourceText.matchAll(oxcUtilitiesPattern)) {
		const specifier = match.groups?.utility;
		if (specifier !== undefined) utilities.add(specifier);
	}
	return [...utilities].toSorted(compareStrings);
}

function toCardExamples(name: RuleName): ReadonlyArray<RuleCardExample> {
	const examples = ruleExamples.get(name) ?? [];
	return exampleKinds.flatMap((kind) =>
		examples
			.filter((example) => example.kind === kind)
			.toSorted((left, right) => compareStrings(left.id, right.id))
			.slice(0, maxExamplesPerKind)
			.map((example) => ({ code: example.code, kind: example.kind, title: example.title })),
	);
}

function buildRuleCard(category: RuleCategoryKey, name: RuleName): RuleCard {
	const { meta } = smallRules.rules[name];
	if (meta === undefined) throw new Error(`Rule "${name}" is missing metadata.`);

	const rationaleSource = readRepositoryFile(`documentation/src/content/docs/rules/${category}/${name}.mdx`);
	const ruleSource = readRepositoryFile(`src/rules/${category}/${name}.ts`);

	return {
		name,
		category,
		description: meta.docs?.description ?? "<MISSING-DESCRIPTION>",
		examples: toCardExamples(name),
		messages: Object.values(meta.messages ?? {}).toSorted(compareStrings),
		options: JSON.stringify(meta.schema ?? []),
		rationale: extractRationale(rationaleSource),
		sharedUtilities: extractSharedUtilities(ruleSource),
		title: formatRuleTitle(name),
	};
}

export function buildRuleCards(): ReadonlyMap<RuleName, RuleCard> {
	const cards = new Map<RuleName, RuleCard>();
	for (const category of ruleManifest.categories) {
		for (const entry of category.rules) {
			cards.set(entry.name, buildRuleCard(category.key, entry.name));
		}
	}
	return cards;
}
