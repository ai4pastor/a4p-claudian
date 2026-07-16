import * as zlib from 'zlib';

/**
 * Minimal .tar.gz reader for GitHub codeload tarballs — Node built-ins only.
 *
 * Supports: regular files ('0'/'\0'), directories ('5'), GNU long names ('L').
 * Skips: pax headers ('x'/'g'), symlinks/hardlinks ('2'/'1') and anything else.
 * Rejects: absolute paths and '..' segments (path traversal), oversized archives.
 */

export interface TarEntry {
  /** NFC-normalized path relative to the archive root. */
  path: string;
  type: 'file' | 'dir';
  data: Buffer;
}

const BLOCK_SIZE = 512;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export function extractTarGz(archive: ArrayBuffer | Buffer): TarEntry[] {
  const gunzipped = zlib.gunzipSync(
    Buffer.isBuffer(archive) ? archive : Buffer.from(archive),
  );
  if (gunzipped.length > MAX_TOTAL_BYTES) {
    throw new Error(`archive too large: ${gunzipped.length} bytes`);
  }
  return parseTar(gunzipped);
}

function parseTar(tar: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let pendingLongName: string | null = null;

  while (offset + BLOCK_SIZE <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK_SIZE);
    if (isZeroBlock(header)) break;

    const size = parseOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156]);
    const dataStart = offset + BLOCK_SIZE;
    const dataEnd = dataStart + size;
    offset = dataStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;

    if (typeflag === 'L') {
      // GNU long name: data block holds the real name of the NEXT entry.
      pendingLongName = readString(tar.subarray(dataStart, dataEnd), 0, size);
      continue;
    }

    let name = pendingLongName ?? buildName(header);
    pendingLongName = null;
    if (!name) continue;
    name = name.normalize('NFC');

    if (isUnsafePath(name)) {
      throw new Error(`unsafe path in archive: ${name}`);
    }

    if (typeflag === '5' || name.endsWith('/')) {
      entries.push({ path: stripTrailingSlash(name), type: 'dir', data: Buffer.alloc(0) });
      continue;
    }
    if (typeflag === '0' || typeflag === '\0') {
      entries.push({ path: name, type: 'file', data: Buffer.from(tar.subarray(dataStart, dataEnd)) });
    }
    // 'x', 'g', '1', '2' and anything else: skipped intentionally.
  }

  return entries;
}

function buildName(header: Buffer): string {
  const name = readString(header, 0, 100);
  const prefix = readString(header, 345, 155);
  return prefix ? `${prefix}/${name}` : name;
}

function readString(buffer: Buffer, start: number, length: number): string {
  const slice = buffer.subarray(start, start + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? slice.length : nul).toString('utf8');
}

function parseOctal(buffer: Buffer, start: number, length: number): number {
  const text = readString(buffer, start, length).trim();
  if (!text) return 0;
  const value = parseInt(text, 8);
  return Number.isFinite(value) ? value : 0;
}

function isZeroBlock(block: Buffer): boolean {
  return block.every((byte) => byte === 0);
}

function isUnsafePath(name: string): boolean {
  if (name.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(name)) return true;
  return name.split('/').some((segment) => segment === '..');
}

function stripTrailingSlash(name: string): string {
  return name.endsWith('/') ? name.slice(0, -1) : name;
}
