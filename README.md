# On-a-scale-of-1-to-10 (v.1.6-2-2026)

"On a Scale from 1 to 10" is a (web-based) face-filter where users rate randomly displayed items sourced from other online filters.

by Erik Anton Reinhardt, Finn Jakob Reinhardt.<br>
[MIT License]

---

**Pre-Setup (Checklist):**

1. PHP v.8.X or higher (Recommended).
2. Pre-UUID Filename Structure. The Item-Image need to be a PNG (1024 × 1024px / 8bit) in following Structure:

```bash
1024__8bit__CATEGORY-NAME__ITEM-LABEL.png
Example: 1024__8bit__Food__Apple.png
```
**Note**:

Do not use any special characters in the Item-Filename (only ```A–Z```, ```a–z```, ```0–9```, ```_```, and ```-``` are allowed).

## Tools (Order important)

### 1. create-item-uuid.py:<br>

```bash
python create-item-uuid.py
```

### 2. create-item-scale-variations.py:<br>

```bash
python create-item-scale-variations.py
```

### 3. create-indexed-json.py:<br>

```bash
python create-indexed-json.py
```

## Start

1. Create a folder named ```item-data``` in the root directory and move all processed items and the ```indexed_json.json``` file into it.
2. Upload everything combined to your Webserver.
