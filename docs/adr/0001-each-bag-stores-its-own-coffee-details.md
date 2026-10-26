# Each Bag stores its own coffee details

The vault is otherwise normalized: Roasters, Producers, Grinders, Brewers and
Waters are their own notes, and Bags and Brews link to them. A Bag, however,
stores the coffee's details itself (name, origin, variety, process, tasting
notes and the rest), with no shared "coffee" note above it. Specialty lots are
seasonal, so buying the same lot twice is rare, and roasts of one lot vary, so
the Bag is the unit worth rating. When a lot is bought again, its details are
copied into the new Bag.
