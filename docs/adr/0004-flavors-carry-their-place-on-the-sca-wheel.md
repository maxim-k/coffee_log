# Flavors carry their place on the SCA flavor wheel

A Flavor's `Parent` links its section of the WCR Sensory Lexicon, which has
15 sections. The SCA flavor wheel, drawn from the same lexicon, groups the
attributes differently: nine families, with tiers such as Sour/Fermented,
Nutty/Cocoa and Papery/Musty that aren't lexicon attributes. The lexicon
fixes the Flavor set, so those tiers can't become notes, and `Parent` can't
hold the wheel.

Each Flavor now has a `Wheel` property: its path on the wheel as text, root
first, ending with its own label, in the wheel's words (`Sweet`,
`Brown Sugar`, `Molasses`). `Parent` keeps the lexicon. A lexicon section
that matches a tier sits on it (Sour-Acid on Sour, Green-Vegetative on the
outer Green/Vegetative), and an attribute the wheel doesn't show, such as
Mouthfeel or the basic taste Sour, leaves `Wheel` empty.
