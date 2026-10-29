"""Rename each Bag note to "Roaster – Name – Roast date".

A bag without a roast date gets "Roaster – Name". The script reads the
Roaster, Name and Roast date properties of each note in Bags/. It renames
the note and its photo in Attachments/, and it updates every link to them
in the vault. It prints every rename.

Usage: python3 00_Meta/rename_bags.py
"""

import re
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent
BAGS = VAULT / "Bags"
ATTACHMENTS = VAULT / "Attachments"


def _prop(text: str, key: str) -> str:
    # The property's value, without quotes and [[ ]].
    match = re.search(rf"^{re.escape(key)}:[ \t]*(.*)$", text, re.MULTILINE)
    value = match.group(1) if match else ""
    return value.strip().strip("\"'").removeprefix("[[").removesuffix("]]")


def _notes() -> list[Path]:
    # Every note in the vault, without hidden folders such as .obsidian and .site.
    return [
        p
        for p in VAULT.rglob("*.md")
        if not any(part.startswith(".") for part in p.relative_to(VAULT).parts)
    ]


def _relink(old: str, new: str) -> None:
    # Point [[old]], [[old|text]], [[old#heading]] and ![[old]] at new in every note.
    link = re.compile(rf"(\[\[){re.escape(old)}(?=[|#\]])")
    for note in _notes():
        text = note.read_text(encoding="utf-8")
        relinked = link.sub(lambda m: m.group(1) + new, text)
        if relinked != text:
            note.write_text(relinked, encoding="utf-8")


def _rename_photo(old: str, new: str, photo: str) -> None:
    # The photo follows the note only when it is named after the note.
    source = ATTACHMENTS / photo
    if Path(photo).stem != old or not source.exists():
        return
    target = source.with_name(f"{new}{source.suffix}")
    if target.exists():
        print(f"Skipped photo '{photo}': '{target.name}' exists.")
        return
    source.rename(target)
    _relink(photo, target.name)
    print(f"  photo '{photo}' -> '{target.name}'")


def main() -> None:
    """Rename every bag whose file name differs from its properties."""
    for note in sorted(BAGS.glob("*.md")):
        # Only the properties count, not a matching line in the body.
        text = note.read_text(encoding="utf-8").split("\n---\n", 1)[0]
        parts = [_prop(text, "Roaster"), _prop(text, "Name"), _prop(text, "Roast date")]
        name = " – ".join(part for part in parts if part)
        if not name or name == note.stem:
            continue
        target = note.with_name(f"{name}.md")
        if target.exists():
            print(
                f"Skipped '{note.stem}': '{target.name}' exists. Merge the two notes."
            )
            continue
        old = note.stem
        note.rename(target)
        print(f"'{old}' -> '{name}'")
        _relink(old, name)
        _rename_photo(old, name, _prop(text, "Photo"))


if __name__ == "__main__":
    main()
