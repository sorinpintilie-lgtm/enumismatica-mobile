export const GRADE_OPTIONS = ['PF', 'MS', 'AU', 'XF/EF'] as const;

export const MATERIAL_OPTIONS = [
  'Argint 925',
  'Argint 999',
  'Aliaj cupru argintat',
  'Tombac',
  'Tombac argintat',
] as const;

export const DIAMETER_RANGE_OPTIONS = ['0-40', '40-60', '60-80', '80+'] as const;

export const DEFAULT_QUALITY_OPTION = 'Toate Calitățile';

export const normalizeGrade = (input?: string | null): string => {
  if (!input) return '';
  const v = String(input).toUpperCase().replace(/\s+/g, '');
  if (v.startsWith('PF') || v.startsWith('PR') || v.includes('PROOF')) return 'PF';
  if (v.startsWith('MS') || v.includes('MINTSTATE') || v === 'UNC' || v === 'BU') return 'MS';
  if (v.startsWith('AU')) return 'AU';
  if (v.startsWith('XF') || v.startsWith('EF') || v.includes('EXTREMELYFINE')) return 'XF/EF';
  return '';
};

export const normalizeMaterial = (input?: string | null): string => {
  if (!input) return '';
  const v = String(input)
    .toLowerCase()
    .replace(/[\u200B\n\r]+/g, ' ')
    .replace(/‰/g, '')
    .replace(/[^a-z0-9ăâîșț\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (v.includes('argint') && v.includes('925')) return 'Argint 925';
  if (v.includes('argint') && v.includes('999')) return 'Argint 999';
  if (v.includes('tombac') && v.includes('argint')) return 'Tombac argintat';
  if (v.includes('tombac')) return 'Tombac';
  if ((v.includes('aliaj') || v.includes('cupru')) && v.includes('argint')) return 'Aliaj cupru argintat';
  return '';
};

const parseLeadingNumber = (input?: string | null): number | null => {
  if (!input) return null;
  const match = String(input).match(/(\d+(?:[\.,]\d+)?)/);
  if (!match) return null;
  const n = Number(match[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const normalizeDiameterRange = (input?: string | null): string => {
  const n = parseLeadingNumber(input);
  if (n === null) return '';
  if (n < 40) return '0-40';
  if (n < 60) return '40-60';
  if (n < 80) return '60-80';
  return '80+';
};

export const normalizeWeight = (input?: string | null): string => {
  const n = parseLeadingNumber(input);
  if (n === null) return '';
  return `${n} g`;
};

/**
 * Weight range buckets used for the Monetăria Statului filter.
 * These are human-readable labels that map to numeric ranges.
 */
export const WEIGHT_RANGE_OPTIONS = [
  'Sub 10 g',
  '10 – 20 g',
  '20 – 50 g',
  '50 – 100 g',
  '100+ g',
] as const;

export type WeightRange = typeof WEIGHT_RANGE_OPTIONS[number];

/**
 * Maps a raw weight string (e.g. "31.1 g" or "31.1") to a display range bucket.
 * Returns '' when the value cannot be parsed.
 */
export const normalizeWeightRange = (input?: string | null): string => {
  const n = parseLeadingNumber(input);
  if (n === null) return '';
  if (n < 10) return 'Sub 10 g';
  if (n < 20) return '10 – 20 g';
  if (n < 50) return '20 – 50 g';
  if (n < 100) return '50 – 100 g';
  return '100+ g';
};

export const sortWeightsAsc = (values: string[]): string[] => {
  return [...values].sort((a, b) => {
    const na = parseLeadingNumber(a) ?? Number.MAX_SAFE_INTEGER;
    const nb = parseLeadingNumber(b) ?? Number.MAX_SAFE_INTEGER;
    return na - nb;
  });
};

/**
 * Canonical quality labels for Monetăria Statului products.
 * All raw variants from the data source are mapped to one of these.
 */
export const QUALITY_CANONICAL = [
  'Clasică',
  'Proof',
  'Proof Like',
  'Șablată',
  'Patinată',
  'Șablată Patinată',
] as const;

export type QualityCanonical = typeof QUALITY_CANONICAL[number];

export const normalizeQuality = (input?: string | null): string => {
  if (!input) return '';

  // Collapse zero-width spaces, newlines, stray punctuation, then lowercase
  const cleaned = String(input)
    .replace(/[\u200B\u00A0\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    // strip trailing dot / comma / semicolon left by bad data (e.g. "proof.")
    .replace(/[.,;:]+$/, '')
    // remove embedded prices like "pret: 121 lei"
    .replace(/\s*pret\s*:?\s*\d+\s*lei\s*/gi, '')
    // remove "tiraj fix" / "tiraj limitat" suffixes
    .replace(/\s*tiraj\s+(fix|limitat)\s*/gi, '')
    // remove stray digits and currency
    .replace(/\d+\s*lei\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  // ---- canonical mapping ----
  // Order matters: more specific patterns first

  // "sablata patinata" / "sablata, patinata" / "sablată patinată"
  if (/sabl[aă]t[aă][\s,]+patin[aă]t[aă]/.test(cleaned) ||
      /patin[aă]t[aă][\s,]+sabl[aă]t[aă]/.test(cleaned)) {
    return 'Șablată Patinată';
  }

  // "sablata" / "sablat" / "șablată"
  if (/^sabl[aă]t[aă]?$/.test(cleaned) || /^[șs]ablat[aă]?$/.test(cleaned)) {
    return 'Șablată';
  }

  // "proof like"
  if (/proof[\s-]+like/.test(cleaned)) return 'Proof Like';

  // "proof" (also catches "proof." already stripped above)
  if (/^proof$/.test(cleaned) || cleaned.startsWith('proof')) return 'Proof';

  // "patinata" / "patinată"
  if (/^patin[aă]t[aă]?$/.test(cleaned) || cleaned.startsWith('patin')) return 'Patinată';

  // "clasica" / "clasică"
  if (/^clasic[aă]?$/.test(cleaned) || cleaned.startsWith('clasic')) return 'Clasică';

  // Fallback: capitalise first letter and return as-is (unknown raw variant)
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const sortQualitiesAlpha = (values: string[]): string[] => {
  return [...values].sort((a, b) => a.localeCompare(b, 'ro', { sensitivity: 'base' }));
};

