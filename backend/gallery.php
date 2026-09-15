<?php

declare(strict_types=1);

$item = $_GET['item'] ?? '';

// Only a bare file name is accepted; the actual path comes from the index below.
if (
    !is_string($item)
    || $item === ''
    || $item !== basename($item)
    || str_contains($item, "\0")
    || !preg_match('/\.png$/i', $item)
) {
    http_response_code(400);
    exit;
}

$indexJsonFile = dirname(__DIR__) . '/item-data/indexed_json.json';

if (!file_exists($indexJsonFile)) {
    http_response_code(500);
    exit;
}

$index = json_decode((string) file_get_contents($indexJsonFile), true);

function findItemPath(array $node, string $item): ?string
{
    foreach ($node as $value) {
        if (is_array($value) && array_is_list($value)) {
            foreach ($value as $path) {
                if (is_string($path) && basename($path) === $item) {
                    return $path;
                }
            }
        } elseif (is_array($value)) {
            $found = findItemPath($value, $item);
            if ($found !== null) {
                return $found;
            }
        }
    }

    return null;
}

$path = is_array($index) ? findItemPath($index, $item) : null;

if ($path === null) {
    http_response_code(404);
    exit;
}

$src = '../item-data/' . implode('/', array_map('rawurlencode', explode('/', str_replace('**', '1024', $path))));

$label = str_replace('_', ' ', pathinfo((string) preg_replace('/^.*__/', '', $item), PATHINFO_FILENAME));

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$title = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
$fileName = htmlspecialchars('item-data/' . str_replace('**', '1024', $path), ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>On a scale from 1 to 10 – <?= $title ?></title>
    <style>
      .image-box {
        border: 1px solid silver;
        padding: 1rem;
        margin-bottom: 1rem;
        box-sizing: border-box;
      }

      .image-box h3 {
        margin-top: 0;
        margin-bottom: 0.5rem;
        overflow-wrap: anywhere;
      }

      img {
        display: block;
        width: 400px;
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <a
      href="#"
      onclick="
        window.close();
        return false;
      "
      >Back</a
    ><br /><br />
    <h1 style="margin-top: 0"><?= $title ?></h1><br /><br />
    <div class="image-box">
      <h3><?= $fileName ?></h3>
      <img src="<?= htmlspecialchars($src, ENT_QUOTES, 'UTF-8') ?>" alt="<?= $fileName ?>" />
    </div>
  </body>
</html>
