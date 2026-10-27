(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const KEY = 'klby10.v1';
  const S = Object.assign({ done: {}, next: 0, voice: true, seen: {}, intro: false, cas: '08:00' }, load());

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch {}
  }

  const byId = Object.fromEntries(CVIKY.map(c => [c.id, c]));
  const ORDER = ['A', 'B', 'C', 'D'];
  const PREP = 12, PREP_NEW = 25, SWITCH = 6;

  const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => dkey(new Date());
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s) % 60)).padStart(2, '0')}`;
  const zSec = z => z.cviky.reduce((s, [id, d]) => s + d + PREP + (byId[id].strany ? SWITCH : 0), 0);
  const zMin = z => Math.round(zSec(z) / 60);
  const dni = k => (k === 1 ? 'deň' : k >= 2 && k <= 4 ? 'dni' : 'dní');
  const pomockyZ = z => {
    const all = [...new Set(z.cviky.flatMap(([id]) => byId[id].pomocky))];
    return all.filter(x => !all.includes(x.replace(' (voliteľne)', '')) || !x.endsWith(' (voliteľne)'));
  };
  const chips = arr => arr.map(x => `<span class="chip">${x}</span>`).join('');
  const dlzka = s => (s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`);
  const ytUrl = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    video: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9v6l5-3z" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ---------- hlas a zvuk ---------- */
  // Nahrávky z ElevenLabs (audio/index.json, generuje tools/hlas.mjs).
  // Keď veta nahratá nie je, prečíta ju hlas telefónu.
  const Hlas = {
    voice: null,
    nahravky: {},
    el: null,
    rad: [],
    init() {
      fetch('audio/index.json')
        .then(r => (r.ok ? r.json() : {}))
        .then(j => (this.nahravky = j))
        .catch(() => {});
      if (!('speechSynthesis' in window)) return;
      const pick = () => {
        const v = speechSynthesis.getVoices();
        this.voice = v.find(x => /^sk/i.test(x.lang)) || v.find(x => /^cs/i.test(x.lang)) || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    },
    // t: veta alebo zoznam viet, ktoré zaznejú po sebe
    say(t) {
      const casti = [].concat(t).filter(Boolean);
      if (!S.voice || !casti.length) return;
      this.stop();
      if (casti.every(x => this.nahravky[x])) {
        this.el = this.el || new Audio();
        this.rad = casti.map(x => 'audio/' + this.nahravky[x]);
        this.dalsia();
        return;
      }
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(casti.join(' '));
      u.lang = this.voice ? this.voice.lang : 'sk-SK';
      if (this.voice) u.voice = this.voice;
      u.rate = 0.92;
      speechSynthesis.speak(u);
    },
    dalsia() {
      const src = this.rad.shift();
      if (!src) return;
      this.el.src = src;
      this.el.onended = () => this.dalsia();
      this.el.play().catch(() => {});
    },
    stop() {
      this.rad = [];
      if (this.el) this.el.pause();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    },
  };
  Hlas.init();

  let ac = null;
  function audioInit() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch {}
  }
  function beep(f = 880, d = 0.15) {
    if (!ac || !S.voice) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + d + 0.05);
  }

  /* ---------- navigácia ---------- */
  function nav(active) {
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === active));
  }

  function route() {
    const [, a, b] = (location.hash.slice(1) || '/').split('/');
    if (a === 'cvicenie') {
      if (!P) location.replace('#/');
      return;
    }
    if (P) closePlayer(false);
    window.scrollTo(0, 0);
    if (a === 'cviky') return viewList();
    if (a === 'cvik' && byId[b]) return viewDetail(byId[b]);
    if (a === 'zostava' && ZOSTAVY[b]) return viewZostava(b);
    if (a === 'info') return viewInfo();
    viewHome();
  }
  window.addEventListener('hashchange', route);

  document.addEventListener('click', e => {
    const st = e.target.closest('[data-start]');
    if (st) {
      e.preventDefault();
      startSession(st.dataset.start, st.dataset.single);
    }
  });

  /* ---------- Domov ---------- */
  function exItem([id, d]) {
    const c = byId[id];
    return `<li><a href="#/cvik/${id}"><span class="thumb">${Anim.still(c.anim)}</span><span class="t"><b>${c.nazov}</b><small>${dlzka(d)}${c.strany ? ' · obe strany' : ''}</small></span></a></li>`;
  }

  function kalendar() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const dow = (t.getDay() + 6) % 7;
    const start = new Date(t);
    start.setDate(t.getDate() - dow - 28);
    let cells = '', week = 0;
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = dkey(d), done = S.done[k], isT = +d === +t, fut = d > t;
      if (done && i >= 28) week++;
      cells += `<span class="day${done ? ' done' : ''}${isT ? ' today' : ''}${fut ? ' fut' : ''}" title="${d.toLocaleDateString('sk-SK')}">${d.getDate()}</span>`;
    }
    const hd = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map(x => `<span class="dh">${x}</span>`).join('');
    return `<section class="card cal"><h3>Posledných päť týždňov</h3><div class="grid">${hd}${cells}</div><p class="muted">Tento týždeň: ${week} ${dni(week)}. Vynechaný deň nevadí – pokračuj ďalšou zostavou.</p></section>`;
  }

  function viewHome() {
    nav('dnes');
    const now = new Date(), hod = now.getHours();
    const pozdrav = hod < 10 ? 'Dobré ráno' : hod < 18 ? 'Dobrý deň' : 'Dobrý večer';
    const datum = now.toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' });
    const zid = ORDER[S.next % ORDER.length], z = ZOSTAVY[zid];
    const dnes = S.done[today()];
    const pocet = Object.keys(S.done).length;
    const tip = TIPY[Math.floor(+now / 864e5) % TIPY.length];

    const intro = S.intro ? '' : `
      <section class="card intro">
        <h3>Ako to funguje</h3>
        <ol>
          <li>Každý deň jedna zostava na 10 minút. Zostavy sa striedajú: A, B, C, D a znova.</li>
          <li>Prvé dva týždne sa uč cviky, nie výkon. Pri každom cviku si v pokoji prečítaj „Ako na to“ – pri prvom stretnutí s cvikom dostaneš aj viac času na prípravu.</li>
          <li>Telefón polož tak, aby si naň videla. Hlas ťa prevedie a pípne, keď je čas na ďalší cvik.</li>
          <li>Keď vynecháš deň, nič sa nedeje. Pokračuješ tam, kde si skončila.</li>
        </ol>
        <button class="btn ghost" data-act="intro">Rozumiem</button>
      </section>`;

    app.innerHTML = `
      <header class="hello">
        <p class="eyebrow">${datum}</p>
        <h1>${pozdrav}</h1>
      </header>
      ${intro}
      ${dnes ? `<p class="donebar">Dnes máš odcvičené <span>✓</span></p>` : ''}
      <section class="card today">
        <p class="eyebrow">${dnes ? 'Ďalšia zostava' : 'Dnešné cvičenie'} · zostava ${zid} · asi ${zMin(z)} minút</p>
        <h2>${z.nazov}</h2>
        <p class="lead">${z.popis}</p>
        <p class="need"><span class="muted">Priprav si:</span> ${chips(pomockyZ(z))}</p>
        <button class="btn big" data-start="${zid}">${ICON.play}<span>${dnes ? 'Zacvičiť si aj tak' : 'Začať cvičiť'}</span></button>
        <ul class="exlist">${z.cviky.map(exItem).join('')}</ul>
      </section>
      <section class="card alt">
        <h3>Iná možnosť</h3>
        <div class="alts">
          <a class="alt-z" href="#/zostava/K"><b>Krátka verzia</b><small>${zMin(ZOSTAVY.K)} minúty · na horšie dni</small></a>
          ${ORDER.filter(x => x !== zid).map(x => `<a class="alt-z" href="#/zostava/${x}"><b>Zostava ${x}</b><small>${ZOSTAVY[x].nazov}</small></a>`).join('')}
        </div>
      </section>
      ${kalendar()}
      <section class="card tip">
        <h3>Vedela si?</h3>
        <p>${tip}</p>
      </section>
      ${pocet ? '' : '<p class="muted center small">Tip: na mobile si stránku pridaj na plochu (Zdieľať → Pridať na plochu). Bude sa otvárať ako appka.</p>'}
    `;
    const ib = $('[data-act="intro"]');
    if (ib) ib.onclick = () => {
      S.intro = true;
      save();
      viewHome();
    };
  }

  /* ---------- Zostava ---------- */
  function viewZostava(zid) {
    nav('dnes');
    const z = ZOSTAVY[zid];
    app.innerHTML = `
      <a class="back" href="#/">${ICON.back} Domov</a>
      <header class="hello"><p class="eyebrow">${z.kratka ? 'Krátka verzia' : 'Zostava ' + zid} · asi ${zMin(z)} minút</p><h1>${z.nazov}</h1><p class="lead">${z.popis}</p></header>
      <section class="card">
        <p class="need"><span class="muted">Priprav si:</span> ${chips(pomockyZ(z))}</p>
        <button class="btn big" data-start="${zid}">${ICON.play}<span>Začať</span></button>
        <ul class="exlist">${z.cviky.map(exItem).join('')}</ul>
      </section>`;
  }

  /* ---------- Zoznam cvikov ---------- */
  function viewList() {
    nav('cviky');
    let html = `<header class="hello"><p class="eyebrow">Knižnica</p><h1>Všetky cviky</h1><p class="lead">Ťukni na cvik a uvidíš animáciu a celý postup krok po kroku.</p></header>`;
    for (const [k, nazov] of Object.entries(OBLASTI)) {
      const list = CVIKY.filter(c => c.oblast === k);
      if (!list.length) continue;
      html += `<section class="group"><h2>${nazov}</h2>${k === 'sila' ? '<p class="muted">Keď budú základné zostavy sedieť, pridáme silové cviky. Tento si môžeš pozrieť už teraz.</p>' : ''}<ul class="exlist cards">${list
        .map(c => `<li><a href="#/cvik/${c.id}"><span class="thumb">${Anim.still(c.anim)}</span><span class="t"><b>${c.nazov}</b><small>${c.kolko}</small></span></a></li>`)
        .join('')}</ul></section>`;
    }
    app.innerHTML = html;
  }

  /* ---------- Detail cviku ---------- */
  function navod(c, full = true) {
    const ol = arr => `<ol class="steps">${arr.map(x => `<li>${x}</li>`).join('')}</ol>`;
    return `
      ${c.bezpecnost ? `<p class="warn"><b>Pozor:</b> ${c.bezpecnost}</p>` : ''}
      <h3>Východisková poloha</h3>${ol(c.start)}
      <h3>Pohyb</h3>${ol(c.pohyb)}
      <div class="facts">
        <div><h4>Dýchanie</h4><p>${c.dych}</p></div>
        <div><h4>Čo by si mala cítiť</h4><p>${c.citit}</p></div>
      </div>
      <h3>Na čo si dať pozor</h3><ul class="bad">${c.chyby.map(x => `<li>${x}</li>`).join('')}</ul>
      ${full ? `<div class="facts"><div><h4>Ľahšia verzia</h4><p>${c.lahsie}</p></div><div><h4>Ťažšia verzia</h4><p>${c.tazsie}</p></div></div>` : ''}`;
  }

  function viewDetail(c) {
    nav('cviky');
    app.innerHTML = `
      <a class="back" href="#/cviky">${ICON.back} Všetky cviky</a>
      <header class="hello"><p class="eyebrow">${OBLASTI[c.oblast]}</p><h1>${c.nazov}</h1></header>
      <section class="card stage">
        <div class="fig big"></div>
        <p class="cue" aria-live="polite"></p>
      </section>
      <section class="card">
        <p class="need"><span class="muted">Pomôcky:</span> ${c.pomocky.length ? chips(c.pomocky) : '<span class="chip">nič, len ty</span>'}</p>
        <p class="need"><span class="muted">Koľko:</span> <b>${c.kolko}</b></p>
        <h3>Prečo</h3><p>${c.preco}</p>
        ${navod(c)}
        <div class="row">
          <button class="btn" data-start="single" data-single="${c.id}">${ICON.play}<span>Precvičiť tento cvik</span></button>
          <a class="btn ghost" href="${ytUrl(c.video)}" target="_blank" rel="noopener">${ICON.video}<span>Videá na YouTube</span></a>
        </div>
        <p class="muted small">Odkaz otvorí vyhľadávanie na YouTube (väčšinou v angličtine) – pozri si 2–3 videá od fyzioterapeutov a porovnaj s popisom tu.</p>
      </section>`;
    const cue = $('.cue');
    Anim.mount($('.fig'), c.anim, { onCue: t => (cue.textContent = t) });
  }

  /* ---------- Info ---------- */
  function viewInfo() {
    nav('info');
    app.innerHTML = `
      <header class="hello"><p class="eyebrow">Pravidlá a nastavenia</p><h1>Ako cvičiť</h1></header>
      <section class="card rules">
        <h3>Päť pravidiel</h3>
        <ol>
          <li><b>Pomaly.</b> Pomalý pohyb učí kĺb aj mozog. Rýchly pohyb je len švih.</li>
          <li><b>Bolesť najviac 3 z 10.</b> Nepohodlie a natiahnutie je v poriadku. Ostrá, bodavá alebo vystreľujúca bolesť znamená stop – zmenši rozsah alebo cvik vynechaj.</li>
          <li><b>Dýchaj.</b> Nikdy nezadržiavaj dych. Pri námahe výdych.</li>
          <li><b>Každý deň kúsok.</b> Lepšie 10 minút denne ako hodina raz za týždeň. Kĺby majú rady opakovanie.</li>
          <li><b>Po cvičení sa máš cítiť lepšie, nie horšie.</b> Ak bolesť po cvičení pretrváva do ďalšieho dňa, nabudúce uber.</li>
        </ol>
      </section>
      <section class="card">
        <h3>Ako sa to stane zvykom</h3>
        <p>Priviaž cvičenie k niečomu, čo robíš každý deň – napríklad hneď po rannej káve alebo pred obedom. Rovnaký čas, rovnaké miesto. Podložku a loptičku nechaj tam, kde ich uvidíš.</p>
        <p>Keď nie je chuť, urob aspoň <a href="#/zostava/K">krátku verziu</a>. Často sa ukáže, že potom chceš pokračovať.</p>
        <h4>Pripomienka v kalendári</h4>
        <p class="muted">Pridá do kalendára v mobile denné upozornenie.</p>
        <div class="row"><label class="time">Čas <input type="time" id="cas" value="${S.cas}"></label><button class="btn ghost" id="ics">Pridať do kalendára</button></div>
      </section>
      <section class="card">
        <h3>Pomôcky</h3>
        <h4>Máš doma</h4>
        <p>${chips(['fascio loptička', 'jogablok', 'tenké expandery', 'podložka', 'stolička', 'gauč', 'uterák'])}</p>
        <h4>Oplatí sa dokúpiť (lacné, voliteľné)</h4>
        <ul>
          <li><b>Sada odporových gúm rôznej sily</b> – keď bude tenký expander ľahký.</li>
          <li><b>Tenisová loptička</b> – mäkšia na chodidlá, ak je fascio loptička moc tvrdá.</li>
          <li><b>Gumičky na prsty</b> – stačí aj hrubšia gumička do vlasov.</li>
          <li><b>Balančná podložka alebo hrubší vankúš</b> – neskôr na státie na jednej nohe.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Nastavenia</h3>
        <label class="switch"><input type="checkbox" id="voice" ${S.voice ? 'checked' : ''}><span>Hlasové pokyny a pípanie</span></label>
        <div class="row"><button class="btn ghost" id="test">Vyskúšať hlas</button></div>
        <p class="muted small" id="vinfo"></p>
      </section>
      <section class="card">
        <h3>Dôležité</h3>
        <p>Toto sú všeobecné cviky na udržanie pohyblivosti, nie liečba. Ak máš bolesť, ktorá neprechádza, umelý kĺb, čerstvý úraz alebo operáciu, osteoporózu či závraty, ukáž cviky lekárovi alebo fyzioterapeutovi a nechaj si poradiť, čo vynechať.</p>
        <p class="muted small">Záznamy o cvičení sú uložené len v tomto prehliadači.</p>
      </section>`;
    $('#voice').onchange = e => {
      S.voice = e.target.checked;
      save();
    };
    $('#test').onclick = () => {
      audioInit();
      const was = S.voice;
      S.voice = true;
      beep();
      Hlas.say('Dobrý deň. Takto budem hovoriť počas cvičenia.');
      S.voice = was;
    };
    $('#vinfo').textContent = Object.keys(Hlas.nahravky).length
      ? 'Hlas: nahrávky ElevenLabs.'
      : !('speechSynthesis' in window)
      ? 'Tento prehliadač nevie čítať nahlas – budú fungovať len pípnutia.'
      : Hlas.voice
        ? `Hlas: ${Hlas.voice.name}`
        : 'Slovenský hlas sa nenašiel. Ak hlas nepočuješ, v nastaveniach telefónu doinštaluj slovenský hlas (Prevod textu na reč).';
    $('#cas').onchange = e => {
      S.cas = e.target.value || '08:00';
      save();
    };
    $('#ics').onclick = stiahniIcs;
  }

  function stiahniIcs() {
    const [h, m] = (S.cas || '08:00').split(':');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const ds = dkey(d).replace(/-/g, '') + `T${h}${m}00`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const url = location.href.split('#')[0];
    const txt = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//klby-10-minut//SK', 'BEGIN:VEVENT',
      `UID:klby-${Date.now()}@klby10`, `DTSTAMP:${stamp}`, `DTSTART:${ds}`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
      'SUMMARY:10 minút pre kĺby', `DESCRIPTION:${url}`, `URL:${url}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Čas na 10 minút pre kĺby', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' }));
    a.download = 'cvicenie.ics';
    a.click();
  }

  /* ---------- Prehrávač ---------- */
  let P = null;

  function startSession(zid, single) {
    audioInit();
    const list = single ? [[single, byId[single].strany ? 60 : 45]] : ZOSTAVY[zid].cviky;
    const phases = [];
    list.forEach(([id, dur], i) => {
      const c = byId[id];
      phases.push({ t: 'prep', c, i, dur: S.seen[id] ? PREP : PREP_NEW });
      if (c.strany) {
        phases.push({ t: 'work', c, i, dur: Math.round(dur / 2), side: 0 });
        phases.push({ t: 'switch', c, i, dur: SWITCH, side: 1 });
        phases.push({ t: 'work', c, i, dur: Math.round(dur / 2), side: 1 });
      } else phases.push({ t: 'work', c, i, dur });
    });
    P = { zid: single ? null : zid, list, phases, k: 0, left: phases[0].dur, paused: false, last: performance.now(), fig: null, figC: null, tipIdx: -1 };
    lock(true);
    location.hash = '#/cvicenie';
    renderPlayer();
    enterPhase();
    P.timer = setInterval(tick, 200);
  }

  function renderPlayer() {
    const el = document.createElement('div');
    el.className = 'player';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cvičenie');
    el.innerHTML = `
      <div class="p-top">
        <button class="icon" data-act="close" aria-label="Ukončiť">${ICON.close}</button>
        <div class="p-prog">${P.list.map(() => '<i></i>').join('')}</div>
        <button class="icon" data-act="voice" aria-label="Hlas">${S.voice ? ICON.sound : ICON.mute}</button>
      </div>
      <div class="p-main">
        <div class="p-stage"><div class="p-fig"></div><p class="p-cue" aria-live="polite"></p></div>
        <div class="p-info">
          <p class="p-phase"></p>
          <h2 class="p-name"></h2>
          <p class="p-strana"></p>
          <div class="p-timer">
            <svg viewBox="0 0 120 120"><circle class="trk" r="52" cx="60" cy="60"/><circle class="arc" r="52" cx="60" cy="60"/></svg>
            <span class="p-time"></span>
          </div>
          <div class="p-text"></div>
        </div>
      </div>
      <div class="p-ctrl">
        <button class="pc" data-act="prev">${ICON.prev}<span>Späť</span></button>
        <button class="pc main" data-act="pause">${ICON.pause}<span>Pauza</span></button>
        <button class="pc" data-act="next">${ICON.next}<span>Ďalej</span></button>
      </div>
      <button class="p-how" data-act="how">Ako na to – celý postup</button>
      <div class="sheet" hidden><div class="sheet-in"><button class="icon" data-act="sheet-close" aria-label="Zavrieť">${ICON.close}</button><div class="sheet-body"></div><button class="btn big" data-act="sheet-close">Pokračovať v cvičení</button></div></div>
      <div class="ask" hidden></div>`;
    document.body.appendChild(el);
    document.body.classList.add('playing');
    P.el = el;
    el.addEventListener('click', onPlayerClick);
    if (document.activeElement) document.activeElement.blur();
    $('[data-act="pause"]', el).focus({ preventScroll: true });
  }

  function onPlayerClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || !P) return;
    const act = b.dataset.act;
    if (act === 'pause') setPaused(!P.paused);
    else if (act === 'next') jump(1);
    else if (act === 'prev') jump(-1);
    else if (act === 'voice') {
      S.voice = !S.voice;
      save();
      b.innerHTML = S.voice ? ICON.sound : ICON.mute;
      if (!S.voice) Hlas.stop();
    } else if (act === 'how') {
      const sh = $('.sheet', P.el);
      $('.sheet-body', sh).innerHTML = `<h2>${P.phases[P.k].c.nazov}</h2>` + navod(P.phases[P.k].c, false);
      sh.hidden = false;
      P.sheetPaused = !P.paused;
      setPaused(true);
    } else if (act === 'sheet-close') {
      $('.sheet', P.el).hidden = true;
      if (P.sheetPaused) setPaused(false);
    } else if (act === 'close') askClose();
    else if (act === 'ask-cont') {
      $('.ask', P.el).hidden = true;
      if (P.askPaused) setPaused(false);
    } else if (act === 'ask-save') finish(true);
    else if (act === 'ask-quit') history.back();
    else if (act === 'feel') {
      const d = S.done[today()];
      if (d) {
        d.pocit = b.dataset.v;
        save();
      }
      $('.feel-msg', P.el).textContent = FEEL[b.dataset.v];
      P.el.querySelectorAll('[data-act="feel"]').forEach(x => x.classList.toggle('on', x === b));
    } else if (act === 'home') history.back();
  }

  const FEEL = {
    lahko: 'Výborne. Keď to bude ľahké niekoľko dní po sebe, skús pri niektorých cvikoch ťažšiu verziu – nájdeš ju v popise cviku.',
    akurat: 'Presne tak to má byť. Zajtra ďalšia zostava.',
    narocne: 'Zajtra spomaľ a zmenši rozsah. Aj polovica stačí – hlavné je, že sa hýbeš.',
    bolelo: 'Ten cvik zatiaľ rob v menšom rozsahu alebo ho vynechaj. Ak bolesť neprejde do ďalšieho dňa, poraď sa s lekárom alebo fyzioterapeutom.',
  };

  function askClose() {
    P.askPaused = !P.paused;
    setPaused(true);
    const ask = $('.ask', P.el);
    const canSave = P.zid && P.phases[P.k].i > 0;
    ask.innerHTML = `<div class="ask-in"><h2>Ukončiť cvičenie?</h2>
      <button class="btn big" data-act="ask-cont">Pokračovať</button>
      ${canSave ? '<button class="btn ghost" data-act="ask-save">Ukončiť a zapísať, čo som stihla</button>' : ''}
      <button class="btn ghost" data-act="ask-quit">Ukončiť bez zápisu</button></div>`;
    ask.hidden = false;
  }

  function setPaused(v) {
    P.paused = v;
    P.last = performance.now();
    const b = $('[data-act="pause"]', P.el);
    b.innerHTML = v ? `${ICON.play}<span>Pokračovať</span>` : `${ICON.pause}<span>Pauza</span>`;
    P.el.classList.toggle('paused', v);
    if (P.fig) v ? P.fig.pause() : P.fig.play();
    if (v) Hlas.stop();
  }

  function jump(dir) {
    const ph = P.phases;
    const starts = ph.map((p, i) => (p.t === 'prep' ? i : -1)).filter(i => i >= 0);
    const cur = ph[P.k].i;
    let target;
    if (dir > 0) target = starts[cur + 1];
    else target = P.k === starts[cur] && cur > 0 ? starts[cur - 1] : starts[cur];
    if (target === undefined) return finish();
    P.k = target;
    P.left = ph[target].dur;
    enterPhase();
  }

  function next() {
    const ph = P.phases[P.k];
    if (ph.t === 'work') {
      S.seen[ph.c.id] = true;
      save();
    }
    P.k++;
    if (P.k >= P.phases.length) return finish();
    P.left = P.phases[P.k].dur;
    enterPhase();
  }

  function tick() {
    if (!P || !P.timer) return;
    const now = performance.now(), dt = (now - P.last) / 1000;
    P.last = now;
    if (P.paused) return;
    const before = Math.ceil(P.left);
    P.left -= dt;
    const after = Math.ceil(P.left);
    if (after !== before && after <= 3 && after > 0) beep(660, 0.12);
    if (P.left <= 0) return next();
    const ph = P.phases[P.k];
    if (ph.t === 'work') {
      const idx = Math.floor((ph.dur - P.left) / 15);
      if (idx !== P.tipIdx) {
        P.tipIdx = idx;
        const h = ph.c.hlas[idx % ph.c.hlas.length];
        const tipEl = $('.p-tip', P.el);
        if (tipEl) tipEl.textContent = h;
        if (idx > 0) Hlas.say(h);
      }
    }
    timeUI();
  }

  function timeUI() {
    const ph = P.phases[P.k];
    $('.p-time', P.el).textContent = mmss(P.left);
    const arc = $('.arc', P.el), C = 2 * Math.PI * 52;
    arc.style.strokeDasharray = C;
    arc.style.strokeDashoffset = C * (1 - Math.max(0, P.left) / ph.dur);
  }

  function enterPhase() {
    const ph = P.phases[P.k], c = ph.c, el = P.el, n = P.list.length;
    el.dataset.phase = ph.t;
    el.scrollTop = 0;
    el.querySelectorAll('.p-prog i').forEach((x, i) => (x.className = i < ph.i ? 'done' : i === ph.i ? 'cur' : ''));
    if (P.figC !== c) {
      const cue = $('.p-cue', el);
      P.fig = Anim.mount($('.p-fig', el), c.anim, { onCue: t => (cue.textContent = t) });
      P.figC = c;
      if (P.paused) P.fig.pause();
    }
    $('.p-name', el).textContent = c.nazov;
    const strana = c.strany ? c.strany[ph.side || 0] : '';
    P.tipIdx = -1;
    if (ph.t === 'prep') {
      $('.p-phase', el).textContent = `Priprav sa · cvik ${ph.i + 1} z ${n}`;
      $('.p-strana', el).textContent = strana ? `Začíname: ${strana.toLowerCase()}` : '';
      $('.p-text', el).innerHTML = `
        ${c.pomocky.length ? `<p class="need">${chips(c.pomocky)}</p>` : ''}
        <h3>Východisková poloha</h3><ol class="steps">${c.start.map(x => `<li>${x}</li>`).join('')}</ol>
        ${S.seen[c.id] ? '' : '<p class="muted small">Tento cvik robíš prvýkrát – máš viac času na prípravu. Ťukni na „Ako na to“ pre celý postup.</p>'}`;
      Hlas.say([ph.i === 0 ? 'Začíname.' : 'Ďalší cvik.', `${c.nazov}.`]);
    } else if (ph.t === 'switch') {
      $('.p-phase', el).textContent = 'Vymeň stranu';
      $('.p-strana', el).textContent = strana;
      $('.p-text', el).innerHTML = `<p class="p-tip big">Teraz druhá strana: ${strana.toLowerCase()}</p>`;
      Hlas.say('Druhá strana.');
    } else {
      $('.p-phase', el).textContent = `Cvičíme · cvik ${ph.i + 1} z ${n}`;
      $('.p-strana', el).textContent = strana;
      $('.p-text', el).innerHTML = `<p class="p-tip big">${c.hlas[0]}</p><p class="muted">${c.kolko}</p>`;
      beep(880, 0.22);
      if (ph.side !== 1) Hlas.say(c.hlas[0]);
      P.tipIdx = 0;
    }
    timeUI();
  }

  function finish(partial) {
    clearInterval(P.timer);
    P.timer = null;
    lock(false);
    if (P.fig) P.fig.pause();
    if (P.zid) {
      S.done[today()] = { z: P.zid };
      if (!ZOSTAVY[P.zid].kratka && P.zid === ORDER[S.next % ORDER.length]) S.next = (S.next + 1) % ORDER.length;
      save();
    }
    if (!partial) beep(990, 0.35);
    Hlas.say(P.zid ? 'Hotovo. Dnešné cvičenie je za tebou.' : 'Hotovo.');
    const el = P.el;
    el.dataset.phase = 'done';
    $('.ask', el).hidden = true;
    $('.sheet', el).hidden = true;
    el.querySelector('.p-main').innerHTML = `
      <div class="done-box">
        <p class="eyebrow">${P.zid ? (ZOSTAVY[P.zid].kratka ? 'Krátka verzia' : 'Zostava ' + P.zid) : 'Precvičené'}</p>
        <h2>Hotovo</h2>
        ${P.zid ? `<p class="lead">${partial ? 'Aj kúsok sa ráta. Zapísané.' : 'Dnešné cvičenie je za tebou.'}</p>
        <h3>Ako sa ti dnes cvičilo?</h3>
        <div class="feel">
          <button class="btn ghost" data-act="feel" data-v="lahko">Ľahko</button>
          <button class="btn ghost" data-act="feel" data-v="akurat">Akurát</button>
          <button class="btn ghost" data-act="feel" data-v="narocne">Náročne</button>
          <button class="btn ghost" data-act="feel" data-v="bolelo">Niečo bolelo</button>
        </div>
        <p class="feel-msg"></p>` : ''}
        <button class="btn big" data-act="home">Späť domov</button>
      </div>`;
    el.querySelector('.p-ctrl').remove();
    el.querySelector('.p-how').remove();
    el.querySelectorAll('.p-prog i').forEach(x => (x.className = 'done'));
  }

  function closePlayer() {
    if (!P) return;
    clearInterval(P.timer);
    lock(false);
    Hlas.stop();
    P.el.remove();
    document.body.classList.remove('playing');
    P = null;
  }

  let wl = null;
  async function lock(on) {
    try {
      if (on && 'wakeLock' in navigator) wl = await navigator.wakeLock.request('screen');
      else if (!on && wl) {
        await wl.release();
        wl = null;
      }
    } catch {}
  }
  document.addEventListener('visibilitychange', () => {
    if (P && P.timer && document.visibilityState === 'visible') lock(true);
  });

  // Ovládač TV a klávesnica počas cvičenia: OK/medzera = pauza, šípky = ďalší/predchádzajúci cvik, späť = ukončiť
  document.addEventListener('keydown', e => {
    if (!P || !P.timer) return;
    const tlacidlo = document.activeElement && document.activeElement.closest('button, a');
    const k = e.key, c = e.keyCode;
    if (k === 'ArrowRight' || c === 417) jump(1);
    else if (k === 'ArrowLeft' || c === 412) jump(-1);
    else if (k === 'MediaPlayPause' || c === 179 || c === 415 || c === 19 || ((k === ' ' || k === 'Enter') && !tlacidlo)) setPaused(!P.paused);
    else if (k === 'Escape' || k === 'Backspace' || c === 461) askClose();
    else return;
    e.preventDefault();
  });

  route();
})();
