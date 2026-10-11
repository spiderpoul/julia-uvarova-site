#!/usr/bin/env python3
"""Публикация статического сайта по FTP или защищённому FTPS."""

import argparse
import fnmatch
import ftplib
import re
import ssl
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

STATIC_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".map",
    ".json", ".webmanifest", ".xml", ".txt", ".webp", ".avif",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".bmp",
    ".tif", ".tiff", ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".pdf", ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".vtt", ".wasm",
}
PROTECTED_PATTERNS = (
    ".env", ".env.*", ".gitignore", ".deployignore", "AGENTS.md",
    "README.md", ".DS_Store", "Thumbs.db",
)
PROTECTED_DIRECTORIES = {
    ".git", ".github", ".idea", ".vscode", ".venv", "venv",
    "node_modules", "__pycache__", ".pytest_cache", ".mypy_cache",
}


def read_env(path: Path) -> dict[str, str]:
    """Загрузить KEY=value, KEY='value', KEY="value" из локального .env."""
    if not path.is_file():
        raise ValueError(f"Не найден {path}. Создайте .env по образцу .env.example")
    values = {}
    for lineno, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            raise ValueError(f"Некорректная строка {lineno} в .env (нужно KEY=value)")
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", key):
            raise ValueError(f"Некорректное имя переменной в .env, строка {lineno}")
        if value.startswith(("'", '"')):
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError(f"Незакрытые кавычки в .env, строка {lineno}")
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].rstrip()
        values[key] = value
    return values


def read_ignore_patterns(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")]


def is_ignored(relative: Path, patterns: list[str]) -> bool:
    parts = relative.parts
    if any(part in PROTECTED_DIRECTORIES for part in parts[:-1]):
        return True
    filename = parts[-1]
    if filename.startswith(".") and filename != ".htaccess":
        return True
    for pattern in (*PROTECTED_PATTERNS, *patterns):
        pattern = pattern.replace("\\", "/").lstrip("/")
        if not pattern:
            continue
        if pattern.endswith("/"):
            directory = pattern.rstrip("/")
            if (relative.as_posix().startswith(directory + "/")
                    or ("/" not in directory and directory in parts[:-1])):
                return True
        elif "/" in pattern:
            if fnmatch.fnmatchcase(relative.as_posix(), pattern):
                return True
        elif any(fnmatch.fnmatchcase(part, pattern) for part in parts):
            return True
    return False


def site_files(root: Path) -> list[Path]:
    ignores = read_ignore_patterns(root / ".deployignore")
    selected = []
    for path in root.rglob("*"):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(root)
        if is_ignored(relative, ignores):
            continue
        if path.suffix.lower() not in STATIC_EXTENSIONS and path.name != ".htaccess":
            continue
        selected.append(relative)
    return sorted(selected)


def bool_config(env: dict[str, str], key: str, default: str) -> bool:
    value = env.get(key, default).strip().lower()
    if value not in ("true", "false"):
        raise ValueError(f"{key} должен быть true или false")
    return value == "true"


def remote_parts(directory: str) -> tuple[bool, list[str]]:
    if not directory.strip() or "\\" in directory:
        raise ValueError("Укажите FTP_REMOTE_DIR в .env (через /)")
    parts = directory.split("/")
    if any(part == ".." for part in parts):
        raise ValueError("FTP_REMOTE_DIR не должен содержать '..'")
    return directory.startswith("/"), [part for part in parts if part not in ("", ".")]


def enter_or_create(ftp: ftplib.FTP, name: str) -> None:
    try:
        ftp.cwd(name)
    except ftplib.error_perm as error:
        if not str(error).startswith("550"):
            raise
        ftp.mkd(name)
        ftp.cwd(name)


def upload(files: list[Path], root: Path, env: dict[str, str]) -> None:
    required = ("FTP_HOST", "FTP_USER", "FTP_PASSWORD", "FTP_REMOTE_DIR")
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise ValueError("Заполните переменные в .env: " + ", ".join(missing))
    absolute, parts = remote_parts(env["FTP_REMOTE_DIR"])
    port = int(env.get("FTP_PORT", "21"))
    timeout = int(env.get("FTP_TIMEOUT", "30"))
    if not (1 <= port <= 65535) or timeout <= 0:
        raise ValueError("FTP_PORT должен быть 1–65535, FTP_TIMEOUT — положительным")
    use_tls = bool_config(env, "FTP_USE_TLS", "true")
    passive = bool_config(env, "FTP_PASSIVE", "true")
    client = (ftplib.FTP_TLS(context=ssl.create_default_context()) if use_tls
              else ftplib.FTP())
    with client as ftp:
        ftp.connect(env["FTP_HOST"], port, timeout=timeout)
        ftp.login(env["FTP_USER"], env["FTP_PASSWORD"])
        if use_tls:
            ftp.prot_p()
        ftp.set_pasv(passive)
        if absolute:
            ftp.cwd("/")
        for part in parts:
            enter_or_create(ftp, part)
        base = ftp.pwd()
        total = len(files)
        for number, relative in enumerate(files, 1):
            ftp.cwd(base)
            for directory in relative.parts[:-1]:
                enter_or_create(ftp, directory)
            with (root / relative).open("rb") as stream:
                ftp.storbinary(f"STOR {relative.name}", stream)
            print(f"[{number}/{total}] {relative.as_posix()}")
    print(f"Готово: отправлено {total} файлов. Ничего не удалено на сервере.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Публикация HTML и ассетов по FTP/FTPS")
    parser.add_argument("--dry-run", action="store_true",
                        help="Показать список файлов, не подключаясь к серверу")
    args = parser.parse_args()
    files = site_files(ROOT)
    if not files:
        raise ValueError("Нет файлов для публикации")
    if args.dry_run:
        for relative in files:
            print(relative.as_posix())
        print(f"Проверка завершена: {len(files)} файлов. Загрузка не выполнялась.")
    else:
        upload(files, ROOT, read_env(ROOT / ".env"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, ftplib.Error, OSError, EOFError) as exc:
        print(f"Ошибка публикации: {exc}", file=sys.stderr)
        sys.exit(1)
