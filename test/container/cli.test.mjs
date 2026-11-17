import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cli = resolve('dist/bin/sync-skills.js');

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'sync-skills-container-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.sync-skills'), { recursive: true });
  await writeFile(join(root, '.sync-skills/config.json'), JSON.stringify({
    version: 1,
    assistants: ['claude', 'codex'],
  }));
  await mkdir(join(root, '.claude/skills/example'), { recursive: true });
  await mkdir(join(root, '.codex/skills'), { recursive: true });
  await writeFile(join(root, '.claude/skills/example/SKILL.md'),
    '---\nname: example\ndescription: Container test skill\n---\n\nOriginal instructions\n');
  await mkdir(join(root, '.claude/skills/example/docs'), { recursive: true });
  await writeFile(join(root, '.claude/skills/example/docs/guide.txt'), 'Supporting content\n');
  return root;
}

function runCli(root, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, HOME: root, NO_COLOR: '1' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });
  if (result.error) throw result.error;
  return result;
}

function assertSuccess(result) {
  assert.equal(result.status, 0, `CLI failed: ${result.stderr}\n${result.stdout}`);
}

test('CLI synchronizes a single-source skill and supporting file across assistants', async (t) => {
  const root = await workspace(t);
  assertSuccess(runCli(root, '--fail-on-conflict'));

  const common = join(root, '.sync-skills/skills/example');
  assert.match(await readFile(join(common, 'SKILL.md'), 'utf8'), /Original instructions/);
  assert.equal(await readFile(join(common, 'docs/guide.txt'), 'utf8'), 'Supporting content\n');
  for (const assistant of ['claude', 'codex']) {
    const path = join(root, `.${assistant}/skills/example/SKILL.md`);
    assert.match(await readFile(path, 'utf8'), /@\.\.\/\.\.\/\.\.\/\.sync-skills\/skills\/example\/SKILL\.md/);
  }
  assertSuccess(runCli(root, '--fail-on-conflict'));
  const listing = runCli(root, '--list');
  assertSuccess(listing);
  assert.match(listing.stdout, /example/);
});

test('CLI reports an out-of-sync edit without replacing the shared skill', async (t) => {
  const root = await workspace(t);
  assertSuccess(runCli(root, '--fail-on-conflict'));
  const common = join(root, '.sync-skills/skills/example/SKILL.md');
  const before = await readFile(common, 'utf8');
  const platform = join(root, '.claude/skills/example/SKILL.md');
  await writeFile(platform, (await readFile(platform, 'utf8')).replace(
    '@../../../.sync-skills/skills/example/SKILL.md', 'Changed instructions'));

  const result = runCli(root, '--fail-on-conflict');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /out.of.sync/i);
  assert.equal(await readFile(common, 'utf8'), before);
});

test('CLI preserves a conflicting pre-existing target supporting file', async (t) => {
  const root = await workspace(t);
  const targetDir = join(root, '.codex/skills/example/docs');
  await mkdir(targetDir, { recursive: true });
  const targetFile = join(targetDir, 'guide.txt');
  await writeFile(targetFile, 'Different target content\n');

  const result = runCli(root, '--fail-on-conflict');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /conflict/i);
  assert.equal(await readFile(targetFile, 'utf8'), 'Different target content\n');
});

test('CLI does not copy supporting files through a target symlink', async (t) => {
  const root = await workspace(t);
  const outside = join(root, 'outside');
  await mkdir(outside);
  await mkdir(join(root, '.codex/skills/example'), { recursive: true });
  await symlink(outside, join(root, '.codex/skills/example/docs'));

  const result = runCli(root, '--fail-on-conflict');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /non-directory/);
  await assert.rejects(readFile(join(outside, 'guide.txt')), { code: 'ENOENT' });
});
