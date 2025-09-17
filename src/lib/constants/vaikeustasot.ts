export type Vaikeustaso =
  | "oppipoika"
  | "taitaja"
  | "mestari"
  | "kuningas"
  | "suurmestari";

export const VAKEUSTASO_MAP: Record<Vaikeustaso, { label: string; icon: string }> = {
  oppipoika: { label: "Aloittelija", icon: "🌱" },
  taitaja: { label: "Oppinut", icon: "📘" },
  mestari: { label: "Tutkija", icon: "🔬" },
  // We'll map both top tiers to the same displayed label "Mestari" so the UI shows 4 levels
  kuningas: { label: "Mestari", icon: "👑" },
  suurmestari: { label: "Suurmestari", icon: "🏆" }
};

// Lista vaikeustasoista jotka ovat valittavissa UI:ssa. 'suurmestari' ei sisälly tähän,
// koska sitä käytetään vain erikoiskysymyksiin myöhemmin.
export const SELECTABLE_VAIKEUSTASOT = [
  'oppipoika',
  'taitaja',
  'mestari',
  'kuningas'
] as const;

export type SelectableVaikeustaso = typeof SELECTABLE_VAIKEUSTASOT[number];

export function vaikeustasoLabel(key: string | Vaikeustaso): string {
  const k = key as Vaikeustaso;
  return VAKEUSTASO_MAP[k]?.label ?? VAKEUSTASO_MAP.oppipoika.label;
}

export function vaikeustasoIcon(key: string | Vaikeustaso): string {
  const k = key as Vaikeustaso;
  return VAKEUSTASO_MAP[k]?.icon ?? VAKEUSTASO_MAP.oppipoika.icon;
}

export function vaikeustasoDisplay(key: string | Vaikeustaso): string {
  return `${vaikeustasoIcon(key)} ${vaikeustasoLabel(key)}`;
}
