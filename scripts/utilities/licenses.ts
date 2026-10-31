import { isMaybeString, isReadonlyArrayOfStrings, isString } from "@small-rules/arktype-utilities";
import { type } from "arktype";
import parseSpdx from "spdx-expression-parse";

export interface LicensedPackage {
	readonly name: string;
	readonly license: string;
	readonly version: string;
}

/**
 * Allows one package whose license the tiers reject. The license must match
 * the reported string exactly, so a relicense surfaces as a new failure.
 */
export interface LicenseException {
	readonly license: string;
	/** A package name; a trailing `*` matches any suffix. */
	readonly package: string;
	readonly reason: string;
}

export interface ScopedLicense {
	readonly license: string;
	/** A package name; a trailing `*` matches any suffix. */
	readonly packages: string;
}

export interface LicenseTier {
	readonly name: string;
	readonly allowed: ReadonlyArray<string>;
	readonly scoped: ReadonlyArray<ScopedLicense>;
}

export interface LicensePolicy {
	readonly exceptions: ReadonlyArray<LicenseException>;
	/** Strictest first: a package in several tiers is judged by the first. */
	readonly tiers: ReadonlyArray<LicenseTier>;
}

export type LicenseReport = Readonly<Partial<Record<string, ReadonlyArray<LicensedPackage>>>>;

export interface LicenseFailure extends LicensedPackage {
	readonly reason: string;
	readonly tier: string;
}

export interface LicenseEvaluation {
	readonly checked: number;
	readonly failures: ReadonlyArray<LicenseFailure>;
	readonly staleExceptions: ReadonlyArray<LicenseException>;
}

const isPnpmLicenseReport = type
	.Record(
		isString,
		type({ name: isString, "license?": isMaybeString, versions: isReadonlyArrayOfStrings }).array().readonly(),
	)
	.readonly();

/**
 * Parses `pnpm licenses list --json` output into one entry per installed
 * version.
 *
 * @param stdout - What pnpm printed.
 * @returns Every package version with its license string.
 */
export function parseLicenseReport(stdout: string): ReadonlyArray<LicensedPackage> {
	const report = isPnpmLicenseReport(JSON.parse(stdout));
	if (report instanceof type.errors) {
		throw new TypeError(`pnpm licenses list returned an unexpected shape: ${report.summary}`);
	}

	return Object.values(report).flatMap((entries) =>
		entries.flatMap(({ name, license = "", versions }) => versions.map((version) => ({ name, license, version }))),
	);
}

function matchesPackage(pattern: string, name: string): boolean {
	return pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern;
}

function isSatisfied(info: parseSpdx.Info, allowed: ReadonlySet<string>): boolean {
	if ("conjunction" in info) {
		const left = isSatisfied(info.left, allowed);
		const right = isSatisfied(info.right, allowed);
		return info.conjunction === "and" ? left && right : left || right;
	}

	// `WITH` grants extra permissions and `+` admits later versions, so the
	// base license alone decides.
	return allowed.has(info.license);
}

function findProblem(license: string, allowed: ReadonlySet<string>): string | undefined {
	if (license.trim().length === 0) return "license is missing";

	let info: parseSpdx.Info;
	try {
		info = parseSpdx(license);
	} catch {
		return "license is not a valid SPDX expression";
	}

	return isSatisfied(info, allowed) ? undefined : "license is not allowed";
}

function getAllowedLicenses(tier: LicenseTier, name: string): ReadonlySet<string> {
	const allowed = new Set(tier.allowed);
	for (const scoped of tier.scoped) {
		if (matchesPackage(scoped.packages, name)) {
			allowed.add(scoped.license);
		}
	}

	return allowed;
}

function findException(
	exceptions: ReadonlyArray<LicenseException>,
	{ name, license }: LicensedPackage,
): LicenseException | undefined {
	return exceptions.find((exception) => exception.license === license && matchesPackage(exception.package, name));
}

/**
 * Checks every package's license against the tier it ships in.
 *
 * @param report - Installed packages keyed by tier name.
 * @param policy - Allowed licenses per tier and package-level exceptions.
 * @returns The packages that fail, and the exceptions that excused nothing.
 */
export function evaluateLicenses(report: LicenseReport, policy: LicensePolicy): LicenseEvaluation {
	const judged = new Set<string>();
	const usedExceptions = new Set<LicenseException>();
	const failures = new Array<LicenseFailure>();

	for (const tier of policy.tiers) {
		const licensedPackages = report[tier.name] ?? [];
		for (const licensedPackage of licensedPackages) {
			const key = `${licensedPackage.name}@${licensedPackage.version}`;
			if (judged.has(key)) continue;
			judged.add(key);

			const reason = findProblem(licensedPackage.license, getAllowedLicenses(tier, licensedPackage.name));
			if (reason === undefined) continue;

			const exception = findException(policy.exceptions, licensedPackage);
			if (exception === undefined) {
				failures.push({ ...licensedPackage, reason, tier: tier.name });
			} else {
				usedExceptions.add(exception);
			}
		}
	}

	return {
		checked: judged.size,
		failures,
		staleExceptions: policy.exceptions.filter((exception) => !usedExceptions.has(exception)),
	};
}
