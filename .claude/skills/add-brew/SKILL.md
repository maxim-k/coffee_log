---
name: add-brew
description: Create a Brew note for a cup the user just made or had, copying the last brew of the same Bag and changing only what the user names. Use when the user says they brewed, pulled a shot, made a pour-over or espresso, or had a coffee at a café.
---

# Add a Brew

A Brew is one cup (see `GLOSSARY.md`). The user says only what changed, so a
new Brew repeats the last one of its Bag. Every property the user leaves out
keeps the source brew's value. `Rating` and comments are never copied.

## 1. Gather the input

The user may name the Bag, the method, any brewing parameter, a rating and
comments, often by voice and loosely ("hotter, 92", "a bit finer, 1-0-5",
"it was bitter"). Map each one to its property. Several cups in one message
become several notes, in the order the user made them.

Ask only when the Bag is ambiguous. Without a named Bag, use the Bag of the
newest brew in `Brews/`.

## 2. Pick the source brew

Brews sort by `Date`, then by the `- N` suffix of the file name. Take the
first match:

1. The newest brew of this Bag made the same way: same Brewer, or the same
   kind (pour-over or espresso) when the user names a new Brewer or only the
   method.
2. The newest brew of this Bag when the user names no method.
3. The newest brew of the same kind with any Bag.
4. No source: start from the template in `Templates/` for the kind.

A café cup never has a source. Start it from `Templates/Brew - Cafe.md`.

The kind decides the property set. Use the template for the kind, `Brew -
Pour-over`, `Brew - Espresso` or `Brew - Cafe`, and keep its property order.

## 3. Write the note

- `Date` is today, as `YYYY-MM-DD`.
- `Bag` links the chosen Bag.
- Every other property is the source brew's value, unless the user gave
  one.
- `Rating` is the user's score from 1 to 5, or empty. Never guess it from
  the comments. Ask for it after the note is written instead.
- `Ratio` is the one derived property. When `Dose (g)` changes, or `Water
  weight (g)` for a pour-over or `Yield (g)` for an espresso, recalculate it
  as `1:<water or yield ÷ dose>`. Round it to one decimal place and drop a
  trailing `.0`.
- `Grind` holds the dial as set (`1-0-5`). Derive nothing from it.
- A property neither the source nor the user fills stays empty.

Name the note `Brews/YYYY-MM-DD - N.md`, where N is 1 plus the number of
today's existing brews. The body is the H1 `# YYYY-MM-DD - N`, a blank line,
and `## Comments`, then the user's comments in their own words, if they gave
any. Style notes the user mentions, such as "turbo shot", go in the comments.

## 4. Link the equipment

`Grinder`, `Brewer` and `Water` link notes in `Grinders/`, `Brewers/` and
`Waters/`. When the user names one with no note, create it from its template
in `Templates/` and fill what the manufacturer's facts answer.

## 5. Commit and push

Follow the branch steps in `CLAUDE.md`, and use the `conventional-commit` skill for
the message (`feat: log a pour-over brew of <bag>`). Stage only the new and
changed notes.

## 6. Report

In a few lines: each note's name, the properties that differ from the source
brew, and any equipment note created. Name empty properties the user may
want to fill, such as `Rating`.
