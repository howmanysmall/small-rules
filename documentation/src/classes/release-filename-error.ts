export class ReleaseFilenameError extends Error {
	public override readonly name = "ReleaseFilenameError";

	public constructor(id: string, errorOptions?: ErrorOptions) {
		super(`Release filename "${id}" must use the v<major>.<minor>.<patch>.md format.`, errorOptions);
	}
}
