/**
 * Autofix C36 lyric artefacts: leading bullets, embedded "(2)", trailing "(N)" → line.x
 * Usage: npx tsx scripts/fix-lyrics-c36.ts
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Line = { n: string; r?: string; e?: string; x?: number };

function fixLines(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (const line of lines) {
    let n = String(line.n || '')
      .replace(/^[-–—•]\s+/, '')
      .replace(/\s+,/g, ',')
      .trim();
    const mid = n.match(/^(.*?)\s*\((\d+)\)\s+(.+)$/u);
    if (mid) {
      const times = Number(mid[2]);
      out.push({
        n: mid[1]!.trim(),
        r: line.r ?? '',
        e: line.e ?? '',
        ...(times > 1 ? { x: times } : {}),
      });
      let rest = mid[3]!.trim().replace(/^[-–—•]\s+/, '');
      const trail = rest.match(/^(.*?)\s*\((\d+)\)\s*$/u);
      if (trail) {
        out.push({ n: trail[1]!.trim(), r: '', e: '', x: Number(trail[2]) });
      } else {
        out.push({ n: rest, r: '', e: '' });
      }
      continue;
    }
    const trail = n.match(/^(.*?)\s*\((\d+)\)\s*$/u);
    if (trail) {
      out.push({
        n: trail[1]!.trim(),
        r: line.r ?? '',
        e: line.e ?? '',
        x: Number(trail[2]),
      });
      continue;
    }
    out.push({ ...line, n });
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk('src/content/songs')) {
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw) as {
    sections: Array<{ lines: Line[] }>;
    updated?: string;
  };
  let dirty = false;
  data.sections = data.sections.map((sec) => {
    const next = fixLines(sec.lines);
    if (JSON.stringify(next) !== JSON.stringify(sec.lines)) dirty = true;
    return { ...sec, lines: next };
  });
  if (!dirty) continue;
  data.updated = '2026-11-19';
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  changed++;
}
console.log(`Fixed ${changed} song files`);
