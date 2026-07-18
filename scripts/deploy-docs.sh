#!/usr/bin/env bash

set -euo pipefail

gh workflow run docs.yaml --ref main -f ref=main
