import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, extname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

// Только файлы, которые действительно могут потребоваться статическому сайту.
const STATIC_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.map', '.json',
  '.webmanifest', '.xml', '.txt', '.webp', '.avif', '.png', '.jpg',
  '.jpeg', '.gif', '.svg', '.ico', '.bmp', '.tif', '.tiff', '.woff',
  '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.mp3', '.wav', '.ogg',
  '.mp4', '.webm', '.vtt', '.wasm',
]);
const PRIVATE_DIRECTORIES = new Set([
  '.git', '.github', '.idea', '.vscode', '.venv', 'venv',
  'node_modules', '__pycache__', '.pytest_cache', 'scripts',
  'tests', 'test', 'coverage',
]);
const PRIVATE_FILENAMES = new Set([
  'agents.md', 'agent.md', 'readme.md', '.gitignore',
  '.deployignore', 'package.json', 'package-lock.json',
]);

function globMatches(value, pattern) {
  const regex = pattern.split('').map((char) => {
    if (char === '*') return '.*';
    if (char === '?') return '.';
    return char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }).join('');
  return new RegExp(`^${regex}$`).test(value);
}

export function isExcluded(relativePath, patterns = [], isDirectory = false) {
  const parts = relativePath.split('/');
  if (parts.some((part) => PRIVATE_DIRECTORIES.has(part))) return true;
  if (parts.some((part, index) => part.startsWith('.') &&
    !(index === parts.length - 1 && !isDirectory && part === '.htaccess'))) return true;
  if (PRIVATE_FILENAMES.has(parts.at(-1).toLowerCase())) return true;

  return patterns.some((pattern) => {
    const pathPattern = pattern.replaceAll('\\', '/').replace(/^\/+/, '');
    if (pathPattern.endsWith('/')) {
      const folder = pathPattern.slice(0, -1);
      if (folder.includes('/')) return relativePath === folder || relativePath.startsWith(`${folder}/`);
      return parts.some((part, i) => part === folder && (i < parts.length - 1 || isDirectory));
    }
    if (pathPattern.includes('/')) return globMatches(relativePath, pathPattern);
    return parts.some((part) => globMatches(part, pathPattern));
  });
}

export async function listSiteFiles(root = ROOT) {
  const ignoreText = await readFile(join(root, '.deployignore'), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const patterns = ignoreText.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const files = [];

  async function visit(directory, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink() || isExcluded(path, patterns, entry.isDirectory())) continue;
      if (entry.isDirectory()) {
        await visit(join(directory, entry.name), path);
      } else if (entry.isFile() &&
        (STATIC_EXTENSIONS.has(extname(entry.name).toLowerCase()) || entry.name === '.htaccess')) {
        files.push(path);
      }
    }
  }

  await visit(root);
  return files.sort();
}

export function parseEnv(text) {
  const variables = {};
  for (const [index, rawLine] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trimStart();
    const match = line.match(/^([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)$/);
    if (!match) throw new Error(`Неверный формат .env, строка ${index + 1}`);
    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      if (!value.endsWith(value[0]) || value.length < 2) {
        throw new Error(`Незакрытые кавычки в .env, строка ${index + 1}`);
      }
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trimEnd();
    }
    variables[match[1]] = value;
  }
  return variables;
}

export function deploymentConfig(env) {
  for (const key of ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'FTP_REMOTE_DIR']) {
    if (!env[key]?.trim()) throw new Error(`Заполните ${key} в локальном .env`);
  }
  const port = Number(env.FTP_PORT ?? 21);
  const timeout = Number(env.FTP_TIMEOUT ?? 30);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('FTP_PORT должен быть целым числом от 1 до 65535');
  }
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error('FTP_TIMEOUT должен быть положительным числом');
  }
  const tlsValue = (env.FTP_USE_TLS ?? 'true').toLowerCase();
  if (!['true', 'false'].includes(tlsValue)) {
    throw new Error('FTP_USE_TLS должен быть true или false');
  }
  const remoteDir = env.FTP_REMOTE_DIR.trim();
  if (remoteDir.includes('\\') || remoteDir.split('/').includes('..') ||
      remoteDir.includes('\0') || remoteDir === '.') {
    throw new Error('FTP_REMOTE_DIR должен содержать корректный FTP-путь без ..');
  }
  return {
    host: env.FTP_HOST,
    user: env.FTP_USER,
    password: env.FTP_PASSWORD,
    port,
    timeout: timeout * 1000,
    secure: tlsValue === 'true',
    remoteDir,
  };
}

export async function deploy(root, files, config, ClientClass) {
  const client = new ClientClass(config.timeout);
  try {
    try {
      await client.access({
        host: config.host, user: config.user, password: config.password,
        port: config.port, secure: config.secure,
      });
    } catch (error) {
      // Не повторяем подключение с другим режимом безопасности автоматически.
      if (error.code === 'ECONNREFUSED' || /\bECONNREFUSED\b/.test(error.message ?? '')) {
        throw new Error(
          `Сервер ${config.host}:${config.port} отклонил соединение (ECONNREFUSED). ` +
          'Проверьте FTP_HOST и FTP_PORT, доступность FTP-сервиса и возможную блокировку IP на хостинге. ' +
          'Смена FTP_USE_TLS не устраняет отказ TCP-соединения.',
          { cause: error },
        );
      }
      if (config.secure && /security scheme is not implemented/i.test(error.message ?? '')) {
        throw new Error(
          'Сервер отклонил AUTH TLS (FTP 500). Проверьте поддержку FTPS (explicit TLS). ' +
          'Только если хостинг предоставляет обычный FTP, установите FTP_USE_TLS=false; ' +
          'при этом пароль и файлы передаются без шифрования.',
          { cause: error },
        );
      }
      throw error;
    }
    await client.ensureDir(config.remoteDir);
    const remoteRoot = await client.pwd();
    for (const [index, file] of files.entries()) {
      const folder = posix.dirname(file);
      await client.ensureDir(folder === '.' ? remoteRoot : posix.join(remoteRoot, folder));
      await client.uploadFrom(join(root, ...file.split('/')), basename(file));
      console.log(`[${index + 1}/${files.length}] ${file}`);
    }
  } finally {
    client.close();
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--dry-run')) {
    throw new Error('Поддерживается только аргумент --dry-run');
  }
  const files = await listSiteFiles(ROOT);
  if (files.length === 0) throw new Error('Нет файлов для публикации');
  if (args.includes('--dry-run')) {
    console.log(files.join('\n'));
    console.log(`Проверка завершена: ${files.length} файлов. Загрузка не выполнялась.`);
    return;
  }

  const env = await readFile(join(ROOT, '.env'), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') throw new Error('Нет .env: скопируйте .env.example в .env');
    throw error;
  });
  const config = deploymentConfig(parseEnv(env));
  const { Client } = await import('basic-ftp');
  await deploy(ROOT, files, config, Client);
  console.log(`Готово: загружено ${files.length} файлов. Серверные файлы не удалялись.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Ошибка публикации: ${error.message}`);
    process.exitCode = 1;
  });
}