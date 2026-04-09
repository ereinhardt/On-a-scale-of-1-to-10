<?php

require_once __DIR__ . '/sync-items.php';

function sendResponse($message, $statuscode): never
{
    http_response_code($statuscode);
    header('Content-Type: application/json');
    echo json_encode(['message' => $message]);
    exit;
}

if (!file_exists(filename: $indexJsonFile)) {
    sendResponse("indexed_json.json not found at: " . $indexJsonFile, 500);
}

if (!file_exists(filename: $dataFile)) {
    sendResponse("global-index.json not found at: " . $dataFile, 500);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse("Only GET allowed", 405);
}

// Sync items (migrates renamed labels, adds new items, removes deleted ones)
$global_average = syncItems();

header('Content-Type: application/json');
http_response_code(200);

echo json_encode($global_average);
exit;

?>