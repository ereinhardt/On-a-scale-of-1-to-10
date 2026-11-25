## Tools (Order important)

### 0. remove-first-n-chars.py (optional):<br>
Removes a specified number of characters from the beginning of each PNG filename in the given folder.

```bash
python remove-first-n-chars.py
```

### 1. create-item-uuid.py:<br>
Renames all PNG files by prepending a unique UUID to each filename.

```bash
python create-item-uuid.py
```

### 2. create-item-scale-variations.py:<br>
Generates downscaled 512×512 and 256×256 variants from the 1024×1024 original images.

```bash
python create-item-scale-variations.py
```

### 3. create-indexed-json.py:<br>
Scans all processed PNG files and generates an ```indexed_json.json``` containing paths, categories, and labels for the game.

```bash
python create-indexed-json.py
```
