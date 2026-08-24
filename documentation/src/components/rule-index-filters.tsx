import { useEffect, useId, useRef } from "react";

import type { ChangeEvent, ReactNode, SyntheticEvent } from "react";

import type { RuleIndexCategory } from "./rule-index-data";

const ALL_CATEGORIES = <option value="">{"All categories"}</option>;
const RESET_BUTTON = (
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
}: RuleIndexFiltersProperties): ReactNode {
	const filtersRef = useRef<HTMLFormElement>(null);
	const searchId = useId();
	const categoryId = useId();
	const initiallyHidden = true;

	useEffect(function revealFilters() {
		filtersRef.current?.removeAttribute("hidden");
	}, []);

	return (
		<form
			ref={filtersRef}
			aria-label="Filter rules"
			className="rule-index-filters"
			data-rule-filters=""
			hidden={initiallyHidden}
			onReset={onReset}
		>
			<div className="rule-index-field rule-index-field--search">
				<label htmlFor={searchId}>{"Search rules"}</label>
				<input
					autoComplete="off"
					data-rule-search=""
					id={searchId}
					name="query"
					placeholder="Try no-print"
					type="search"
					value={query}
					onChange={onQueryChange}
				/>
			</div>
			<div className="rule-index-field">
				<label htmlFor={categoryId}>{"Category"}</label>
				<select
					data-rule-category=""
					id={categoryId}
					name="category"
					value={selectedCategory}
					onChange={onCategoryChange}
				>
					{ALL_CATEGORIES}
					{categories.map((category) => (
						<option key={category.key} value={category.key}>
							{category.label}
						</option>
					))}
				</select>
			</div>
			{RESET_BUTTON}
		</form>
	);
}
