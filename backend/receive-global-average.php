<?php

/*
================================================================================
RATING SYSTEM
================================================================================

This system collects ratings (1-10) for items (e.g., images) and calculates
averages. Each item must have a UNIQUE average for unambiguous ranking.

--------------------------------------------------------------------------------
1. DATA STRUCTURE
--------------------------------------------------------------------------------
For each item we store:
  - "sums"             → Array of all ratings [7, 8, 6, 9, 8]
  - "classical-average"→ Simple arithmetic mean (sum ÷ count)
  - "global-average"   → Weighted unique average (see below)
  - "deviation"        → Distance from calculated to assigned unique value

--------------------------------------------------------------------------------
2. CALCULATION PROCESS
--------------------------------------------------------------------------------

Example: Pizza has ratings [7, 8, 6, 9], new rating is 8

STEP A: Classical Average
  Simple mean: (7 + 8 + 6 + 9 + 8) ÷ 5 = 7.6

STEP B: Weighted Average (Global Average Base)
  Why weighted? With 1000 existing ratings, a new rating would barely affect
  the classical average. This is unfair to recent raters.
  
  Formula: New = (Previous Average × 0.8) + (New Rating × 0.2)
  
  Previous average (without new rating): (7+8+6+9)÷4 = 7.5
  Calculated average: 7.5 × 0.8 + 8 × 0.2 = 6.0 + 1.6 = 7.6

--------------------------------------------------------------------------------
3. UNIQUE AVERAGE ASSIGNMENT (findUniqueAverage)
--------------------------------------------------------------------------------

Problem: What if two items have the same calculated average?
Solution: Find the next available unique value.

SEARCH STRATEGY:
We don't search sequentially but use a randomized multi-round approach
for natural-looking distribution.

ROUND 1: 1 Decimal Place (always starts here regardless of target)
  1. Generate ~11 base values around target (±5 steps of 0.1)
     Example for target=1.0: bases are 1.0, 1.1, 1.2, 1.3, 1.4, 1.5
     (0.5-0.9 ignored as < 1.0)
     Example for target=2.0: bases are 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5
  2. Shuffle bases randomly
  3. Try all bases in random order: 1.3 → 1.1 → 1.5 → 1.2 → 1.4 → 1.0
     First free value is assigned

ROUND 2: 2 Decimal Places (if Round 1 exhausted)
  1. Expand each Round 1 base by ±5 steps of 0.01
     Example: 1.0 → [0.95, 0.96, ..., 1.05]
     Example: 1.1 → [1.05, 1.06, ..., 1.15]
  2. Pool all values (~50-100 candidates), remove duplicates, shuffle
  3. Try all in random order

ROUND 3: 3 Decimal Places (if Round 2 exhausted)
  Expand Round 2 bases by ±5 steps of 0.001
  Example: 1.00 → [0.995, 0.996, ..., 1.005]
  Pool, shuffle, try all

ROUND 4: 4 Decimal Places (maximum precision)
  Expand Round 3 bases by ±5 steps of 0.0001
  Example: 1.000 → [0.9995, 0.9996, ..., 1.0005]
  This gives 90,000 possible values between 1.0000 and 10.0000

FALLBACK: Systematic Search
  If all 4 rounds exhausted, search sequentially from target in 0.0001 steps
  alternating up/down: target+0.0001, target-0.0001, target+0.0002, etc.
  A free slot must exist (90,000 total slots).

--------------------------------------------------------------------------------
4. RE-RATING BEHAVIOR
--------------------------------------------------------------------------------
When an item (e.g., Pizza at 7.6001) receives a new rating:
  1. Old global-average (7.6001) is freed
  2. New average is calculated (e.g., 7.52)
  3. New unique slot is found for 7.52
  
--------------------------------------------------------------------------------
5. CONCURRENCY: FILE LOCKING
--------------------------------------------------------------------------------
Handles simultaneous ratings using exclusive file locks (LOCK_EX).
Only one process can write at a time; others wait.

================================================================================
*/

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
    // Collect all existing average values (except current item)
    $existingAverages = [];
    foreach ($items as $imageName => $imageData) {
        if ($imageName !== $currentImage && isset($imageData['global-average'])) {
            $existingAverages[sprintf("%.4f", $imageData['global-average'])] = true;
        }
    }

    // First: Check if exact value (rounded to 4 decimals) is free
    $exactCandidate = round($targetAverage, 4);
    if (!isset($existingAverages[sprintf("%.4f", $exactCandidate)])) {
        return $exactCandidate;
    }

    // Always start with 1 decimal place, regardless of targetAverage
    $basePrecision = 1;
    $baseStep = 0.1; // Step size for 1 decimal place

    // Collect base values: ±5 steps around targetAverage
    $bases = [];
    for ($i = -5; $i <= 5; $i++) {
        $base = round($targetAverage + ($i * $baseStep), $basePrecision);
        if ($base >= 1.0 && $base <= 10.0) {
            $bases[] = $base;
        }
    }

    // Shuffle base values randomly
    shuffle($bases);

    // For each finer precision (up to maximum 4 decimal places)
    for ($precision = $basePrecision; $precision <= 4; $precision++) {
        $step = pow(10, -$precision);

        // Generate ALL possible candidates for this precision
        $allCandidates = [];
        
        foreach ($bases as $base) {
            // Add base value itself
            $baseCandidate = round($base, $precision);
            if ($baseCandidate >= 1 && $baseCandidate <= 10) {
                $allCandidates[] = $baseCandidate;
            }

            // Round 1: Only base values, no deviation!
            // From Round 2 onward: Expand each base value by ±5 steps
            if ($precision > 1) {
                for ($i = 1; $i <= 5; $i++) {
                    $upCandidate = round($base + ($i * $step), $precision);
                    if ($upCandidate >= 1 && $upCandidate <= 10) {
                        $allCandidates[] = $upCandidate;
                    }
                    $downCandidate = round($base - ($i * $step), $precision);
                    if ($downCandidate >= 1 && $downCandidate <= 10) {
                        $allCandidates[] = $downCandidate;
                    }
                }
            }
        }

        // Remove duplicates and shuffle all candidates randomly
        $allCandidates = array_unique($allCandidates);
        shuffle($allCandidates);

        // Try all candidates in random order
        foreach ($allCandidates as $candidate) {
            if (!isset($existingAverages[sprintf("%.4f", $candidate)])) {
                return $candidate;
            }
        }

        // For next precision: expand base values
        // Use the next smaller step size (next precision level)
        $newBases = [];
        $nextStep = pow(10, -($precision + 1));
        foreach ($bases as $base) {
            for ($i = -5; $i <= 5; $i++) {
                $newBase = round($base + ($i * $nextStep), $precision + 1);
                if ($newBase >= 1.0 && $newBase <= 10.0) {
                    $newBases[] = $newBase;
                }
            }
        }
        $bases = array_unique($newBases);
        shuffle($bases);
    }

    // Fallback: Search systematically for next free value from targetAverage
    // Alternate searching up and down to stay as close as possible to target
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

    // Last fallback: Should NEVER be reached (90,000 possible values from 1.0000 to 10.0000)
    // If reached, there is a serious problem
    error_log("WARNING: No free value found for targetAverage=$targetAverage - all 90,000 values occupied?!");
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

