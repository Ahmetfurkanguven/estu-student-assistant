/**
 * locales.ts içinde artık hiçbir yerden çağrılmayan çeviri anahtarlarını bulur.
 *
 *   node scripts/find-unused-locales.mjs          → listeler
 *   node scripts/find-unused-locales.mjs --write  → tr ve en bloklarından siler
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localesPath = join(root, 'src/data/locales.ts');
const source = readFileSync(localesPath, 'utf8');

/** tr bloğundaki tüm anahtarlar (girinti ne olursa olsun). */
function extractKeys(text) {
    return [...text.matchAll(/^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*['"`]/gm)].map(m => m[1]);
}

// DİKKAT: dosyada `en: 'Alındı'` adında bir ÇEVİRİ ANAHTARI var. Dil bloğunun
// sınırını ararken `en:` yerine `en: {` aranmalı; aksi hâlde tr bloğu erken
// biter ve sonraki anahtarlar hiç taranmaz.
const trStart = /^\s*tr:\s*\{/m.exec(source)?.index ?? 0;
const enMatch = /^\s*en:\s*\{/m.exec(source.slice(trStart));
const enStart = enMatch ? trStart + enMatch.index : source.length;
const keys = [...new Set(extractKeys(source.slice(trStart, enStart)))];

/** locales dışındaki tüm kaynak dosyalar. */
function collect(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) collect(p, out);
        else if (/\.(ts|tsx)$/.test(entry.name) && !p.includes('locales')) out.push(p);
    }
    return out;
}
const code = collect(join(root, 'src')).map(f => readFileSync(f, 'utf8')).join('\n');

// Anahtar kodda tırnak içinde geçiyor mu: t('key'), t("key"), t(`key`)
const unused = keys.filter(k => !new RegExp(String.raw`['"\`]${k}['"\`]`).test(code));

console.log(`Toplam anahtar: ${keys.length}`);
console.log(`Kullanılmayan : ${unused.length}`);
unused.forEach(k => console.log('  ' + k));

if (!process.argv.includes('--write') || unused.length === 0) process.exit(0);

// Hem tr hem en bloğundan sil. Anahtar satırı tek satır olabilir ya da
// değeri bir sonraki satıra taşmış olabilir; sonraki anahtara kadar siler.
let out = source;
for (const key of unused) {
    const pattern = new RegExp(
        String.raw`^[ \t]*${key}\s*:\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\`(?:[^\`\\]|\\.)*\`)\s*,?[ \t]*\r?\n`,
        'gm'
    );
    out = out.replace(pattern, '');
}
writeFileSync(localesPath, out, 'utf8');

const remaining = extractKeys(out.slice(out.indexOf('tr:'), out.indexOf('en:', out.indexOf('tr:'))));
console.log(`\nSilindi. Kalan tr anahtarı: ${remaining.length}`);
