import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    ...options,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

test('root can install the package globally and sync skills in root home', async (t) => {
  // Never perform a system installation on the host, even if run directly.
  assert.equal(process.env.SYNC_SKILLS_CONTAINER_TESTS, '1', 'Run this test via the Podman test image');
  assert.equal(process.platform, 'linux');
  assert.equal(process.getuid?.(), 0, 'The test container must run as root');
  await access('/run/.containerenv');

  const archiveDir = await mkdtemp(join(tmpdir(), 'sync-skills-package-'));
  t.after(() => rm(archiveDir, { recursive: true, force: true }));
  const archiveInfo = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', archiveDir]));
  const archive = join(archiveDir, archiveInfo[0].filename);
  run('npm', ['install', '--global', '--prefix', '/usr/local', archive]);
  const cli = '/usr/local/bin/sync-skills';
  assert.match(run(cli, ['--help']), /Synchronize agent skills/);

  const home = '/root';
  const claude = join(home, '.claude/skills/root-example');
  const codex = join(home, '.codex/skills');
  const common = join(home, '.sync-skills');
  for (const path of [join(home, '.claude'), join(home, '.codex'), common]) {
    await assert.rejects(access(path), { code: 'ENOENT' }, `Expected a clean container: ${path}`);
  }
  await mkdir(claude, { recursive: true });
  await mkdir(codex, { recursive: true });
  await mkdir(common);
  await writeFile(join(common, 'config.json'), JSON.stringify({ version: 1, assistants: ['claude', 'codex'] }));
  await writeFile(join(claude, 'SKILL.md'), '---\nname: root-example\ndescription: Root test\n---\n\nRoot instructions\n');
  await writeFile(join(claude, 'guide.txt'), 'Root supporting file\n');

  const options = { cwd: '/', env: { ...process.env, HOME: home, NO_COLOR: '1' } };
  run(cli, ['--home', '--fail-on-conflict'], options);
  assert.match(await readFile(join(common, 'skills/root-example/SKILL.md'), 'utf8'), /Root instructions/);
  assert.equal(await readFile(join(common, 'skills/root-example/guide.txt'), 'utf8'), 'Root supporting file\n');
  assert.match(await readFile(join(codex, 'root-example/SKILL.md'), 'utf8'), /\.sync-skills\/skills\/root-example\/SKILL\.md/);
  run(cli, ['--home', '--fail-on-conflict'], options);
  assert.match(run(cli, ['--home', '--list'], options), /root-example/);
});
