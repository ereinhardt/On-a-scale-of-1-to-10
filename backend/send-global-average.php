<?php

$dataFile = __DIR__ . "/global-index.json";


function sendResponse($message, $statuscode): never
{
    http_response_code($statuscode);
    header('Content-Type: application/json');
    echo json_encode(['message' => $message]);
    exit;
}

if (!file_exists(filename: $dataFile)) {
    sendResponse("global-index.json not found at: " . $dataFile, 500);
}


if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse("Only GET allowed", 405);
}

header('Content-Type: application/json');
http_response_code(200);

echo file_get_contents($dataFile);
exit;


?>