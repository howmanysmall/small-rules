import { useState } from "react";

import { RuleIndexCard } from "./rule-index-card";
import { RuleIndexFilters } from "./rule-index-filters";

import type { ChangeEvent, ReactNode, SyntheticEvent } from "react";

import type { RuleIndexCategory } from "./rule-index-data";

export interface RuleIndexProperties {
	readonly categories: ReadonlyArray<RuleIndexCategory>;
	readonly mode: "catalog" | "category";
}

const EMPTY_STATE = (
	<p className="rule-index-empty" data-rule-empty="">
		{"No rules match those filters."}
	</p>
);

export function RuleIndex({ categories, mode }: RuleIndexProperties): ReactNode {
	const [query, setQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("");
	const rules = categories.flatMap((category) => category.rules);
	const normalizedQuery = query.trim().toLowerCase();
	const visibleRules = rules.filter(
		(rule) =>
			`${rule.name} ${rule.title} ${rule.description}`.toLowerCase().includes(normalizedQuery) &&
			(selectedCategory === "" || rule.category === selectedCategory),
	);

	function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>): void {
		setSelectedCategory(event.currentTarget.value);
	}

	function handleQueryChange(event: ChangeEvent<HTMLInputElement>): void {
		setQuery(event.currentTarget.value);
	}

	function handleReset(event: SyntheticEvent<HTMLFormElement>): void {
		event.preventDefault();
		setQuery("");
		setSelectedCategory("");
	}

	return (
		<div className="rule-index" data-rule-index="">
			{mode === "catalog" && (
				<RuleIndexFilters
					categories={categories}
					onCategoryChange={handleCategoryChange}
					onQueryChange={handleQueryChange}
					onReset={handleReset}
					query={query}
					selectedCategory={selectedCategory}
				/>
			)}

			<p aria-atomic="true" aria-live="polite" className="rule-index-count" data-rule-count="">
				{`Showing ${visibleRules.length} ${visibleRules.length === 1 ? "rule" : "rules"}`}
			</p>

			<div className="rule-index-grid">
				{visibleRules.map((rule) => (
					<RuleIndexCard key={rule.path} rule={rule} />
				))}
			</div>

			{visibleRules.length === 0 && EMPTY_STATE}
		</div>
	);
}
