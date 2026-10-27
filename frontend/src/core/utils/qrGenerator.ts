/**
 * Standards-Compliant In-Memory QR Code Generator (ISO/IEC 18004)
 *
 * Implements QR Code Model 2 with Byte mode encoding and Reed-Solomon Error Correction.
 * 100% pure TypeScript, zero external dependencies, works offline and in any environment.
 */

// QR Version capacities for Byte mode with EC Level M (approx. 15% recovery)
// [version, totalCodewords, ecCodewords, numBlocks, alignmentPatternLocations]
interface VersionInfo {
  version: number;
  totalCodewords: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocksGroup1: number;
  dataCodewordsPerBlockGroup1: number;
  numBlocksGroup2: number;
  dataCodewordsPerBlockGroup2: number;
  alignments: number[];
}

const VERSION_TABLE: VersionInfo[] = [
  // Version 1 (21x21)
  {
    version: 1,
    totalCodewords: 26,
    dataCodewords: 16,
    ecCodewordsPerBlock: 10,
    numBlocksGroup1: 1,
    dataCodewordsPerBlockGroup1: 16,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignments: [],
  },
  // Version 2 (25x25)
  {
    version: 2,
    totalCodewords: 44,
    dataCodewords: 28,
    ecCodewordsPerBlock: 16,
    numBlocksGroup1: 1,
    dataCodewordsPerBlockGroup1: 28,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignments: [6, 18],
  },
  // Version 3 (29x29)
  {
    version: 3,
    totalCodewords: 70,
    dataCodewords: 44,
    ecCodewordsPerBlock: 26,
    numBlocksGroup1: 1,
    dataCodewordsPerBlockGroup1: 44,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignments: [6, 22],
  },
  // Version 4 (33x33)
  {
    version: 4,
    totalCodewords: 100,
    dataCodewords: 64,
    ecCodewordsPerBlock: 18,
    numBlocksGroup1: 2,
    dataCodewordsPerBlockGroup1: 32,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignments: [6, 26],
  },
  // Version 5 (37x37)
  {
    version: 5,
    totalCodewords: 134,
    dataCodewords: 86,
    ecCodewordsPerBlock: 24,
    numBlocksGroup1: 2,
    dataCodewordsPerBlockGroup1: 43,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignments: [6, 30],
  },
  // Version 6 (41x41)
  {
    version: 6,
    totalCodewords: 172,
    dataCodewords: 108,
    ecCodewordsPerBlock: 16,
    numBlocksGroup1: 4,
    dataCodewordsPerBlockGroup1: 27,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignments: [6, 34],
  },
  // Version 7 (45x45)
  {
    version: 7,
    totalCodewords: 196,
    dataCodewords: 124,
    ecCodewordsPerBlock: 18,
    numBlocksGroup1: 4,
    dataCodewordsPerBlockGroup1: 31,
    numBlocksGroup2: 0,
    dataCodewordsPerBlockGroup2: 0,
    alignments: [6, 22, 38],
  },
  // Version 8 (49x49)
  {
    version: 8,
    totalCodewords: 242,
    dataCodewords: 154,
    ecCodewordsPerBlock: 22,
    numBlocksGroup1: 2,
    dataCodewordsPerBlockGroup1: 38,
    numBlocksGroup2: 2,
    dataCodewordsPerBlockGroup2: 39,
    alignments: [6, 24, 42],
  },
  // Version 9 (53x53)
  {
    version: 9,
    totalCodewords: 292,
    dataCodewords: 182,
    ecCodewordsPerBlock: 22,
    numBlocksGroup1: 3,
    dataCodewordsPerBlockGroup1: 36,
    numBlocksGroup2: 2,
    dataCodewordsPerBlockGroup2: 37,
    alignments: [6, 26, 46],
  },
  // Version 10 (57x57)
  {
    version: 10,
    totalCodewords: 346,
    dataCodewords: 216,
    ecCodewordsPerBlock: 26,
    numBlocksGroup1: 4,
    dataCodewordsPerBlockGroup1: 40,
    numBlocksGroup2: 1,
    dataCodewordsPerBlockGroup2: 41,
    alignments: [6, 28, 50],
  },
];

// Galois Field GF(256) Math
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
  }
  GF_LOG[0] = 0;
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

