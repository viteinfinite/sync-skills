import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const binPath = resolve(rootDir, 'dist', 'bin', 'sync-skills.js');

if (!existsSync(binPath)) {
  console.log('sync-skills: build output missing; running npm run build');
  execFileSync('npm', ['run', 'build'], { cwd: rootDir, stdio: 'inherit' });
}
