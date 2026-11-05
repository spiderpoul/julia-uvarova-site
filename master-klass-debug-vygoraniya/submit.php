<?php
declare(strict_types=1);

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function formError(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="ru"><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>Дебаг выгорания — отправка формы</title>'
        . '<link rel="stylesheet" href="/assets/css/pages/debug-vygoraniya.css">'
        . '<main class="shell" style="padding-top:32px"><section class="card">'
        . '<h1 style="font-size:2rem">Не удалось отправить форму</h1>'
        . '<p>' . $safeMessage . '</p><a href="./">Вернуться к форме</a>'
        . '</section></main></html>';
    exit;
}

function storeApplication(string $name, string $email, bool $bookNews): bool
{
    $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
    if ($root === false || $root !== realpath(dirname(__DIR__))) {
        return false;
    }

    $storage = dirname($root) . '/.debug-vygoraniya-private';
    if (!is_dir($storage) && !@mkdir($storage, 0700) && !is_dir($storage)) {
        return false;
    }
    if (realpath($storage) !== $storage || (fileperms($storage) & 0077) !== 0) {
        return false;
    }

    $path = $storage . '/applications.jsonl';
    if (is_link($path)) {
        return false;
    }
    $mask = umask(0077);
    $file = @fopen($path, 'x+b');
    umask($mask);
    if ($file !== false && !chmod($path, 0600)) {
        fclose($file);
        return false;
    }
    if ($file === false) {
        $file = @fopen($path, 'ab');
    }
    if ($file === false) {
        return false;
    }

    try {
        if (!flock($file, LOCK_EX)) {
            return false;
        }
        $stat = fstat($file);
        if ($stat === false || ($stat['mode'] & 0077) !== 0) {
            return false;
        }
        $record = json_encode([
            'submitted_at' => gmdate(DATE_ATOM),
            'name' => $name,
            'email' => $email,
            'book_news' => $bookNews,
        ], JSON_UNESCAPED_UNICODE);
        if ($record === false) {
            return false;
        }
        fseek($file, 0, SEEK_END);
        $line = $record . "\n";
        if (fwrite($file, $line) !== strlen($line) || !fflush($file)) {
            ftruncate($file, $stat['size']);
            return false;
        }
        return true;
    } finally {
        fclose($file);
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    formError(405, 'Пожалуйста, откройте страницу мастер-класса и заполните форму.');
}

$fetchSite = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originParts = $origin === '' ? [] : parse_url($origin);
$originHost = $originParts['host'] ?? '';
if (isset($originParts['port'])) {
    $originHost .= ':' . $originParts['port'];
}
if (in_array($fetchSite, ['same-site', 'cross-site'], true)
    || ($origin !== '' && strcasecmp($originHost, $_SERVER['HTTP_HOST'] ?? '') !== 0)) {
    formError(403, 'Откройте форму на сайте Юлии Уваровой и попробуйте снова.');
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 4096) {
    formError(413, 'Имя или email слишком длинные.');
}

$name = is_string($_POST['name'] ?? null) ? trim($_POST['name']) : '';
$email = is_string($_POST['email'] ?? null) ? trim($_POST['email']) : '';
$bookNews = $_POST['book_news'] ?? null;
if (!preg_match('/\A[^\p{C}]{1,100}\z/u', $name) || !preg_match('/[^\p{Z}\s]/u', $name)
    || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)
    || ($bookNews !== null && $bookNews !== 'yes')) {
    formError(422, 'Проверьте, что имя и email введены правильно.');
}
if (!storeApplication($name, $email, $bookNews === 'yes')) {
    error_log('Debug vygoraniya: private application storage is unavailable.');
    formError(503, 'Сохранить заявку сейчас не получилось. Попробуйте чуть позже.');
}

header('Location: ./spasibo/', true, 303);
