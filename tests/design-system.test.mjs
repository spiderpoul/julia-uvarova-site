import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { render, build } from '../scripts/build.mjs';
import { isExcluded } from '../scripts/deploy-ftp.mjs';

test('templates escape text and attributes; raw slots preserve markup', async () => {
  assert.equal(await render('{{title}} {{{body}}}', { title: '<test>"', body: '<p>Text</p>' }), '&lt;test&gt;&quot; <p>Text</p>');
  const html = await render(`{% include contact ${JSON.stringify({ title: 'Title', text: 'Text', label: 'A "quoted" <label>' })} %}`);
  assert.match(html, /&lt;label&gt;/);
  assert.match(html, /noopener noreferrer/);
  await assert.rejects(render('{{missing}}'), /Missing property/);
  await assert.rejects(render('{% include .. %}').then(html => { if (html.includes('{%')) throw new Error('Invalid directive'); }));
});

test('all generated pages are current and sources never deploy', async () => {
  assert.ok(await build({ check: true }) >= 12);
  assert.ok(isExcluded('src/pages/example/index.html'));
  assert.ok(isExcluded('docs/example.html'));
});

test('Metrika loads and initializes once even when included twice', async () => {
  const code = await readFile(new URL('../assets/yandex-metrika.js', import.meta.url), 'utf8');
  for (const existing of [false, true]) {
    const inserted = [];
    const url = 'https://mc.yandex.ru/metrika/tag.js?id=114077657';
    const first = { src: existing ? url : '/assets/yandex-metrika.js', parentNode: { insertBefore: script => inserted.push(script) } };
    const document = { scripts: [first], referrer: 'https://example.com/', createElement: () => ({}), getElementsByTagName: () => [first] };
    const window = { location: { href: 'https://julia-uvarova.ru/books/' } };
    const context = vm.createContext({ window, document });
    vm.runInContext(code, context); vm.runInContext(code, context);
    assert.equal(inserted.length, existing ? 0 : 1);
    assert.equal(window.ym.a.length, 1);
    assert.equal(window.ym.a[0][0], 114077657);
    assert.equal(window.ym.a[0][2].webvisor, true);
    assert.equal(window.ym.a[0][2].referrer, document.referrer);
  }
});

test('every built page has exactly one shared counter and a noscript fallback', async () => {
  const { readdir } = await import('node:fs/promises');
  async function visit(directory, relative = '') {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = `${relative}${item.name}`;
      if (item.isDirectory()) { await visit(new URL(`${item.name}/`, directory), `${path}/`); continue; }
      if (!path.endsWith('.html')) continue;
      const html = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
      assert.equal((html.match(/src="\/assets\/yandex-metrika.js"/g) || []).length, 1, path);
      assert.equal((html.match(/https:\/\/mc.yandex.ru\/watch\/114077657/g) || []).length, 1, path);
      assert.ok(!html.includes('{%'), path);
      for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) {
        await readFile(new URL(`..${asset}`, import.meta.url));
      }
    }
  }
  await visit(new URL('../src/pages/', import.meta.url));
});
