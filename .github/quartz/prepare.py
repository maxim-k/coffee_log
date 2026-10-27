"""Copy the coffee notes of the vault into a Quartz content folder.

The script copies only the note folders and the photos. In each note, it
removes properties with no value and the first H1, because Quartz shows
empty properties as a dash and prints the title itself. The properties
panel of Quartz uses a link target as written, so the script rewrites
each property link to the full page path. Quartz finds backlinks only in
the note body, so the script adds a section to each linked note that
lists the notes that link to it, one section for each folder. It also
writes the home page, which links to the note folders.

Usage:
  python3 prepare.py VAULT CONTENT
"""

import re
import shutil
import sys
from collections import defaultdict
from collections.abc import Mapping
from pathlib import Path

FOLDERS = (
    "Bags",
    "Brews",
    "Roasters",
    "Producers",
    "Grinders",
    "Brewers",
    "Waters",
)
EMPTY_PROPERTY = re.compile(r"^[A-Za-z_][\w-]*:\s*$")
LIST_ITEM = re.compile(r"^\s+- ")
WIKILINK = re.compile(r"\[\[([^\]|]+)\]\]")


def slugify(path: str) -> str:
    """Return the Quartz page path for a vault path."""
    path = path.removesuffix(".md")
    path = re.sub(r"\s", "-", path).replace("&", "-and-")
    return path.replace("%", "-percent").replace("?", "").replace("#", "")


def property_links(text: str) -> list[str]:
    """Return the names of the notes that the properties link to."""
    if not text.startswith("---\n"):
        return []
    return WIKILINK.findall(text.split("---\n", 2)[1])


def linked_from_sections(sources: Mapping[str, list[str]]) -> str:
    """Return one Markdown section for each folder that links to a note.

    :param sources: The linking note names for each folder name.
    """
    return "".join(
        f"\n## {folder}\n\n" + "".join(f"- [[{name}]]\n" for name in sorted(names))
        for folder, names in sorted(sources.items())
    )


def clean_note(text: str, targets: Mapping[str, str]) -> str:
    """Clean the properties and remove the first H1 from one note.

    :param targets: The Quartz page path for each link name.
    """
    if not text.startswith("---\n"):
        return text
    _, frontmatter, body = text.split("---\n", 2)
    lines = frontmatter.splitlines()
    kept = [
        WIKILINK.sub(lambda m: f"[[{targets.get(m[1], m[1])}|{m[1]}]]", line)
        for i, line in enumerate(lines)
        # A key with no value is empty only when no list items follow it.
        if not (
            EMPTY_PROPERTY.match(line)
            and not (i + 1 < len(lines) and LIST_ITEM.match(lines[i + 1]))
        )
    ]
    body = re.sub(r"^\s*# .*\n", "", body, count=1)
    return "---\n" + "\n".join(kept) + "\n---\n" + body


def main(vault: Path, content: Path) -> None:
    """Fill the content folder from the vault."""
    shutil.rmtree(content, ignore_errors=True)
    shutil.copytree(vault / "Attachments", content / "Attachments")
    notes = [note for f in FOLDERS for note in (vault / f).glob("*.md")]
    targets = {note.stem: slugify(f"{note.parent.name}/{note.stem}") for note in notes}
    targets |= {
        photo.name: slugify(f"Attachments/{photo.name}")
        for photo in (vault / "Attachments").iterdir()
    }
    texts = {note: note.read_text(encoding="utf-8") for note in notes}
    linked_from: defaultdict[str, defaultdict[str, list[str]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for note, text in texts.items():
        for name in property_links(text):
            linked_from[name][note.parent.name].append(note.stem)
    for note, text in texts.items():
        out = content / note.parent.name / note.name
        out.parent.mkdir(parents=True, exist_ok=True)
        page = clean_note(text, targets).rstrip("\n") + "\n"
        page += linked_from_sections(linked_from.get(note.stem, {}))
        out.write_text(page, encoding="utf-8")
    # Without an index page, Quartz titles a folder "Folder: <name>".
    for folder in FOLDERS:
        (content / folder).mkdir(exist_ok=True)
        (content / folder / "index.md").write_text(
            f"---\ntitle: {folder}\n---\n", encoding="utf-8"
        )
    links = "\n".join(f"- [{folder}](./{folder}/)" for folder in FOLDERS)
    (content / "index.md").write_text(
        f"---\ntitle: Coffee Log\n---\n\n{links}\n", encoding="utf-8"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
