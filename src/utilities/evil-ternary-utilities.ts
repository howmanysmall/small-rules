export function chooseWithEvilTernary<TValue>(conditional: boolean, trueValue: TValue, falseValue: TValue): TValue {
	return conditional ? trueValue : falseValue;
}
