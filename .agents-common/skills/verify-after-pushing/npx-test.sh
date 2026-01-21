#!/bin/bash
set -e

rm -rf /tmp/sync-skills-npx-test
mkdir -p /tmp/sync-skills-npx-test
cd /tmp/sync-skills-npx-test
npx github:viteinfinite/sync-skills --help
