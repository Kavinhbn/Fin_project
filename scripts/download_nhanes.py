r"""Download NHANES 2005-2018 component files (public CDC data) into data/raw.

Usage: .venv\Scripts\python scripts/download_nhanes.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_preprocessing.nhanes import COMPONENTS, CYCLES

BASE = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/{year}/DataFiles/{comp}_{letter}.xpt"


def main(raw_dir: Path = Path("data/raw")) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    for letter, years in CYCLES.items():
        for comp in COMPONENTS:
            dest = raw_dir / f"{comp}_{letter}.xpt"
            if dest.exists() and dest.stat().st_size > 0:
                continue
            url = BASE.format(year=years.split("-")[0], comp=comp, letter=letter)
            print(f"downloading {url}")
            urllib.request.urlretrieve(url, dest)


if __name__ == "__main__":
    main()
