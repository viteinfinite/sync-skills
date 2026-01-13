#!/usr/bin/env node

import minimist from 'minimist';
import { run } from '../src/index.js';

const argv = minimist(process.argv.slice(2), {
  boolean: ['fail-on-conflict', 'dry-run', 'verbose', 'watch', 'help', 'home', 'reconfigure'],
  alias: {
    'fail-on-conflict': 'f',
    'dry-run': 'd',
    'verbose': 'v',
    'watch': 'w',
    'help': 'h',
    'home': 'H',
    'reconfigure': 'r'
  }
});

if (argv.help) {
  console.log(`
sync-skills - Synchronize agent skills

Usage:
  sync-skills [options]

Options:
  --fail-on-conflict, -f    Fail on conflicts instead of interactive mode
  --dry-run, -d             Show changes without applying
  --verbose, -v             Verbose output
  --watch, -w               Watch mode
  --home, -H                Use home directory configuration
  --reconfigure, -r         Reconfigure settings
  --targets <list>          Comma-separated list of targets (claude,codex)
  --help, -h                Show this help

Examples:
  sync-skills                              # Interactive sync
  sync-skills --fail-on-conflict           # Fail on conflicts
  sync-skills --dry-run                    # Preview changes
  sync-skills --home                       # Use home config
  sync-skills --reconfigure                # Reconfigure settings
  `);
  process.exit(0);
}

await run({
  failOnConflict: argv['fail-on-conflict'],
  dryRun: argv['dry-run'],
  verbose: argv.verbose,
  watch: argv.watch,
  homeMode: argv.home,
  reconfigure: argv.reconfigure,
  targets: argv.targets ? argv.targets.split(',') : ['claude', 'codex']
});
