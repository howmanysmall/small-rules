import type { Octokit } from "@octokit/rest";

export interface DownloadOptions {
	readonly branch?: string | undefined;
	readonly owner: string;
	readonly path: string;
	readonly repository: string;
}

export async function downloadGitHubFileAsync(
	octokit: Octokit,
	{ branch = "main", owner, path, repository }: DownloadOptions,
): Promise<Uint8Array> {
	const { data } = await octokit.rest.repos.getContent({
		owner,
		path,
		ref: branch,
		repo: repository,
	});

	if (Array.isArray(data)) throw new TypeError(`"${path}" is a directory, not a file`);
	if (data.type !== "file") throw new TypeError(`Unexpected content type "${data.type}" for "${path}"`);

	const raw = atob(data.content);
	const bytes = new Uint8Array(raw.length);
	for (let index = 0; index < raw.length; index += 1) {
		const byte = raw.codePointAt(index);
		if (byte === undefined) throw new Error(`Failed to decode character at position ${index} in "${path}"`);
		bytes[index] = byte;
	}

	return bytes;
}
