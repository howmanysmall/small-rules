export function evilTernary<TValue>(conditional: boolean, trueValue: TValue, falseValue: TValue): TValue {
	return conditional ? trueValue : falseValue;
}
