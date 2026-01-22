#!/usr/bin/env node

import minimist from 'minimist';
import { run } from '../src/index.js';
import { VERSION } from '../src/version.js';

const argv = minimist(process.argv.slice(2), {
  boolean: ['fail-on-conflict', 'help', 'home', 'install-self-skill', 'list', 'reconfigure', 'version'],
  alias: {
    'fail-on-conflict': 'f',
    'help': 'h',
    'home': 'H',
    'install-self-skill': 's',
    'list': 'l',
    'reconfigure': 'r',
    'version': 'v'
  }
});

if (argv.version) {
  console.log(VERSION);
  process.exit(0);
}

if (argv.help) {
  console.log(`
sync-skills - Synchronize agent skills

Usage:
  sync-skills [options]

Options:
  --fail-on-conflict, -f    Fail on conflicts instead of interactive mode
  --home, -H                Use home directory configuration
  --install-self-skill, -s  Install sync-skills documentation skill
  --list, -l                List installed skills
  --reconfigure, -r         Reconfigure settings
  --version, -v             Show version
  --help, -h                Show this help

Examples:
  sync-skills                              # Interactive sync
  sync-skills --list                       # List installed skills
  sync-skills --home --list                # List skills in home dir
  sync-skills --fail-on-conflict           # Fail on conflicts
  sync-skills --home                       # Use home config
  sync-skills --reconfigure                # Reconfigure settings
  sync-skills --install-self-skill         # Install sync-skills skill
  sync-skills --version                    # Show version
  `);
  process.exit(0);
}

try {
  await run({
    failOnConflict: argv['fail-on-conflict'],
    homeMode: argv.home,
    reconfigure: argv.reconfigure,
    listMode: argv.list,
    installSelfSkill: argv['install-self-skill']
  });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${errorMessage}`);
  process.exit(1);
}
