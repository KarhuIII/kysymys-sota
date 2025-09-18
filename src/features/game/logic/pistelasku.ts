// Pure pistelaskenta logic (no DB or side effects). This will hold functions
// such as laskePerusPisteet, laskeNopeusBonus, ja yhdistetty laskenta joka
// voidaan yksikkötestata.

export function laskePerusPisteet(vaikeustaso: string) {
  // placeholder: real logic will be added when migrating gameService
  const base = {
    oppipoika: 10,
    taitaja: 15,
    mestari: 20,
    suurmestari: 40
  } as Record<string, number>;
  return base[vaikeustaso] ?? 10;
}

export function laskeNopeusBonus(sekunteja: number) {
  // Example: linear bonus, faster => higher bonus
  return Math.max(0, Math.round((30 - sekunteja) * 0.5));
}
