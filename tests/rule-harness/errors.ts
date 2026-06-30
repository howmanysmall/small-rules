export function createHarnessError(message: string): Error {
	const error = new Error(message);
	Error.captureStackTrace(error, createHarnessError);
	return error;
}

export function throwHarnessError(message: string): never {
	throw createHarnessError(message);
}
