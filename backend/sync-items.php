<?php

/**
 * Shared item synchronization logic.
 * Syncs global-index.json with indexed_json.json using UUID-based matching,
 * so renaming a label (while keeping the UUID) preserves rating data.
 *
 * Usage:
 *   require_once __DIR__ . '/sync-items.php';
 *   // With file handle (for locked read/write in receive):
 *   $global_average = syncItems($fileHandle);
 *   // Without file handle (read-only in send):
 *   $global_average = syncItems();
 */

$dataFile = __DIR__ . "/global-index.json";
$indexJsonFile = __DIR__ . "/../item-data/indexed_json.json";

function extractUUID(string $filename): ?string
{
    if (preg_match('/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})__/i', $filename, $matches)) {
        return $matches[1];
    }
    return null;
}

function findAllItems(array $node, array &$data): void
{
    foreach ($node as $key => $value) {
        if ($key === "items" && is_array($value)) {
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

/**
 * Synchronize global-index.json with indexed_json.json.
 * If a $fileHandle is provided, reads from it (assumes LOCK_EX already held)
 * and writes back after sync. Otherwise reads/writes the file directly.
 *
 * Returns the synchronized data array.
 */
function syncItems($fileHandle = null): array
{
    global $dataFile;

    // Read current global-index.json
    if ($fileHandle) {
        $fileContent = stream_get_contents($fileHandle);
    } else {
        $fileContent = file_exists($dataFile) ? file_get_contents($dataFile) : false;
    }

    $global_average = ($fileContent !== false) ? json_decode($fileContent, true) : null;

    if (!is_array($global_average) || !isset($global_average['items'])) {
        $global_average = initializeDataFile();
    }

    // Synchronize items from indexed_json.json (matched by UUID, not full filename)
    $current_data = initializeDataFile();

    // Build UUID -> filename map for existing items in global-index.json
    $existingUUIDs = [];
    foreach ($global_average['items'] as $imageName => $itemData) {
        $uuid = extractUUID($imageName);
        if ($uuid) {
            $existingUUIDs[$uuid] = $imageName;
        }
    }

    // Add new items or migrate data when filename (label) changed but UUID stayed the same
    foreach ($current_data['items'] as $imageName => $defaultData) {
        $uuid = extractUUID($imageName);
        if ($uuid && isset($existingUUIDs[$uuid])) {
            $oldName = $existingUUIDs[$uuid];
            if ($oldName !== $imageName) {
                $global_average['items'][$imageName] = $global_average['items'][$oldName];
                unset($global_average['items'][$oldName]);
                $existingUUIDs[$uuid] = $imageName;
            }
        } elseif (!isset($global_average['items'][$imageName])) {
            $global_average['items'][$imageName] = $defaultData;
        }
    }

    // Remove items whose UUID no longer exists in indexed_json.json
    $currentUUIDs = [];
    foreach ($current_data['items'] as $imageName => $defaultData) {
        $uuid = extractUUID($imageName);
        if ($uuid) {
            $currentUUIDs[$uuid] = true;
        }
    }
    foreach ($global_average['items'] as $imageName => $itemData) {
        $uuid = extractUUID($imageName);
        if ($uuid && !isset($currentUUIDs[$uuid])) {
            unset($global_average['items'][$imageName]);
        } elseif (!$uuid && !isset($current_data['items'][$imageName])) {
            unset($global_average['items'][$imageName]);
        }
    }

    // Update total stats
    $global_average['total-stats']['total-item-number'] = count($global_average['items']);

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

    // Write back if no file handle (standalone sync, e.g. from send)
    if (!$fileHandle) {
        file_put_contents($dataFile, json_encode($global_average), LOCK_EX);
    }

    return $global_average;
}

// Initialize data file if it doesn't exist yet
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode(initializeDataFile()));
}
