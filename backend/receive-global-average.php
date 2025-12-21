<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$dataFile = __DIR__ . "/global-index.json";
$indexJsonFile = __DIR__ . "/../item-data/indexed_json.json";

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

function findUniqueAverage(float $targetAverage, array $global_average, string $currentImage): float
{
    // Sammle alle existierenden Average-Werte (außer dem aktuellen Item)
    $existingAverages = [];
    foreach ($global_average as $imageName => $imageData) {
        if ($imageName !== $currentImage && isset($imageData['global-average'])) {
            $existingAverages[strval($imageData['global-average'])] = true;
        }
    }

    // Zuerst: Prüfe ob der exakte Wert (auf 4 Nachkommastellen gerundet) frei ist
    $exactCandidate = round($targetAverage, 4);
    if (!isset($existingAverages[strval($exactCandidate)])) {
        return $exactCandidate;
    }

    // Stufenweise gröber werden: 1 Nachkommastelle, dann 2, dann 3, dann 4
    $precisions = [1, 2, 3, 4];

    foreach ($precisions as $precision) {
        $step = pow(10, -$precision); // 0.1, 0.01, 0.001, 0.0001
        $candidate = round($targetAverage, $precision);

        // Prüfe ob der gerundete Wert frei ist
        if (!isset($existingAverages[strval($candidate)])) {
            return $candidate;
        }

        // Suche alternierend nach oben und unten mit dieser Präzision
        $offset = $step;
        $maxOffset = 10; // Maximal 10 Einheiten in jede Richtung (effektiv 90.000 möglichen Werte von 1 bis 10 mit 4 Dezimalstellen)

        while ($offset <= $maxOffset) {
            // Versuche nach oben
            $upCandidate = round($targetAverage + $offset, $precision);
            if ($upCandidate <= 10 && !isset($existingAverages[strval($upCandidate)])) {
                return $upCandidate;
            }

            // Versuche nach unten
            $downCandidate = round($targetAverage - $offset, $precision);
            if ($downCandidate >= 1 && !isset($existingAverages[strval($downCandidate)])) {
                return $downCandidate;
            }

            $offset += $step;
        }
        // Keine freie Stelle bei dieser Präzision gefunden -> nächste Präzision versuchen
    }

    // Fallback (sollte nie passieren bei 90.000 möglichen Werten)
    return round($targetAverage, 4);
}

function findAllItems(array $node, array &$data): void
{
    foreach ($node as $key => $value) {
        if ($key === "items" && is_array($value)) {
            // Found items array - add all image paths (basename only)
            foreach ($value as $imagePath) {
                $imageName = basename($imagePath);
                $data[$imageName] = [
                    "global-average" => 0.0,
                    "classical-average" => 0.0,
                    "deviation" => 0.0,
                    "current-index" => 0,
                    "sums" => array(),
                ];
            }
        } elseif (is_array($value)) {
            // Recurse into nested arrays/objects
            findAllItems($value, $data);
        }
    }
}

function initializeDataFile(): array
{
    global $indexJsonFile;

    $content = file_get_contents($indexJsonFile);
    if ($content === false) {
        return [];
    }

    $indexed_data = json_decode($content, true);
    $data = [];

    findAllItems($indexed_data, $data);

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

    // Validate index is an integer between 1 and 10 (no decimals)
    if (!is_numeric($current_index) || $current_index != (int) $current_index || $current_index < 1 || $current_index > 10) {
        continue;
    }

    $current_index = (int) $current_index; // Ensure it's an integer
    $current_image = $current_item["image"];

    if (!isset($global_average[$current_image])) {
        continue;
    }

    array_push($global_average[$current_image]["sums"], $current_index);


    $sums = $global_average[$current_image]["sums"];
    $count = count($sums);

    if ($count > 0) {
        // Classical average ohne den aktuellen Wert (für die Gewichtung)
        $previous_sum = array_sum($sums) - $current_index;
        $previous_count = $count - 1;

        if ($previous_count > 0) {
            $classical_average_previous = $previous_sum / $previous_count;
            $calculated_average = $classical_average_previous * 0.8 + $current_index * 0.2;
        } else {
            // Erste Bewertung - nur der aktuelle Wert zählt
            $calculated_average = $current_index;
        }

        // Classical average mit allen Werten (für die Anzeige)
        $classical_average = array_sum($sums) / $count;
        $unique_average = findUniqueAverage($calculated_average, $global_average, $current_image);
        $global_average[$current_image]["global-average"] = $unique_average;
        $global_average[$current_image]["classical-average"] = round($classical_average, 4);
        $global_average[$current_image]["current-index"] = $current_index;
        $deviation = round($unique_average - $calculated_average, 4);
        $global_average[$current_image]["deviation"] = $deviation == 0 ? 0.0 : $deviation; // Verhindert -0
    }
}

file_put_contents($dataFile, json_encode($global_average));

sendResponse("Data received successfully", 200);
?>