// Open file with exclusive lock for safe concurrent access handling
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

// Synchronize new items from indexed_json.json
$current_data = initializeDataFile();
foreach ($current_data['items'] as $imageName => $defaultData) {
    if (!isset($global_average['items'][$imageName])) {
        $global_average['items'][$imageName] = $defaultData;
    }
}

// Update total-item-number
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
        // Classical average without current value (for weighting)
        $previous_sum = array_sum($sums) - $current_index;
        $previous_count = $count - 1;

        if ($previous_count > 0) {
            $classical_average_previous = $previous_sum / $previous_count;
            $calculated_average = $classical_average_previous * 0.8 + $current_index * 0.2;
        } else {
            // First rating - only current value counts
            $calculated_average = $current_index;
        }

        // Classical average with all values (for display)
        $classical_average = array_sum($sums) / $count;
        $unique_average = findUniqueAverage($calculated_average, $global_average['items'], $current_image);
        $global_average['items'][$current_image]["global-average"] = $unique_average;
        $global_average['items'][$current_image]["classical-average"] = round($classical_average, 4);
        $global_average['items'][$current_image]["current-index"] = $current_index;
        $deviation = round($unique_average - $calculated_average, 4);
        $global_average['items'][$current_image]["deviation"] = $deviation == 0 ? 0.0 : $deviation; // Prevent -0
    }
}

// Calculate total-sum-number (total count of all ratings) and total-rated-item-number
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

// Write data back with active lock
ftruncate($fileHandle, 0);
rewind($fileHandle);
fwrite($fileHandle, json_encode($global_average));
fflush($fileHandle);

// Release lock and close file
flock($fileHandle, LOCK_UN);
fclose($fileHandle);

sendResponse("Data received successfully", 200);
?>