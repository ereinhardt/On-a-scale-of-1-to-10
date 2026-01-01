<?php

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

function findUniqueAverage(float $targetAverage, array $items, string $currentImage): float
{
    // Sammle alle existierenden Average-Werte (außer dem aktuellen Item)
    $existingAverages = [];
    foreach ($items as $imageName => $imageData) {
        if ($imageName !== $currentImage && isset($imageData['global-average'])) {
            $existingAverages[sprintf("%.4f", $imageData['global-average'])] = true;
        }
    }

    // Zuerst: Prüfe ob der exakte Wert (auf 4 Nachkommastellen gerundet) frei ist
    $exactCandidate = round($targetAverage, 4);
    if (!isset($existingAverages[sprintf("%.4f", $exactCandidate)])) {
        return $exactCandidate;
    }

    // Bestimme die Anzahl der Dezimalstellen des targetAverage
    $targetStr = strval($targetAverage);
    $decimalPlaces = 0;
    if (strpos($targetStr, '.') !== false) {
        $decimalPlaces = strlen(substr($targetStr, strpos($targetStr, '.') + 1));
    }
    // Begrenze auf 0-3, da wir maximal 4 Dezimalstellen haben wollen
    $decimalPlaces = min($decimalPlaces, 3);

    // Berechne die Schrittweite für Basiswerte basierend auf der Präzision
    // 0 Dezimalstellen (z.B. 5) → Schritt 0.1
    // 1 Dezimalstelle (z.B. 5.1) → Schritt 0.01
    // 2 Dezimalstellen (z.B. 5.11) → Schritt 0.001
    // 3 Dezimalstellen (z.B. 5.111) → Schritt 0.0001
    $baseStep = pow(10, -($decimalPlaces + 1));
    $basePrecision = $decimalPlaces + 1;

    // Sammle Basiswerte: ±5 Schritte um den targetAverage
    $bases = [];
    for ($i = -5; $i <= 5; $i++) {
        $base = round($targetAverage + ($i * $baseStep), $basePrecision);
        if ($base >= 1.0 && $base <= 10.0) {
            $bases[] = $base;
        }
    }

    // Mische die Basiswerte zufällig
    shuffle($bases);

    // Für jede feinere Präzision (bis maximal 4 Dezimalstellen)
    for ($precision = $basePrecision; $precision <= 4; $precision++) {
        $step = pow(10, -$precision);
        $maxDeviation = pow(10, -($precision - 1)); // Deviation bis zur nächsten gröberen Stelle

        foreach ($bases as $base) {
            // Prüfe zuerst den Basiswert selbst
            $baseCandidate = round($base, $precision);
            if ($baseCandidate >= 1 && $baseCandidate <= 10 && !isset($existingAverages[sprintf("%.4f", $baseCandidate)])) {
                return $baseCandidate;
            }

            // Versuche kleine Deviationen um diesen Basiswert
            $devOffset = $step;
            while ($devOffset < $maxDeviation) {
                $upCandidate = round($base + $devOffset, $precision);
                if ($upCandidate <= 10 && !isset($existingAverages[sprintf("%.4f", $upCandidate)])) {
                    return $upCandidate;
                }
                $downCandidate = round($base - $devOffset, $precision);
                if ($downCandidate >= 1 && !isset($existingAverages[sprintf("%.4f", $downCandidate)])) {
                    return $downCandidate;
                }
                $devOffset += $step;
            }
        }

        // Für die nächste Präzision: erweitere die Basiswerte
        $newBases = [];
        foreach ($bases as $base) {
            for ($i = -5; $i <= 5; $i++) {
                $newBase = round($base + ($i * $step), $precision);
                if ($newBase >= 1.0 && $newBase <= 10.0) {
                    $newBases[] = $newBase;
                }
            }
        }
        $bases = array_unique($newBases);
        shuffle($bases);
    }

    // Fallback: Suche systematisch den nächsten freien Wert ab targetAverage
    // Alternierend nach oben und unten suchen, um möglichst nah am Zielwert zu bleiben
    $offset = 0.0001;
    while ($offset <= 10) {
        $upCandidate = round($targetAverage + $offset, 4);
        if ($upCandidate <= 10 && !isset($existingAverages[sprintf("%.4f", $upCandidate)])) {
            return $upCandidate;
        }
        $downCandidate = round($targetAverage - $offset, 4);
        if ($downCandidate >= 1 && !isset($existingAverages[sprintf("%.4f", $downCandidate)])) {
            return $downCandidate;
        }
        $offset += 0.0001;
    }

    // Letzter Fallback: Sollte NIEMALS erreicht werden (90.000 mögliche Werte von 1.0000 bis 10.0000)
    // Wenn doch, gibt es ein schwerwiegendes Problem
    error_log("WARNUNG: Kein freier Wert gefunden für targetAverage=$targetAverage - alle 90.000 Werte belegt?!");
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
    $items = [];

    findAllItems($indexed_data, $items);

    $data = [
        "total-stats" => [
            "total-item-number" => count($items),
            "total-rated-item-number" => 0,
            "total-sum-number" => 0
        ],
        "items" => $items
    ];

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

// Öffne Datei mit exklusivem Lock für sichere Concurrent-Access-Behandlung
$fileHandle = fopen($dataFile, 'c+');
if (!$fileHandle) {
    sendResponse("Could not open data file", 500);
}
if (!flock($fileHandle, LOCK_EX)) {
    fclose($fileHandle);
    sendResponse("Could not acquire file lock", 500);
}

$fileContent = stream_get_contents($fileHandle);
$global_average = json_decode($fileContent, true);

if (!is_array($global_average) || !isset($global_average['items'])) {
    $global_average = initializeDataFile();
}

// Synchronisiere neue Items aus indexed_json.json
$current_data = initializeDataFile();
foreach ($current_data['items'] as $imageName => $defaultData) {
    if (!isset($global_average['items'][$imageName])) {
        $global_average['items'][$imageName] = $defaultData;
    }
}

// Aktualisiere total-item-number
$global_average['total-stats']['total-item-number'] = count($global_average['items']);


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

    if (!isset($global_average['items'][$current_image])) {
        continue;
    }

    array_push($global_average['items'][$current_image]["sums"], $current_index);


    $sums = $global_average['items'][$current_image]["sums"];
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
        $unique_average = findUniqueAverage($calculated_average, $global_average['items'], $current_image);
        $global_average['items'][$current_image]["global-average"] = $unique_average;
        $global_average['items'][$current_image]["classical-average"] = round($classical_average, 4);
        $global_average['items'][$current_image]["current-index"] = $current_index;
        $deviation = round($unique_average - $calculated_average, 4);
        $global_average['items'][$current_image]["deviation"] = $deviation == 0 ? 0.0 : $deviation; // Verhindert -0
    }
}

// Berechne total-sum-number (Gesamtanzahl aller Bewertungen) und total-rated-item-number
$total_sum_number = 0;
$total_rated_item_number = 0;
foreach ($global_average['items'] as $imageData) {
    $total_sum_number += count($imageData['sums']);
    if (isset($imageData['global-average']) && $imageData['global-average'] != 0) {
        $total_rated_item_number++;
    }
}
$global_average['total-stats']['total-sum-number'] = $total_sum_number;
$global_average['total-stats']['total-rated-item-number'] = $total_rated_item_number;

// Schreibe Daten zurück mit aktivem Lock
ftruncate($fileHandle, 0);
rewind($fileHandle);
fwrite($fileHandle, json_encode($global_average));
fflush($fileHandle);

// Lock freigeben und Datei schließen
flock($fileHandle, LOCK_UN);
fclose($fileHandle);

sendResponse("Data received successfully", 200);
?>