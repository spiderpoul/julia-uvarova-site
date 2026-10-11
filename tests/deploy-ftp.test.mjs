import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deploy, deploymentConfig, isExcluded, listSiteFiles, parseEnv } from '../scripts/deploy-ftp.mjs';

test('публикуем только HTML и разрешённые статические ресурсы', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deploy-ftp-test-'));
  try {
    const paths = [
      'index.html', 'books/index.html', 'assets/photo.webp', 'assets/drafts/old.jpg',
      'private/draft.html', 'AGENTS.md', 'agent.md', 'README.md', '.env', '.env.example',
      '.htaccess', '.git/config', 'node_modules/a.js', 'scripts/script.js',
      'tests/check.mjs', 'docs/file.md', 'site.css',
    ];
    for (const name of paths) {
      await mkdir(join(root, name, '..'), { recursive: true });
      await writeFile(join(root, name), 'test');
    }
    await writeFile(join(root, '.deployignore'), 'assets/drafts/\nprivate/\n');
    assert.deepEqual(await listSiteFiles(root), [
      '.htaccess', 'assets/photo.webp', 'books/index.html', 'index.html', 'site.css',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('шаблоны .deployignore исключают имена и относительные пути', () => {
  assert.equal(isExcluded('assets/temp-1.jpg', ['assets/temp-*.jpg']), true);
  assert.equal(isExcluded('books/draft.html', ['draft.html']), true);
  assert.equal(isExcluded('assets/photo.jpg', ['draft.html']), false);
  assert.equal(isExcluded('books/.env.secret', []), true);
  assert.equal(isExcluded('AGENTS.md', []), true);
});

test('читаем .env с кавычками и проверяем параметры', () => {
  const values = parseEnv('FTP_HOST=host\nFTP_USER=user\nFTP_PASSWORD="secret=#3"\nFTP_REMOTE_DIR=/www\n');
  assert.equal(values.FTP_PASSWORD, 'secret=#3');
  assert.equal(deploymentConfig(values).secure, true);
  assert.throws(() => deploymentConfig({ ...values, FTP_REMOTE_DIR: '../www' }), /FTP_REMOTE_DIR/);
  assert.throws(() => deploymentConfig({ ...values, FTP_PORT: 'oops' }), /FTP_PORT/);
});

test('загрузка создаёт каталоги, сохраняет пути, закрывает соединение', async () => {
  const log = [];
  class FakeClient {
    constructor(timeout) { log.push(['timeout', timeout]); }
    async access(config) { log.push(['access', config.host]); }
    async ensureDir(path) { log.push(['ensureDir', path]); }
    async pwd() { return '/home/site'; }
    async uploadFrom(local, remote) { log.push(['uploadFrom', local, remote]); }
    close() { log.push(['close']); }
  }
  await deploy('/tmp/site', ['index.html', 'books/index.html'], {
    timeout: 30000, host: 'example.com', user: 'user', password: 'secret',
    port: 21, secure: true, remoteDir: 'public_html',
  }, FakeClient);
  assert.deepEqual(log.filter(([name]) => name === 'ensureDir'), [
    ['ensureDir', 'public_html'],
    ['ensureDir', '/home/site'],
    ['ensureDir', '/home/site/books'],
  ]);
  assert.equal(log.filter(([name]) => name === 'uploadFrom').length, 2);
  assert.equal(log.at(-1)[0], 'close');
});