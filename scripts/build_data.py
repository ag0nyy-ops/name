#!/usr/bin/env python3
import csv
import json
import os
import pathlib
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

SSA_URL = "https://www.ssa.gov/oact/babynames/names.zip"
CENSUS_URL = "https://www2.census.gov/topics/genealogy/2010surnames/names.zip"


def download(url: str, dest: pathlib.Path) -> None:
    print(f"Downloading {url} -> {dest}")
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "name-rarity-data-builder/1.0 (+https://github.com/ag0nyy-ops/name)",
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(request) as response, open(dest, "wb") as file:
        file.write(response.read())


def build_ssa() -> dict:
    # prefer local extracted folder: ROOT/names/yob*.txt
    local_dir = ROOT / "names"

    counts: dict[str, int] = {}

    def ingest_lines(lines: list[str]) -> None:
        for raw_line in lines:
            if not raw_line:
                continue
            parts = raw_line.split(",")
            if len(parts) < 3:
                continue
            raw_name, _, count = parts
            key = raw_name.strip().lower()
            if not key:
                continue
            counts[key] = counts.get(key, 0) + int(count)

    if local_dir.exists():
        print(f"Using local SSA directory: {local_dir}")
        yob_files = sorted(local_dir.glob("yob*.txt"))
        if not yob_files:
            raise RuntimeError(f"SSA directory exists but no yob*.txt files found in {local_dir}")
        for path in yob_files:
            ingest_lines(path.read_text(encoding="utf-8").splitlines())
    else:
        # last resort: download (may 403)
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = pathlib.Path(tmpdir)
            zip_path = tmp_path / "ssa_names.zip"
            download(SSA_URL, zip_path)
            with zipfile.ZipFile(zip_path) as archive:
                for name in archive.namelist():
                    if not name.startswith("yob") or not name.endswith(".txt"):
                        continue
                    with archive.open(name) as file:
                        ingest_lines(file.read().decode("utf-8").splitlines())

    return build_table(
        counts,
        source="SSA baby names (1880-latest), aggregated across years",
    )


def build_census() -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = pathlib.Path(tmpdir)
        zip_path = tmp_path / "census_names.zip"
        download(CENSUS_URL, zip_path)

        counts: dict[str, int] = {}
        with zipfile.ZipFile(zip_path) as archive:
            target = None
            for name in archive.namelist():
                if name.lower().endswith(".csv"):
                    target = name
                    break
            if not target:
                raise RuntimeError("No CSV found in census zip")
            with archive.open(target) as file:
                reader = csv.DictReader(
                    (line.decode("utf-8") for line in file.readlines())
                )
                for row in reader:
                    raw_name = (row.get("name") or row.get("NAME") or "").strip()
                    raw_count = (row.get("count") or row.get("COUNT") or "").strip()
                    if not raw_name or not raw_count:
                        continue
                    key = raw_name.lower()
                    counts[key] = int(raw_count)

        return build_table(
            counts,
            source="US Census 2010 surnames (ranked list, >=100 occurrences)",
        )


def build_table(counts: dict[str, int], source: str) -> dict:
    """Build a compact frequency table: {name: count}, most common first.

    Keys are lowercase a-z only (the SSA and Census files already strip
    accents, spaces, hyphens and apostrophes). Rank is the position in the
    object, so the order matters.
    """
    counts = {name: count for name, count in counts.items() if name != "all other names"}
    sorted_items = sorted(counts.items(), key=lambda item: (-item[1], item[0]))

    return {
        "source": source,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totalNames": len(sorted_items),
        "totalCount": sum(counts.values()),
        "names": dict(sorted_items),
    }


def main() -> None:
    ssa = build_ssa()
    census = build_census()

    ssa_path = DATA_DIR / "ssa-first-names.json"
    census_path = DATA_DIR / "census-surnames.json"

    with open(ssa_path, "w", encoding="utf-8") as file:
        json.dump(ssa, file, ensure_ascii=False, separators=(",", ":"))
    with open(census_path, "w", encoding="utf-8") as file:
        json.dump(census, file, ensure_ascii=False, separators=(",", ":"))

    # Small summary the site's static pages read, so they never import the big tables.
    meta_path = ROOT / "data" / "datasets.json"
    meta = {
        key: {k: table[k] for k in ("source", "generatedAt", "totalNames", "totalCount")}
        for key, table in (("first", ssa), ("last", census))
    }
    with open(meta_path, "w", encoding="utf-8") as file:
        json.dump(meta, file, indent=2)
        file.write("\n")

    print(f"Wrote {ssa_path}")
    print(f"Wrote {census_path}")
    print(f"Wrote {meta_path}")


if __name__ == "__main__":
    main()
