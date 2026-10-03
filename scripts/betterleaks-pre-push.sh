#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2> /dev/null || pwd)"

# betterleaks does not auto-discover .betterleaks.toml, so the config path is
# passed explicitly. Without it the scan runs on the built-in ruleset only and
# every historical false positive fails the first push of a new branch.
betterleaks_config=.betterleaks.toml

status=0
while read -r local_ref local_sha remote_ref remote_sha extra; do
	if [[ -z ${local_ref} ]]; then
		continue
	fi
	if [[ -n ${extra} || -z ${remote_ref} || ! ${local_sha} =~ ^[[:xdigit:]]{40,64}$ || ! ${remote_sha} =~ ^[[:xdigit:]]{40,64}$ ]]; then
		printf '%s\n' 'Invalid pre-push ref record.' >&2
		exit 1
	fi
	if [[ ${local_sha} =~ ^0+$ ]]; then
		continue
	fi

	local_commit=$(git rev-parse --verify "${local_sha}^{commit}")
	if [[ ${remote_sha} =~ ^0+$ ]]; then
		# A new ref can publish any part of its history, including older secrets.
		range=${local_commit}
	elif remote_commit=$(git rev-parse --verify "${remote_sha}^{commit}" 2> /dev/null); then
		range=${remote_commit}..${local_commit}
	else
		# The remote object may be absent locally after a forced update.
		range=${local_commit}
	fi

	if betterleaks git --config "${betterleaks_config}" --redact --no-banner --log-opts="${range}"; then
		continue
	else
		status=$?
	fi
done

exit "${status}"
