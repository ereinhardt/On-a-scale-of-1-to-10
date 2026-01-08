<?php

/*
================================================================================
WIE DIE BEWERTUNGS-BERECHNUNG FUNKTIONIERT
================================================================================

Stell dir vor, du hast eine Klasse mit vielen Kindern, und jedes Kind soll 
Bilder (z.B. von Essen, Ländern, oder Zahlen) mit einer Note von 1 bis 10 
bewerten. Dieses Programm sammelt alle Bewertungen und berechnet daraus 
einen "Durchschnitt" für jedes Bild.

--------------------------------------------------------------------------------
1. WAS WIRD GESPEICHERT?
--------------------------------------------------------------------------------

Für jedes Bild speichern wir:
  - "sums"             → Eine Liste aller Bewertungen (z.B. [7, 8, 6, 9, 8])
  - "classical-average"→ Der normale Durchschnitt (alle Zahlen addiert ÷ Anzahl)
  - "global-average"   → Ein "gewichteter" Durchschnitt (erklärt unten)
  - "deviation"        → Wie weit wir vom berechneten Wert abweichen mussten

--------------------------------------------------------------------------------
2. DIE BERECHNUNG - SCHRITT FÜR SCHRITT
--------------------------------------------------------------------------------

BEISPIEL: Pizza hat schon Bewertungen [7, 8, 6, 9] und jemand gibt jetzt eine 8.

SCHRITT A: Classical Average (Normaler Durchschnitt)
----------------------------------------------------
  Das ist der einfache Durchschnitt, den du aus der Schule kennst:
  
  Alle Zahlen zusammenzählen: 7 + 8 + 6 + 9 + 8 = 38
  Durch die Anzahl teilen:    38 ÷ 5 = 7,6
  
  → Classical Average = 7,6

SCHRITT B: Gewichteter Durchschnitt (Global Average Basis)
----------------------------------------------------------
  Hier machen wir etwas Besonderes! Die neue Bewertung zählt mehr als die alten.
  
  Warum? Stell dir vor, ein Bild hat schon 1000 Bewertungen. Wenn jemand Neues 
  bewertet, würde seine Meinung beim normalen Durchschnitt fast gar nicht 
  zählen. Das wäre unfair! 
  
  Deshalb verwenden wir eine "Gewichtung":
  
  - Alter Durchschnitt (OHNE die neue Bewertung):
     (7 + 8 + 6 + 9) = 30   →   30 ÷ 4 = 7,5
  
  - Gewichtete Berechnung (calculated average):
     80% vom alten Durchschnitt + 20% von der neuen Bewertung
     
     = 7,5 × 0,8 + 8 × 0,2
     = 6,0 + 1,6
     = 7,6
  
  Die Formel ist also:
  ┌──────────────────────────────────────────────────────────────┐
  │  Neuer Wert = (Alter Durchschnitt × 0,8) + (Neue Note × 0,2) │
  └──────────────────────────────────────────────────────────────┘

--------------------------------------------------------------------------------
3. EINZIGARTIGEN WERT FINDEN (findUniqueAverage)
--------------------------------------------------------------------------------

  Jetzt kommt der knifflige Teil! Jedes Bild soll einen EINZIGARTIGEN 
  Durchschnitt haben, damit wir eine eindeutige Rangliste erstellen können.
  
  Das Problem: Was wenn zwei Bilder den gleichen Durchschnitt haben?
  Beispiel: Pizza hat 7,6 und Burger hat auch 7,6
  
  Die Lösung: Wir suchen den nächsten freien Wert! (Wie bei einem Parkplatz)
  
  DIE SUCH-STRATEGIE ("BASISWERTE")
  ────────────────────────────────────
  Wir suchen nicht einfach der Reihe nach, sondern intelligent und zufällig,
  damit die Ergebnisse natürlich aussehen.
  
  RUNDE 1: Suche mit 1 Dezimalstelle
  ───────────────────────────────────
  Egal welchen targetAverage wir haben, wir starten IMMER mit 1 Dezimalstelle.
  
  1. Wir erstellen ~11 "Basiswerte" um den Zielwert herum.
     Beispiel bei targetAverage=1,0: Basiswerte sind 1,0, 1,1, 1,2, 1,3, 1,4, 1,5
     (0,5 bis 0,9 werden ignoriert, da < 1,0)
     
  2. Wir MISCHEN diese Basiswerte zufällig.
  
  3. ALLE diese Basiswerte sind mögliche Kandidaten.
     Sie werden gemischt probiert, z.B.: 1,3 → 1,1 → 1,5 → 1,2 → 1,4 → 1,0
     → Ist 1,3 frei? JA? Nehmen! (Fertig!)
     → NEIN? Probiere 1,1 usw.
  
  RUNDE 2: Verfeinerung auf 2 Dezimalstellen
  ──────────────────────────────────────────
  Wenn in Runde 1 alles belegt war:
  
  1. Wir erweitern JEDEN Basiswert aus Runde 1 um ±5 Schritte (0,01).
     Beispiel: Aus 1,0 werden: 0,95, 0,96, 0,97, 0,98, 0,99, 1,00, 1,01, 1,02, 1,03, 1,04, 1,05
     Beispiel: Aus 1,1 werden: 1,05, 1,06, 1,07, 1,08, 1,09, 1,10, 1,11, 1,12, 1,13, 1,14, 1,15
     Beispiel: Aus 1,2 werden: 1,15, 1,16, 1,17, 1,18, 1,19, 1,20, 1,21, 1,22, 1,23, 1,24, 1,25
     Beispiel: Aus 1,3 werden: 1,25, 1,26, 1,27, 1,28, 1,29, 1,30, 1,31, 1,32, 1,33, 1,34, 1,35
     Beispiel: Aus 1,4 werden: 1,35, 1,36, 1,37, 1,38, 1,39, 1,40, 1,41, 1,42, 1,43, 1,44, 1,45
     Beispiel: Aus 1,5 werden: 1,45, 1,46, 1,47, 1,48, 1,49, 1,50, 1,51, 1,52, 1,53, 1,54, 1,55
     
  2. ALLE diese Werte werden in einen großen Pool geworfen und zusammen gemischt.
     (Duplikate werden entfernt, z.B. 1,05 kommt nur einmal vor)
     Das ergibt ca. 50-100 Kandidaten.
     
  3. Wir probieren ALLE zufällig durchgemischt:
     z.B.: 1,17 → 1,03 → 1,28 → 1,14 → 1,21 → ...
     Kein fester Ablauf wie "erst 1,01, dann 1,02" - alles zufällig!
  
  RUNDE 3: Verfeinerung auf 3 Dezimalstellen
  ──────────────────────────────────────────
  Wenn in Runde 2 alles belegt war:
  
  Die Basiswerte aus Runde 2 werden wieder erweitert (±5 × 0,001).
  Die Basiswerte aus Runde 2 waren: 0,95, 0,96, 0,97, ..., 1,00, 1,01, 1,02, 1,03, ..., 1,54, 1,55 (in 0,01-Schritten)
  
  Beispiel: Aus 1,00 werden: 0,995, 0,996, 0,997, 0,998, 0,999, 1,000, 1,001, 1,002, 1,003, 1,004, 1,005
  Beispiel: Aus 1,01 werden: 1,005, 1,006, 1,007, 1,008, 1,009, 1,010, 1,011, 1,012, 1,013, 1,014, 1,015
  Beispiel: Aus 1,02 werden: 1,015, 1,016, 1,017, 1,018, 1,019, 1,020, 1,021, 1,022, 1,023, 1,024, 1,025
  ... (das gleiche für 1,03, 1,04, 1,05, ... bis 1,55)
  
  Alle diese Werte werden gesammelt, gemischt und zufällig probiert.
  
  RUNDE 4: Maximale Genauigkeit (4 Dezimalstellen)
  ────────────────────────────────────────────────
  Die Basiswerte aus Runde 3 werden wieder erweitert (±5 × 0,0001).
  Die Basiswerte aus Runde 3 waren: 0,995, 0,996, 0,997, ..., 1,000, 1,001, 1,002, ... bis 1,555 (in 0,001-Schritten)
  
  Beispiel: Aus 1,000 werden: 0,9995, 0,9996, 0,9997, 0,9998, 0,9999, 1,0000, 1,0001, 1,0002, 1,0003, 1,0004, 1,0005
  Beispiel: Aus 1,001 werden: 1,0005, 1,0006, 1,0007, 1,0008, 1,0009, 1,0010, 1,0011, 1,0012, 1,0013, 1,0014, 1,0015
  Beispiel: Aus 1,010 werden: 1,0095, 1,0096, 1,0097, 1,0098, 1,0099, 1,0100, 1,0101, 1,0102, 1,0103, 1,0104, 1,0105
  Beispiel: Aus 1,555 werden: 1,5545, 1,5546, 1,5547, 1,5548, 1,5549, 1,5550, 1,5551, 1,5552, 1,5553, 1,5554, 1,5555
  ... (das gleiche für alle Basiswerte in 0,001-Schritten)
  
  Die höchsten Basiswerte gehen also bis 1,5555!
  Das gibt uns 90.000 mögliche Werte zwischen 1,0000 und 10,0000!
  Alle werden gesammelt, gemischt und zufällig probiert.

  NOTFALL-PLAN: Systematische Suche (Fallback)
  ───────────────────────────────────────────────
  Wenn selbst in Runde 4 (nach 121 x 11 x 11 Versuchen) nichts frei war:
  
  Wir hören auf mit Zufall und suchen STUR den nächsten freien Platz.
  Wir gehen vom Zielwert (z.B. 7,6) in winzigen Schritten (0,0001) weg:
  
     1. 7,6001? Belegt.
     2. 7,5999? Belegt.
     3. 7,6002? FREI! → Nehmen.
     
  Irgendwann MUSS ein Platz frei sein (es gibt ja 90.000 Plätze!).

  WARUM SO KOMPLIZIERT?
  1. SCHNELLER: Wir finden schnell einen freien Wert.
  2. NATÜRLICHER: Durch das Mischen sehen die Werte zufälliger aus.

--------------------------------------------------------------------------------
4. WAS PASSIERT BEI NEU-BEWERTUNG?
--------------------------------------------------------------------------------

  Wenn Pizza (aktuell 7,6001) neu bewertet wird:
  
  1. Der alte Wert (7,6001) wird "freigegeben" (zählt nicht als belegt).
  2. Ein komplett neuer Durchschnitt wird berechnet (z.B. 7,52).
  3. Ein neuer freier Platz für 7,52 wird gesucht.
  
  ACHTUNG: Der global-average kann sich also komplett ändern, nicht nur um 0,0001!

--------------------------------------------------------------------------------
5. SICHERHEIT: FILE LOCKING
--------------------------------------------------------------------------------

  Was passiert, wenn 100 Leute gleichzeitig bewerten?
  
  Lösung: Wir benutzen ein "Schloss" (Lock) für die Datei.
  Das ist wie eine Toilettentür mit Schloss - nur einer darf rein!
  Alle anderen müssen kurz warten, bis der Erste fertig geschrieben hat.

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

    // Starte IMMER mit 1 Dezimalstelle, unabhängig vom targetAverage
    $basePrecision = 1;
    $baseStep = 0.1; // Schrittweite für 1 Dezimalstelle

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

        // Generiere ALLE möglichen Kandidaten für diese Präzision
        $allCandidates = [];
        
        foreach ($bases as $base) {
            // Füge den Basiswert selbst hinzu
            $baseCandidate = round($base, $precision);
            if ($baseCandidate >= 1 && $baseCandidate <= 10) {
                $allCandidates[] = $baseCandidate;
            }

            // In Runde 1: Nur Basiswerte, keine Deviation!
            // Ab Runde 2: Erweitere jeden Basiswert um ±5 Schritte
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

        // Entferne Duplikate und mische alle Kandidaten zufällig
        $allCandidates = array_unique($allCandidates);
        shuffle($allCandidates);

        // Probiere alle Kandidaten in zufälliger Reihenfolge
        foreach ($allCandidates as $candidate) {
            if (!isset($existingAverages[sprintf("%.4f", $candidate)])) {
                return $candidate;
            }
        }

        // Für die nächste Präzision: erweitere die Basiswerte
        // Verwende die NÄCHSTKLEINERE Schrittweite (nächste Präzision)
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