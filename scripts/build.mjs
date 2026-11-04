import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export async function render(template, props = {}, stack = [], root = ROOT) {
  // Resolve outer values before parsing nested includes (JSON-escape substitutions there).
  template = template.replace(/{% include ([a-z][a-z0-9-]*)(?: (.*?))? %}/g, (all, name, json) => {
    if (!json) return all;
    const data = JSON.parse(json);
    for (const key of Object.keys(data)) {
      data[key] = data[key].replace(/{{(\w+)}}/g, (_, field) => {
        if (!(field in props)) throw new Error(`Missing property: ${field}`);
        return props[field];
      });
    }
    return `{% include ${name} ${JSON.stringify(data)} %}`;
  });
  const pattern = /{% include ([a-z][a-z0-9-]*)(?: (.*?))? %}/g;
  let output = '', offset = 0;
  for (const match of template.matchAll(pattern)) {
    const [, name, json] = match;
    if (stack.includes(name)) throw new Error(`Circular include: ${[...stack, name].join(' -> ')}`);
    output += template.slice(offset, match.index);
    output += await render(await readFile(join(root, 'src/components', `${name}.html`), 'utf8'), json ? JSON.parse(json) : {}, [...stack, name], root);
    offset = match.index + match[0].length;
  }
  output += template.slice(offset);
  return output.replace(/{{{(\w+)}}}|{{(\w+)}}/g, (_, raw, escaped) => {
    const key = raw || escaped;
    if (!(key in props)) throw new Error(`Missing property: ${key}`);
    return raw ? String(props[key]) : escapeHTML(props[key]);
  });
}

export async function build({ check = false, root = ROOT } = {}) {
  let count = 0;
  async function visit(directory, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(relative, entry.name), source = join(directory, entry.name);
      if (entry.isDirectory()) { await visit(source, path); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = await render(await readFile(source, 'utf8'), {}, [], root);
      if (/{%|{{/.test(html)) throw new Error(`Unresolved template: ${path}`);
      const target = resolve(root, path);
      if (check) {
        if (await readFile(target, 'utf8') !== html) throw new Error(`Outdated page: ${path}. Run npm run build.`);
      } else {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, html);
      }
      count++;
    }
  }
  await visit(join(root, 'src/pages'));
  return count;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build({ check: process.argv.includes('--check') }).then(count => console.log(`Pages: ${count}`)).catch(error => { console.error(error); process.exitCode = 1; });
}
