#!/bin/bash
# Workaround for npm global git install bug that doesn't copy all files
# Clone, install, and link instead

set -e

rm -rf /tmp/sync-skills-npm-test
git clone --depth 1 https://github.com/viteinfinite/sync-skills.git /tmp/sync-skills-npm-test
cd /tmp/sync-skills-npm-test
npm install
npm link
sync-skills --help
