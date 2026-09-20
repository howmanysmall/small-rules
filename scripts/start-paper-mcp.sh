#!/usr/bin/env bash

set -euo pipefail

function error() {
	printf '%s\n' "$*" >&2
}

function get-first-executable-in-path() {
	local candidate

	for candidate in "$@"; do
		if command -v "${candidate}" > /dev/null 2>&1; then
			command -v "${candidate}"
			return 0
		fi
	done

	return 1
}

function get-first-existing-file() {
	local candidate

	for candidate in "$@"; do
		if [[ -n "${candidate}" && -x "${candidate}" ]]; then
			printf '%s\n' "${candidate}"
			return 0
		fi
	done

	return 1
}

function resolve-macos-paper() {
	# Prefer the desktop .app over the CLI relay binary at ~/.paper/bin/paper:
	# the relay only exposes the MCP stdio server and does not launch the GUI,
	# which is what we need to bring the MCP HTTP endpoint up.
	get-first-existing-file \
		"/Applications/Paper.app/Contents/MacOS/Paper" \
		"$HOME/Applications/Paper.app/Contents/MacOS/Paper" \
		"$HOME/.paper/bin/paper"
}

function resolve-linux-paper() {
	local path

	if path="$(get-first-executable-in-path paper)"; then
		printf '%s\n' "${path}"
		return 0
	fi

	if path="$(get-first-existing-file \
		"$HOME/.paper/bin/paper" \
		"$HOME/.local/bin/paper")"; then
		printf '%s\n' "${path}"
		return 0
	fi

	return 1
}

function resolve-windows-paper() {
	local candidate
	local commandOutput

	if ! command -v cmd.exe > /dev/null 2>&1; then
		return 1
	fi

	for candidate in \
		'%LocalAppData%\Programs\Paper\Paper.exe' \
		'%ProgramFiles%\Paper\Paper.exe' \
		'%ProgramFiles(x86)%\Paper\Paper.exe' \
		'%LocalAppData%\paper\paper.exe' \
		'%LocalAppData%\paper\bin\paper.exe'; do
		if commandOutput="$(cmd.exe /c "if exist \"${candidate}\" (echo ${candidate}) else exit /b 1" 2> /dev/null)"; then
			commandOutput="${commandOutput%$'\r'}"
			printf '%s\n' "${commandOutput}"
			return 0
		fi
	done

	return 1
}

function resolve-paper-path() {
	local override
	local path
	local platform

	for override in "${PAPER_PATH:-}" "${PAPER_BIN:-}"; do
		if [[ -n "${override:-}" && -x "${override}" ]]; then
			printf '%s\n' "${override}"
			return 0
		fi
	done

	platform="$(uname -s 2> /dev/null || printf '%s' "${OS:-}")"

	case "${platform}" in
		Darwin)
			if path="$(resolve-macos-paper)"; then
				printf '%s\n' "${path}"
				return 0
			fi
			;;
		Linux)
			if path="$(resolve-linux-paper)"; then
				printf '%s\n' "${path}"
				return 0
			fi
			;;
		MINGW* | MSYS* | CYGWIN* | Windows_NT)
			if path="$(resolve-windows-paper)"; then
				printf '%s\n' "${path}"
				return 0
			fi
			;;
		*)
			error "Unsupported platform: ${platform}"
			return 1
			;;
	esac

	if path="$(get-first-executable-in-path paper)"; then
		printf '%s\n' "${path}"
		return 0
	fi

	return 1
}

# Probes whether the Paper MCP endpoint is reachable. Returns 0 when any HTTP
# response (even a 4xx/5xx) is returned, indicating the server is listening.
function probe-paper-mcp() {
	local url="$1"
	local connectTimeout="$2"

	curl --silent --output /dev/null \
		--connect-timeout "${connectTimeout}" \
		--max-time "$((connectTimeout + 1))" \
		"${url}"
}

# Launches Paper Desktop in the background so the script can proceed without
# blocking on its event loop. The subshell immediately returns, letting init
# adopt the spawned process when this script exits.
function launch-paper() {
	local path="$1"

	(nohup "${path}" > /dev/null 2>&1 &) || true
}

# Polls the Paper MCP endpoint until it responds or the deadline expires.
function wait-for-paper-mcp() {
	local url="$1"
	local waitTimeout="$2"
	local pollInterval="$3"
	local deadline=$((SECONDS + waitTimeout))

	while ((SECONDS < deadline)); do
		if probe-paper-mcp "${url}" 1; then
			return 0
		fi
		sleep "${pollInterval}"
	done

	return 1
}

paperMcpUrl="${PAPER_MCP_URL:-http://127.0.0.1:29979/mcp}"

case "${1:-}" in
	--print-path)
		if path="$(resolve-paper-path)"; then
			printf '%s\n' "${path}"
			exit 0
		fi
		error "Unable to locate a Paper executable."
		error "Set PAPER_PATH to override, or install Paper Desktop from https://paper.design/downloads."
		exit 1
		;;
esac

if probe-paper-mcp "${paperMcpUrl}" "${PAPER_MCP_PROBE_TIMEOUT:-1}"; then
	exit 0
fi

paperPath="$(resolve-paper-path)" || {
	error "Unable to locate a Paper executable."
	error "Set PAPER_PATH to override, or install Paper Desktop from https://paper.design/downloads."
	exit 1
}

launch-paper "${paperPath}"

if wait-for-paper-mcp "${paperMcpUrl}" "${PAPER_MCP_WAIT_TIMEOUT:-30}" "${PAPER_MCP_POLL_INTERVAL:-1}"; then
	exit 0
fi

error "Started Paper at ${paperPath}, but ${paperMcpUrl} did not become available."
error "Open a file in Paper Desktop to enable its local MCP server."
exit 1
