#!/usr/bin/env node

import minimist from 'minimist';
import { run } from '../src/index.js';

const argv = minimist(process.argv.slice(2), {
  boolean: ['fail-on-conflict', 'dry-run', 'help', 'home', 'reconfigure'],
  alias: {
    'fail-on-conflict': 'f',
    'dry-run': 'd',
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
  --home, -H                Use home directory configuration
  --reconfigure, -r         Reconfigure settings
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

try {
  await run({
    failOnConflict: argv['fail-on-conflict'],
    dryRun: argv['dry-run'],
    homeMode: argv.home,
    reconfigure: argv.reconfigure
  });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${errorMessage}`);
  process.exit(1);
}
