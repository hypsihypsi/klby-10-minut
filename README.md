# 10 minút pre kĺby

Denných 10 minút pre zdravé kĺby: chodidlá a klenba, členky, ramená a rotátory, lakte, zápästia, krk a chrbát.
Statická stránka bez build kroku – beží na GitHub Pages a dá sa pridať na plochu mobilu.

## Ako to funguje
- Štyri zostavy (A, B, C, D) po ~10 minút sa striedajú. Ďalšia zostava sa posunie až po odcvičení.
- Krátka verzia (~4 min) na horšie dni.
- Prehrávač: príprava s východiskovou polohou → cvik s časovačom, hlasovými pokynmi (slovenský hlas prehliadača) a pípaním → výmena strany.
- Pri prvom stretnutí s cvikom je príprava dlhšia (25 s namiesto 12 s).
- Kalendár posledných 5 týždňov, žiadne odmeny ani série.
- Záznamy sú v `localStorage` prehliadača.

## Súbory
- `js/cviky.js` – **obsah**: cviky (texty, animácie), zostavy, tipy. Sem sa pridávajú nové cviky.
- `js/anim.js` – animované postavičky (SVG). Animácia = rig + kľúčové pózy.
- `js/app.js` – obrazovky, prehrávač, ukladanie.

## Pridanie cviku
1. Skopíruj podobný cvik v `CVIKY`, zmeň `id`, texty a pózy v `anim.keys`.
2. Pridaj `['id', sekundy]` do zostavy v `ZOSTAVY`.

## Lokálne spustenie
```
python3 -m http.server 8000
```
a otvor http://localhost:8000

## Hlas (ElevenLabs)
Appka prehráva nahrávky z `audio/` (zoznam v `audio/index.json`). Ak veta nahratá nie je, prečíta ju hlas telefónu.
Nahrávky sa generujú lokálne – kľúč sa do repa nedáva:
```
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node tools/hlas.mjs
```
Skript preskočí už existujúce vety, takže po pridaní cviku stačí spustiť znova. `--znova` pregeneruje všetko (napr. iný hlas).

## LG televízor (webOS)
Priečinok `webos/` je malá appka pre LG TV, ktorá len otvorí web – zmeny na GitHube sa tak prejavia aj v televízore.
1. Na TV z LG Content Store nainštaluj **Developer Mode**, prihlás sa LG developer účtom (webostv.developer.lge.com, zadarmo), zapni Dev Mode a Key Server; TV sa reštartuje.
2. Na počítači v rovnakej Wi-Fi:
```
npx -p @webos-tools/cli ares-setup-device -a tv -i "host=IP_TELEVIZORA" -i "port=9922" -i "username=prisoner"
npx -p @webos-tools/cli ares-novacom --device tv --getkey      # passphrase z appky Developer Mode
npx -p @webos-tools/cli ares-package webos -o dist
npx -p @webos-tools/cli ares-install --device tv dist/*.ipk
npx -p @webos-tools/cli ares-launch --device tv sk.hypsihypsi.klby10
```
Vývojársky režim platí 50 hodín; v appke Developer Mode sa dá predĺžiť („Extend“). Keď vyprší, LG appku z TV odstráni a treba ju nainštalovať znova.
