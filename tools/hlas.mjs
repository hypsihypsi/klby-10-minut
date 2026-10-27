// Vygeneruje hlasové nahrávky cez ElevenLabs pre všetky vety, ktoré appka hovorí.
// Použitie:
//   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node tools/hlas.mjs
// Už existujúce nahrávky preskočí, takže po pridaní cviku sa dogenerujú len nové vety.
// Ak chceš všetko nanovo (napr. iný hlas), pridaj --znova.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'audio');
const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const znova = process.argv.includes('--znova');

if (!key || !voice) {
  console.error('Chýba ELEVENLABS_API_KEY alebo ELEVENLABS_VOICE_ID.');
  process.exit(1);
}

const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'js/cviky.js'), 'utf8'), ctx);
const { CVIKY } = ctx.window;

// musí sedieť s vetami v js/app.js (Hlas.say)
const vety = new Set([
  'Začíname.',
  'Ďalší cvik.',
  'Druhá strana.',
  'Hotovo. Dnešné cvičenie je za tebou.',
  'Hotovo.',
  'Dobrý deň. Takto budem hovoriť počas cvičenia.',
]);
for (const c of CVIKY) {
  vety.add(c.nazov + '.');
  c.hlas.forEach(h => vety.add(h));
}

mkdirSync(outDir, { recursive: true });
const indexPath = join(outDir, 'index.json');
const index = existsSync(indexPath) && !znova ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
const nove = [...vety].filter(t => znova || !index[t] || !existsSync(join(outDir, index[t])));
console.log(`${vety.size} viet, treba vygenerovať ${nove.length} (${nove.reduce((s, t) => s + t.length, 0)} znakov)`);

for (const [i, text] of nove.entries()) {
  const file = createHash('sha1').update(text).digest('hex').slice(0, 12) + '.mp3';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.95 },
    }),
  });
  if (!res.ok) {
    console.error(`Chyba pri „${text}“: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  writeFileSync(join(outDir, file), Buffer.from(await res.arrayBuffer()));
  index[text] = file;
  writeFileSync(indexPath, JSON.stringify(index, null, 1));
  console.log(`${i + 1}/${nove.length}  ${text}`);
}

// odstráň z indexu vety, ktoré sa už nepoužívajú
for (const t of Object.keys(index)) if (!vety.has(t)) delete index[t];
writeFileSync(indexPath, JSON.stringify(index, null, 1));
console.log('Hotovo. Skontroluj audio/ a urob commit.');
