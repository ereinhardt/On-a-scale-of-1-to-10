<?php
$dataFile = __DIR__ . '/user-data.json';
$action = $_GET['action'] ?? 'count';
$userId = $_GET['userId'] ?? null;
$timeout = 15;

// Initialisiere Datei falls nicht vorhanden
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(['users' => []]));
}

// SSE
if ($action === 'stream') {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Access-Control-Allow-Origin: *');
    header('X-Accel-Buffering: no');
    
    $lastCount = -1;
    $endTime = time() + 30;
    
    while (time() < $endTime) {
        $data = json_decode(file_get_contents($dataFile), true);
        $now = time();
        $activeUsers = array_filter($data['users'] ?? [], function($timestamp) use ($now, $timeout) {
            return ($now - $timestamp) < $timeout;
        });
        $count = count($activeUsers);
        
        if ($count !== $lastCount) {
            echo "data: " . json_encode(['count' => $count]) . "\n\n";
            $lastCount = $count;
        }
        
        ob_flush();
        flush();
        usleep(500000); // 0.5 Sekunden
    }
    
    echo "event: reconnect\ndata: {}\n\n";
    exit;
}

// JSON Modus für ping/leave/count
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$data = json_decode(file_get_contents($dataFile), true);
$now = time();

// Entferne inaktive User
$data['users'] = array_filter($data['users'], function($timestamp) use ($now, $timeout) {
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