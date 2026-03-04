// Lightweight SHA-256 implementation (no extra runtime dependency)
// Returns lowercase hex digest.
export function sha256Hex(input: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';

  let i: number;
  let j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = input[lengthProperty] * 8;

  let hash = (sha256Hex as any)._h as number[] | undefined;
  let k = (sha256Hex as any)._k as number[] | undefined;

  if (!hash || !k) {
    hash = [];
    k = [];

    let primeCounter = 0;
    const isComposite: Record<number, boolean> = {};
    for (let candidate = 2; primeCounter < 64; candidate += 1) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = true;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter += 1;
      }
    }

    (sha256Hex as any)._h = hash;
    (sha256Hex as any)._k = k;
  }

  input += '\x80';
  while ((input[lengthProperty] % 64) - 56) input += '\x00';

  for (i = 0; i < input[lengthProperty]; i += 1) {
    j = input.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  const w = new Array<number>(64);
  const hashCopy = hash.slice(0);

  for (j = 0; j < words[lengthProperty]; ) {
    const oldHash = hashCopy.slice(0);

    for (i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      w[i] =
        i < 16
          ? words[j + i] | 0
          : (((rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
              w[i - 7] +
              (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)) +
              w[i - 16]) |
              0);

      const a = hashCopy[0] | 0;
      const e = hashCopy[4] | 0;
      const temp1 =
        (hashCopy[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hashCopy[5]) ^ (~e & hashCopy[6])) +
          (k[i] | 0) +
          (w[i] | 0)) |
        0;

      const temp2 =
        ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hashCopy[1]) ^ (a & hashCopy[2]) ^ (hashCopy[1] & hashCopy[2]))) |
        0;

      hashCopy[7] = hashCopy[6];
      hashCopy[6] = hashCopy[5];
      hashCopy[5] = hashCopy[4];
      hashCopy[4] = (hashCopy[3] + temp1) | 0;
      hashCopy[3] = hashCopy[2];
      hashCopy[2] = hashCopy[1];
      hashCopy[1] = hashCopy[0];
      hashCopy[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i += 1) {
      hashCopy[i] = (hashCopy[i] + oldHash[i]) | 0;
    }

    j += 16;
  }

  for (i = 0; i < 8; i += 1) {
    for (j = 3; j + 1; j -= 1) {
      const b = (hashCopy[i] >> (j * 8)) & 255;
      result += ((b < 16 ? 0 : '') + b.toString(16));
    }
  }

  return result;
}

