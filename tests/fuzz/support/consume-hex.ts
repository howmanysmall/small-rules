import type { FuzzedDataProvider } from "@vitiate/fuzzed-data-provider";

export function consumeHex(provider: FuzzedDataProvider, byteCount: number): string {
	return Buffer.from(provider.consumeBytes(byteCount)).toString("hex");
}
