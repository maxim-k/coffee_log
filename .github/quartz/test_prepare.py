"""Check that prepare.clean_note keeps values and drops only empty ones.

Usage:
  python3 test_prepare.py
"""

from prepare import clean_note, linked_from_sections, property_links, slugify

NOTE = """---
roaster: "[[Regalia Coffee]]"
roast_date:
variety:
  - Chiroso
producer:
  - "[[Unknown Producer]]"
lot:
---

# Regalia Coffee – Chiroso Lot 7

![[photo.png]]

# A later H1 stays
"""

EXPECTED = """---
roaster: "[[Roasters/Regalia-Coffee|Regalia Coffee]]"
variety:
  - Chiroso
producer:
  - "[[Unknown Producer|Unknown Producer]]"
---

![[photo.png]]

# A later H1 stays
"""

if __name__ == "__main__":
    targets = {"Regalia Coffee": slugify("Roasters/Regalia Coffee")}
    assert clean_note(NOTE, targets) == EXPECTED, clean_note(NOTE, targets)
    assert clean_note("# No properties\n", {}) == "# No properties\n"
    assert property_links(NOTE) == ["Regalia Coffee", "Unknown Producer"]
    assert linked_from_sections({"Bags": ["B", "A"]}) == (
        "\n## Bags\n\n- [[A]]\n- [[B]]\n"
    )
    assert slugify("Roasters/S&W Craft Roasting.md") == (
        "Roasters/S-and-W-Craft-Roasting"
    )
    print("ok")
