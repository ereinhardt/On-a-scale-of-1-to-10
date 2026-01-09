<?php
$dataFile = __DIR__ . '/user-data.json';
$action = $_GET['action'] ?? 'count';
$userId = $_GET['userId'] ?? null;
$timeout = 5;

// Initialize file if it does not exist
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(['users' => []]));
}

// JSON mode for ping/leave/count
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$data = json_decode(file_get_contents($dataFile), true);
$now = time();

// Remove inactive users
$data['users'] = array_filter($data['users'], function ($timestamp) use ($now, $timeout) {
    return ($now - $timestamp) < $timeout;
});

if ($action === 'ping' && $userId) {
    $data['users'][$userId] = $now;
    file_put_contents($dataFile, json_encode($data));
}

if ($action === 'leave' && $userId) {
    unset($data['users'][$userId]);
    file_put_contents($dataFile, json_encode($data));
}

echo json_encode(['count' => count($data['users'])]);
?>