#!/bin/sh
set -eu

task_test_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_project="signal-shop-olist-test-$$"

cleanup() {
  docker compose -p "$task_project" -f "$task_test_dir/docker-compose.test.yml" down --volumes --remove-orphans >/dev/null
}
trap cleanup EXIT

docker compose -p "$task_project" -f "$task_test_dir/docker-compose.test.yml" run --rm assertions
