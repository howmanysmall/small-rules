import { useEffect, useId, useRef } from "react";

import type { ChangeEvent, ReactElement, SyntheticEvent } from "react";

import type { RuleIndexCategory } from "./rule-index-data";

const allCategoriesOption = <option value="">{"All categories"}</option>;
const resetButton = (
	<button className="rule-index-reset" type="reset">
		{"Reset filters"}
	</button>
);

export interface RuleIndexFiltersProperties {
	readonly categories: ReadonlyArray<RuleIndexCategory>;
	readonly onCategoryChange: (event: ChangeEvent<HTMLSelectElement>) => void;
	readonly onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
	readonly onReset: (event: SyntheticEvent<HTMLFormElement>) => void;
	readonly query: string;
	readonly selectedCategory: string;
}

export function RuleIndexFilters({
	categories,
	onCategoryChange,
	onQueryChange,
	onReset,
	query,
	selectedCategory,
}: RuleIndexFiltersProperties): ReactElement {
	const filters = useRef<HTMLFormElement>(null);
	const searchId = useId();
	const categoryId = useId();
	const initiallyHidden = true;

	useEffect(function revealFilters() {
		filters.current?.removeAttribute("hidden");
	}, []);

	return (
		<form
			aria-label="Filter rules"
			className="rule-index-filters"
			data-rule-filters=""
			hidden={initiallyHidden}
			onReset={onReset}
			ref={filters}
		>
			<div className="rule-index-field rule-index-field--search">
				<label htmlFor={searchId}>{"Search rules"}</label>
				<input
					autoComplete="off"
					data-rule-search=""
					id={searchId}
					name="query"
					onChange={onQueryChange}
					placeholder="Try no-print"
					type="search"
					value={query}
				/>
			</div>
			<div className="rule-index-field">
				<label htmlFor={categoryId}>{"Category"}</label>
				<select
					data-rule-category=""
					id={categoryId}
					name="category"
					onChange={onCategoryChange}
					value={selectedCategory}
				>
					{allCategoriesOption}
					{/* biome-ignore lint/performance/useSolidForComponent: This is a React component. */}
					{categories.map((category) => (
						<option key={category.key} value={category.key}>
							{category.label}
						</option>
					))}
				</select>
			</div>
			{resetButton}
		</form>
	);
}
