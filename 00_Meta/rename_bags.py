"""Rename each Bag note to "Roaster – Name – Roast date".

A bag without a roast date gets "Roaster – Name". The script reads the
Roaster, Name and Roast date properties of each note in Bags/ and prints
every rename.

Usage: python3 00_Meta/rename_bags.py
"""

import re
from pathlib import Path

BAGS = Path(__file__).resolve().parent.parent / "Bags"


def _prop(text: str, key: str) -> str:
    # The property's value, without quotes and [[ ]].
    match = re.search(rf"^{re.escape(key)}:[ \t]*(.*)$", text, re.MULTILINE)
    value = match.group(1) if match else ""
    return value.strip().strip("\"'").removeprefix("[[").removesuffix("]]")


def main() -> None:
    """Rename every bag whose file name differs from its properties."""
    for note in sorted(BAGS.glob("*.md")):
        # Only the properties count, not a matching line in the body.
        text = note.read_text(encoding="utf-8").split("\n---\n", 1)[0]
        parts = [_prop(text, "Roaster"), _prop(text, "Name"), _prop(text, "Roast date")]
        name = " – ".join(part for part in parts if part)
        if name and name != note.stem:
            target = note.with_name(f"{name}.md")
            if target.exists():
                print(
                    f"Skipped '{note.stem}': '{target.name}' exists. Merge the two notes."
                )
                continue
            note.rename(target)
            print(f"'{note.stem}' -> '{name}'")


if __name__ == "__main__":
    main()
