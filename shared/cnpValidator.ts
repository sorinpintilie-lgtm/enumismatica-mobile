export type Sex = 'm' | 'f';

export type ParsedCnp = {
  sex: Sex;
  foreign_resident: boolean;
  date_of_birth: string; // YYYY-MM-DD
  county_of_birth_code: string; // JJ
  county_of_birth: string;
  county_index: string; // NNN
  control: string; // C
};

export type ParseCnpResult =
  | { valid: true; parsed: ParsedCnp }
  | { valid: false; error: string };

const CONTROL_WEIGHTS = '279146358279';

// County codes as used in the CNP (JJ)
// Note: 99 is commonly used for people born abroad ("Străinătate").
const COUNTY_BY_CODE: Record<string, string> = {
  '01': 'Alba',
  '02': 'Arad',
  '03': 'Argeș',
  '04': 'Bacău',
  '05': 'Bihor',
  '06': 'Bistrița-Năsăud',
  '07': 'Botoșani',
  '08': 'Brașov',
  '09': 'Brăila',
  '10': 'Buzău',
  '11': 'Caraș-Severin',
  '12': 'Cluj',
  '13': 'Constanța',
  '14': 'Covasna',
  '15': 'Dâmbovița',
  '16': 'Dolj',
  '17': 'Galați',
  '18': 'Gorj',
  '19': 'Harghita',
  '20': 'Hunedoara',
  '21': 'Ialomița',
  '22': 'Iași',
  '23': 'Ilfov',
  '24': 'Maramureș',
  '25': 'Mehedinți',
  '26': 'Mureș',
  '27': 'Neamț',
  '28': 'Olt',
  '29': 'Prahova',
  '30': 'Satu Mare',
  '31': 'Sălaj',
  '32': 'Sibiu',
  '33': 'Suceava',
  '34': 'Teleorman',
  '35': 'Timiș',
  '36': 'Tulcea',
  '37': 'Vaslui',
  '38': 'Vâlcea',
  '39': 'Vrancea',
  '40': 'București',
  '41': 'București Sector 1',
  '42': 'București Sector 2',
  '43': 'București Sector 3',
  '44': 'București Sector 4',
  '45': 'București Sector 5',
  '46': 'București Sector 6',
  '51': 'Călărași',
  '52': 'Giurgiu',
  '99': 'Străinătate',
};

function normalizeCnp(input: string): string {
  // allow spaces and dashes in user input
  return String(input ?? '')
    .trim()
    .replace(/[\s-]+/g, '');
}

function isAllDigits(s: string) {
  return /^[0-9]+$/.test(s);
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toIsoDateUTC(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function centuryFromS(s: number): number | null {
  // Widely used convention:
  // 1/2 => 1900–1999, 3/4 => 1800–1899, 5/6 => 2000–2099
  // 7/8 => foreign residents (decoded like 1900–1999)
  // 9   => special cases (decoded like 1900–1999)
  if (s === 1 || s === 2) return 1900;
  if (s === 3 || s === 4) return 1800;
  if (s === 5 || s === 6) return 2000;
  if (s === 7 || s === 8) return 1900;
  if (s === 9) return 1900;
  return null;
}

function computeControlDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * Number(CONTROL_WEIGHTS[i]);
  }
  const mod = sum % 11;
  return mod === 10 ? 1 : mod;
}

export function validCnp(cnpInput: string): boolean {
  return parseCnp(cnpInput).valid;
}

export function parseCnp(cnpInput: string): ParseCnpResult {
  const cnp = normalizeCnp(cnpInput);

  if (cnp.length !== 13) return { valid: false, error: 'CNP must be 13 digits' };
  if (!isAllDigits(cnp)) return { valid: false, error: 'CNP must contain only digits' };

  const s = Number(cnp[0]);
  const century = centuryFromS(s);
  if (century == null) return { valid: false, error: 'Invalid S digit' };

  const yy = Number(cnp.slice(1, 3));
  const mm = Number(cnp.slice(3, 5));
  const dd = Number(cnp.slice(5, 7));
  const jj = cnp.slice(7, 9);
  const nnn = cnp.slice(9, 12);
  const control = cnp.slice(12, 13);

  const year = century + yy;
  const isoDob = toIsoDateUTC(year, mm, dd);
  if (!isoDob) return { valid: false, error: 'Invalid birth date in CNP' };

  // Guard against future birth dates.
  // Use UTC to stay consistent with toIsoDateUTC().
  const todayIso = new Date().toISOString().slice(0, 10);
  if (isoDob > todayIso) return { valid: false, error: 'Birth date in CNP is in the future' };

  const county = COUNTY_BY_CODE[jj];
  if (!county) return { valid: false, error: 'Invalid county code (JJ) in CNP' };

  // NNN is a serial number; 000 is not a valid value.
  if (nnn === '000') return { valid: false, error: 'Invalid serial number (NNN) in CNP' };

  const expected = computeControlDigit(cnp.slice(0, 12));
  if (Number(control) !== expected) {
    return { valid: false, error: 'Invalid checksum (control digit) in CNP' };
  }

  const sex: Sex = s % 2 === 1 ? 'm' : 'f';
  // 7/8/9 are used for foreign residents / special cases.
  const foreign_resident = s === 7 || s === 8 || s === 9;

  return {
    valid: true,
    parsed: {
      sex,
      foreign_resident,
      date_of_birth: isoDob,
      county_of_birth_code: jj,
      county_of_birth: county,
      county_index: nnn,
      control,
    },
  };
}
