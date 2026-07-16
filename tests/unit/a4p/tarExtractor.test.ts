import * as zlib from 'zlib';

import { extractTarGz } from '../../../src/a4p/skillstore/TarExtractor';

function tarHeader(name: string, size: number, typeflag: string): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'utf8');
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8');
  header.write('00000000000\0', 136, 12, 'utf8');
  header.write(typeflag, 156, 1, 'utf8');
  header.write('ustar', 257, 5, 'utf8');
  return header;
}

function tarFile(name: string, content: string): Buffer {
  const data = Buffer.from(content, 'utf8');
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(padded);
  return Buffer.concat([tarHeader(name, data.length, '0'), padded]);
}

function tarDir(name: string): Buffer {
  return tarHeader(name, 0, '5');
}

function gzipTar(...parts: Buffer[]): Buffer {
  return zlib.gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)]));
}

describe('TarExtractor', () => {
  it('extracts files and directories from a tar.gz', () => {
    const archive = gzipTar(
      tarDir('repo-main/'),
      tarDir('repo-main/skills/'),
      tarFile('repo-main/skills/hello/SKILL.md', '---\nname: hello\ndescription: test\n---\n본문'),
    );
    const entries = extractTarGz(archive);
    const file = entries.find((entry) => entry.type === 'file');
    expect(file?.path).toBe('repo-main/skills/hello/SKILL.md');
    expect(file?.data.toString('utf8')).toContain('name: hello');
    expect(entries.filter((entry) => entry.type === 'dir').length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes Korean paths to NFC', () => {
    const nfdName = '설교'.normalize('NFD');
    const archive = gzipTar(tarFile(`repo-main/skills/${nfdName}/SKILL.md`, 'x'));
    const entries = extractTarGz(archive);
    expect(entries[0].path).toBe(`repo-main/skills/${'설교'.normalize('NFC')}/SKILL.md`);
  });

  it('rejects path traversal entries', () => {
    const archive = gzipTar(tarFile('repo-main/../../evil.txt', 'boom'));
    expect(() => extractTarGz(archive)).toThrow(/unsafe path/);
  });

  it('rejects absolute paths', () => {
    const archive = gzipTar(tarFile('/etc/passwd', 'boom'));
    expect(() => extractTarGz(archive)).toThrow(/unsafe path/);
  });

  it('skips symlink entries', () => {
    const archive = gzipTar(
      tarHeader('repo-main/link', 0, '2'),
      tarFile('repo-main/real.txt', 'ok'),
    );
    const entries = extractTarGz(archive);
    expect(entries.map((entry) => entry.path)).toEqual(['repo-main/real.txt']);
  });

  it('honors GNU long names', () => {
    const longName = `repo-main/skills/${'아주-긴-스킬-이름-'.repeat(8)}/SKILL.md`;
    const nameData = Buffer.from(longName, 'utf8');
    const namePadded = Buffer.alloc(Math.ceil(nameData.length / 512) * 512);
    nameData.copy(namePadded);
    const archive = gzipTar(
      tarHeader('././@LongLink', nameData.length, 'L'),
      namePadded,
      tarFile('repo-main/truncated', '내용'),
    );
    const entries = extractTarGz(archive);
    expect(entries[0].path).toBe(longName.normalize('NFC'));
    expect(entries[0].data.toString('utf8')).toBe('내용');
  });
});
