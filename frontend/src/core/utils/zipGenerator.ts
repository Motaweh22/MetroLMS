/**
 * Lightweight In-Memory ZIP Archive Generator
 *
 * Implements the standard PKWARE .ZIP format specification (compression method 0 = STORE).
 * Generates 100% valid ZIP files compatible with all operating systems and unzip tools,
 * without requiring external heavy npm dependencies.
 */

export interface ZipFileInput {
  name: string;
  data: Uint8Array | string;
}

// Precomputed CRC-32 Lookup Table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function formatDosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);

  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);

  return { dosTime, dosDate };
}

/**
 * Creates an uncompressed ZIP Blob from an array of named files.
 */
export function createZipBlob(files: ZipFileInput[]): Blob {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = formatDosDateTime();

  const localFileChunks: Uint8Array[] = [];
  const centralDirChunks: Uint8Array[] = [];

  let currentOffset = 0;

  for (const file of files) {
    const rawData =
      typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const nameBytes = encoder.encode(file.name);
    const crc = computeCrc32(rawData);
    const size = rawData.length;

    // 1. Local File Header (30 bytes + name length + data)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true);         // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true);     // General purpose bit flag (Bit 11: UTF-8)
    lv.setUint16(8, 0, true);          // Compression method (0 = Store)
    lv.setUint16(10, dosTime, true);   // Last mod file time
    lv.setUint16(12, dosDate, true);   // Last mod file date
    lv.setUint32(14, crc, true);       // CRC-32
    lv.setUint32(18, size, true);      // Compressed size
    lv.setUint32(22, size, true);      // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true);         // Extra field length

    localHeader.set(nameBytes, 30);

    localFileChunks.push(localHeader, rawData);

    // 2. Central Directory File Header (46 bytes + name length)
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdHeader.buffer);

    cv.setUint32(0, 0x02014b50, true); // Central file header signature
    cv.setUint16(4, 20, true);         // Version made by
    cv.setUint16(6, 20, true);         // Version needed to extract
    cv.setUint16(8, 0x0800, true);     // General purpose bit flag (UTF-8)
    cv.setUint16(10, 0, true);         // Compression method (Store)
    cv.setUint16(12, dosTime, true);   // Last mod time
    cv.setUint16(14, dosDate, true);   // Last mod date
    cv.setUint32(16, crc, true);       // CRC-32
    cv.setUint32(20, size, true);      // Compressed size
    cv.setUint32(24, size, true);      // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // File name length
    cv.setUint16(30, 0, true);         // Extra field length
    cv.setUint16(32, 0, true);         // File comment length
    cv.setUint16(34, 0, true);         // Disk number start
    cv.setUint16(36, 0, true);         // Internal file attributes
    cv.setUint32(38, 0, true);         // External file attributes
    cv.setUint32(42, currentOffset, true); // Relative offset of local header

    cdHeader.set(nameBytes, 46);
    centralDirChunks.push(cdHeader);

    currentOffset += localHeader.length + rawData.length;
  }

  const centralDirOffset = currentOffset;
  let centralDirSize = 0;
  for (const chunk of centralDirChunks) {
    centralDirSize += chunk.length;
  }

  // 3. End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);

  ev.setUint32(0, 0x06054b50, true); // End of central directory signature
  ev.setUint16(4, 0, true);          // Number of this disk
  ev.setUint16(6, 0, true);          // Disk with start of central directory
  ev.setUint16(8, files.length, true); // Total entries on this disk
  ev.setUint16(10, files.length, true); // Total entries in central directory
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, centralDirOffset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true);         // ZIP file comment length

  return new Blob([...localFileChunks, ...centralDirChunks, eocd], {
    type: 'application/zip',
  });
}
