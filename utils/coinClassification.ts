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

export const sortWeightsAsc = (values: string[]): string[] => {
  return [...values].sort((a, b) => {
    const na = parseLeadingNumber(a) ?? Number.MAX_SAFE_INTEGER;
    const nb = parseLeadingNumber(b) ?? Number.MAX_SAFE_INTEGER;
    return na - nb;
  });
};

export const normalizeQuality = (input?: string | null): string => {
  if (!input) return '';
  const cleaned = String(input)
    .replace(/[\u200B\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const sortQualitiesAlpha = (values: string[]): string[] => {
  return [...values].sort((a, b) => a.localeCompare(b, 'ro', { sensitivity: 'base' }));
};