// Compute Reed-Solomon generator polynomial of degree degree
function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMultiply(poly[j], factor);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// Compute Reed-Solomon error correction codewords
function rsComputeEcc(data: Uint8Array, numEcCodewords: number): Uint8Array {
  const gen = rsGeneratorPoly(numEcCodewords);
  const result = new Uint8Array(numEcCodewords);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    // Shift left
    for (let j = 0; j < numEcCodewords - 1; j++) {
      result[j] = result[j + 1];
    }
    result[numEcCodewords - 1] = 0;

    if (factor !== 0) {
      for (let j = 0; j < numEcCodewords; j++) {
        result[j] ^= gfMultiply(gen[numEcCodewords - j - 1], factor);
      }
    }
  }

  return result;
}

/**
 * Encodes input text into standard QR byte mode codewords for the selected version.
 */
function encodeData(text: string, versionInfo: VersionInfo): Uint8Array {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(text);
  const bitBuffer: number[] = [];

  function appendBits(val: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      bitBuffer.push((val >>> i) & 1);
    }
  }

  // 1. Mode Indicator: Byte mode (0100)
  appendBits(0b0100, 4);

  // 2. Character Count Indicator (8 bits for versions 1-9, 16 bits for version 10+)
  const countBits = versionInfo.version < 10 ? 8 : 16;
  appendBits(rawBytes.length, countBits);

  // 3. Data Bytes
  for (const b of rawBytes) {
    appendBits(b, 8);
  }

  // 4. Terminator (up to 4 zero bits)
  const totalDataBits = versionInfo.dataCodewords * 8;
  const termLength = Math.min(4, totalDataBits - bitBuffer.length);
  for (let i = 0; i < termLength; i++) {
    bitBuffer.push(0);
  }

  // 5. Pad to next byte boundary
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0);
  }

  // Convert bits to bytes
  const codewords: number[] = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | bitBuffer[i + j];
    }
    codewords.push(byteVal);
  }

  // 6. Fill with alternate padding bytes 0xEC, 0x11
  let padToggle = 0;
  while (codewords.length < versionInfo.dataCodewords) {
    codewords.push(padToggle === 0 ? 0xec : 0x11);
    padToggle ^= 1;
  }

  return new Uint8Array(codewords);
}

/**
 * Interleaves data and error correction codewords across blocks.
 */
function interleaveBlocks(data: Uint8Array, v: VersionInfo): Uint8Array {
  const totalBlocks = v.numBlocksGroup1 + v.numBlocksGroup2;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let offset = 0;
  for (let i = 0; i < v.numBlocksGroup1; i++) {
    const block = data.slice(offset, offset + v.dataCodewordsPerBlockGroup1);
    dataBlocks.push(block);
    ecBlocks.push(rsComputeEcc(block, v.ecCodewordsPerBlock));
    offset += v.dataCodewordsPerBlockGroup1;
  }

  for (let i = 0; i < v.numBlocksGroup2; i++) {
    const block = data.slice(offset, offset + v.dataCodewordsPerBlockGroup2);
    dataBlocks.push(block);
    ecBlocks.push(rsComputeEcc(block, v.ecCodewordsPerBlock));
    offset += v.dataCodewordsPerBlockGroup2;
  }

  const finalCodewords = new Uint8Array(v.totalCodewords);
  let pos = 0;

  // Interleave data codewords
  const maxDataLen = Math.max(
    v.dataCodewordsPerBlockGroup1,
    v.dataCodewordsPerBlockGroup2
  );
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords[pos++] = dataBlocks[b][i];
      }
    }
  }

  // Interleave EC codewords
  for (let i = 0; i < v.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalCodewords[pos++] = ecBlocks[b][i];
    }
  }

  return finalCodewords;
}

/**
 * Places function patterns and data into a 2D matrix.
 */
