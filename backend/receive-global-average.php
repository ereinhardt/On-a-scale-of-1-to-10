<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$dataFile = __DIR__ . "/global-index.json";
$indexJsonFile = __DIR__ . "/../js/indexed_json.json";

function sendResponse($message, $statuscode): never {
    http_response_code($statuscode);
    header('Content-Type: application/json');
    echo json_encode(['message' => $message]);
    exit;
}

if (!file_exists(filename: $indexJsonFile)) {
    sendResponse("indexed_json.json not found at: " . $indexJsonFile, 500);
}

function initializeDataFile(): array {
    global $indexJsonFile;
    
    $content = file_get_contents($indexJsonFile);
    if($content === false) {
         return []; 
    }
    
    $indexed_data = json_decode($content, true);
    $data = [];
    
    foreach ($indexed_data as $categoryKey => $category) {
        foreach ($category as $underCategoryKey => $underCategory) {
            
            if (!isset($underCategory["items"])) continue;

            $items = $underCategory["items"];

            for ($k = 0; $k < count($items); $k++) {
                $imageName = $items[$k];
                
                // WICHTIG: Direkte Zuweisung statt array_push!
                // Das erzeugt: {"bild.jpg": {data}, "bild2.jpg": {data}}
                // Statt: [{"bild.jpg": {data}}, ...]
                $data[$imageName] = [
                    "average" => 0.0,
                    "sums" => array(),
                ];
            }
        }
    }

    return $data;
}
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(initializeDataFile()));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse("Only POST allowed", 405);
}

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data) {
    sendResponse("No data provided or invalid JSON", 400);
}

if (!is_array($data) || count($data) < 1) {
    sendResponse("Invalid data format", 400);
}

$global_average = json_decode(file_get_contents($dataFile), true);

if (!is_array($global_average)) {
    $global_average = initializeDataFile();
}


for ($i = 0; $i < count($data); $i++) {
    $current_item = $data[$i];

    if (!isset($current_item['index']) || !isset($current_item['image'])) {
        continue;
    }

    $current_index = $current_item["index"];
    $current_image = $current_item["image"];

    if (!isset($global_average[$current_image])) {
        continue; 
    }

    // Referenz auf das Bild-Array holen (damit wir es bearbeiten können)
    // Wir nutzen hier eine Referenz &$image_data ist aber in foreach einfacher.
    // Wir schreiben direkt in $global_average
    
    array_push($global_average[$current_image]["sums"], $current_index);

    
    $sums = $global_average[$current_image]["sums"];
    $total_sum = array_sum(array: $sums);
    $count = count($sums);
    
    if ($count > 0) {
        $classical_average = $total_sum / $count;
        $global_average[$current_image]["average"] = ($classical_average * 0.8 + $current_index * 0.2) / 2;
    }
}

file_put_contents($dataFile, json_encode($global_average));

sendResponse("Data received successfully", 200);
?>