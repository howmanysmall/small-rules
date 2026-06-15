import type { Octokit } from "@octokit/rest";

export interface DownloadOptions {
	readonly branch?: string;
	readonly owner: string;
	readonly path: string;
	readonly repository: string;
}

export async function downloadGitHubFileAsync(
	octokit: Octokit,
	{ owner, repository, path, branch = "main" }: DownloadOptions,
): Promise<Uint8Array> {
	const { data } = await octokit.rest.repos.getContent({
		owner,
		path,
		ref: branch,
		repo: repository,
	});

	if (Array.isArray(data)) {
		const error = new TypeError(`"${path}" is a directory, not a file`);
		Error.captureStackTrace(error, downloadGitHubFileAsync);
		throw error;
	}

	if (data.type !== "file") {
		const error = new TypeError(`Unexpected content type "${data.type}" for "${path}"`);
		Error.captureStackTrace(error, downloadGitHubFileAsync);
		throw error;
	}

	const raw = atob(data.content);
	const bytes = new Uint8Array(raw.length);
	for (let index = 0; index < raw.length; index += 1) {
		const byte = raw.codePointAt(index);
		if (byte === undefined) {
			const error = new Error(`Failed to decode character at position ${index} in "${path}"`);
			Error.captureStackTrace(error, downloadGitHubFileAsync);
			throw error;
		}
		bytes[index] = byte;
	}

	return bytes;
}