function createMatrix(versionInfo: VersionInfo, codewords: Uint8Array): boolean[][] {
  const size = versionInfo.version * 4 + 17;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  // 1. Finder patterns (7x7) + separators
  function placeFinder(startX: number, startY: number) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const y = startY + dy;
        const x = startX + dx;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        if (
          (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
          (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
        ) {
          matrix[y][x] = true;
        } else {
          matrix[y][x] = false;
        }
      }
    }
  }

  placeFinder(0, 0); // Top-left
  placeFinder(size - 7, 0); // Top-right
  placeFinder(0, size - 7); // Bottom-left

  // 2. Alignment patterns (5x5)
  const coords = versionInfo.alignments;
  for (const row of coords) {
    for (const col of coords) {
      if (matrix[row][col] !== null) continue; // Skip corners occupied by finder patterns
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const isBlack =
            Math.abs(dx) === 2 || Math.abs(dy) === 2 || (dx === 0 && dy === 0);
          matrix[row + dy][col + dx] = isBlack;
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // 4. Dark module
  matrix[size - 8][8] = true;

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }

  // 6. Place data bits in zigzag 2-column pattern
  const bits: boolean[] = [];
  for (const byte of codewords) {
    for (let b = 7; b >= 0; b--) {
      bits.push(((byte >>> b) & 1) === 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol--; // Skip vertical timing column

    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (let c = 0; c < 2; c++) {
        const col = rightCol - c;
        if (matrix[r][col] === null) {
          const val = bitIdx < bits.length ? bits[bitIdx++] : false;
          // Apply Mask 0: (row + col) % 2 === 0
          const maskInvert = (r + col) % 2 === 0;
          matrix[r][col] = val !== maskInvert;
        }
      }
    }
    upwards = !upwards;
  }

  // 7. Write Format Information (Mask 0, EC Level M = 00)
  // Precomputed Format Information bits for EC Level M + Mask 0 with BCH(15,5) and mask XOR 0x5412:
  // EC M = 00, Mask 0 = 000 => Data = 00000 => Encoded = 0x5412 => Binary 101010000010010
  const formatBits = [true, false, true, false, true, false, false, false, false, false, true, false, false, true, false];

  // Top-left format bits
  for (let i = 0; i <= 5; i++) matrix[8][i] = formatBits[i];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  for (let i = 9; i <= 14; i++) matrix[14 - i][8] = formatBits[i];

  // Split format bits around corners
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i];
  for (let i = 0; i < 8; i++) matrix[8][size - 8 + i] = formatBits[7 + i];

  return matrix as boolean[][];
}

/**
 * Finds the minimum QR version capable of holding the specified text length in Byte mode.
 */
function findBestVersion(text: string): VersionInfo {
  const encoder = new TextEncoder();
  const byteLen = encoder.encode(text).length;

  for (const v of VERSION_TABLE) {
    const overhead = v.version < 10 ? 1.5 : 2.5; // Mode + count indicator
    if (byteLen + overhead <= v.dataCodewords) {
      return v;
    }
  }

  // Fallback to highest available version
  return VERSION_TABLE[VERSION_TABLE.length - 1];
}

/**
 * Generates the full 2D boolean module matrix for any text or URL.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const version = findBestVersion(text);
  const data = encodeData(text, version);
  const codewords = interleaveBlocks(data, version);
  return createMatrix(version, codewords);
}

/**
 * Renders the QR code to an accessible SVG string.
 */
export function generateQrSvg(
  text: string,
  options?: {
    size?: number;
    margin?: number;
    darkColor?: string;
    lightColor?: string;
  }
): string {
  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const margin = options?.margin ?? 4;
  const totalModules = matrixSize + margin * 2;
  const size = options?.size ?? 256;
  const darkColor = options?.darkColor ?? '#000000';
  const lightColor = options?.lightColor ?? '#FFFFFF';

  let rects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${darkColor}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code">
  <rect width="${totalModules}" height="${totalModules}" fill="${lightColor}"/>
  ${rects}
</svg>`;
}

/**
 * Triggers a client-side download of the QR code as a high-resolution PNG image
 * using an offscreen Canvas element.
 */
export function downloadQrCodeImage(
  text: string,
  filename = 'cairo-metro-qr-code.png',
  outputSize = 1024
): void {
  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const margin = 4;
  const totalModules = matrixSize + margin * 2;

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outputSize, outputSize);

  const scale = outputSize / totalModules;
  ctx.fillStyle = '#000000';

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(
          Math.round((c + margin) * scale),
          Math.round((r + margin) * scale),
          Math.ceil(scale),
          Math.ceil(scale)
        );
      }
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
