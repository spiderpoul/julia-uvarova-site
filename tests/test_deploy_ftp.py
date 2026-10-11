import importlib.util
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "deploy_ftp.py"
spec = importlib.util.spec_from_file_location("deploy_ftp", SOURCE)
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class DeployTests(unittest.TestCase):
    def test_selection_and_ignore(self):
        with tempfile.TemporaryDirectory() as dirname:
            root = Path(dirname)
            paths = (
                "index.html", "assets/cover.webp", "books/index.html",
                "assets/draft.jpg", ".env", ".env.example", "README.md",
                "AGENTS.md", ".git/config", "scripts/deploy_ftp.py",
                "test.txt", ".htaccess", "private/secret.html",
            )
            for path in paths:
                filename = root / path
                filename.parent.mkdir(parents=True, exist_ok=True)
                filename.write_text("example")
            (root / ".deployignore").write_text("assets/draft.jpg\nprivate/\n")
            self.assertEqual([x.as_posix() for x in deploy.site_files(root)],
                             [".htaccess", "assets/cover.webp", "books/index.html",
                              "index.html", "test.txt"])

    def test_env_values_and_validation(self):
        with tempfile.TemporaryDirectory() as dirname:
            env = Path(dirname) / ".env"
            env.write_text("# ignored\nFTP_HOST=ftp.example.org\n"
                           "FTP_PASSWORD='p#ss=word'\nFTP_USE_TLS=true\n")
            self.assertEqual(deploy.read_env(env)["FTP_PASSWORD"], "p#ss=word")
            self.assertTrue(deploy.bool_config(deploy.read_env(env), "FTP_USE_TLS", "false"))
            with self.assertRaises(ValueError):
                deploy.bool_config({"FTP_USE_TLS": "maybe"}, "FTP_USE_TLS", "true")

    def test_remote_paths(self):
        self.assertEqual(deploy.remote_parts("/public_html/site"),
                         (True, ["public_html", "site"]))
        self.assertEqual(deploy.remote_parts("web"), (False, ["web"]))
        for value in ("", "../root", "a/../b", r"a\b"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                deploy.remote_parts(value)


if __name__ == "__main__":
    unittest.main()
