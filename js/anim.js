/* Animované ukážky cvikov.
   Animácia = rig (čo kreslíme: postavička, chodidlo, ruka…) + kľúčové pózy.
   Medzi pózami sa všetky čísla plynulo prelínajú a výsledok sa kreslí ako SVG. */
(function () {
  'use strict';

  const R = Math.PI / 180;
  const FLOOR = 216;
  const L = { torso: 58, neck: 13, head: 12, ua: 32, fa: 30, th: 44, sh: 42 };

  const ease = t => 0.5 - Math.cos(Math.PI * t) / 2;
  const add = (p, v, k = 1) => ({ x: p.x + v.x * k, y: p.y + v.y * k });
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const vec = (deg, len) => ({ x: Math.sin(deg * R) * len, y: Math.cos(deg * R) * len });
  const rot = (v, deg) => {
    const c = Math.cos(deg * R), s = Math.sin(deg * R);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  };
  const n = v => Math.round(v * 10) / 10;
  const P = p => `${n(p.x)} ${n(p.y)}`;
  const path = (pts, cls) => `<path class="${cls}" d="M${pts.map(P).join(' L')}"/>`;
  // končatina s obrysom (koža)
  const skin = (pts, w) =>
    `<path class="sk-o" style="stroke-width:${w + 4}" d="M${pts.map(P).join(' L')}"/>` +
    `<path class="sk" style="stroke-width:${w}" d="M${pts.map(P).join(' L')}"/>`;

  // dvojkĺbová končatina: koreň, cieľ, dĺžky, smer ohnutia
  function ik(root, target, a, b, bend) {
    const dx = target.x - root.x, dy = target.y - root.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const dd = Math.min(Math.max(d, Math.abs(a - b) + 0.5), a + b - 0.01);
    const base = Math.atan2(dy, dx);
    const al = Math.acos((a * a + dd * dd - b * b) / (2 * a * dd));
    const ang = base - bend * al;
    return {
      mid: { x: root.x + Math.cos(ang) * a, y: root.y + Math.sin(ang) * a },
      end: { x: root.x + (dx / d) * dd, y: root.y + (dy / d) * dd },
    };
  }

  /* ---------- Postavička ----------
     Bočný pohľad: postava pozerá doprava, 1 = bližšia strana, 2 = vzdialenejšia.
     Pohľad spredu (view:'front'): 1 = vľavo na obrázku.
     Uhly končatín: 0 = smerom dole, kladné = dopredu (spredu: do strany). */
  const BODY = {
    hx: 150, hy: 125, tr: 0, ts: 1, tb: 0, hd: 0, ht: 0, htl: 0, nose: 0, se: 0, sp: 0,
    ua1: 4, fa1: 4, ua2: -4, fa2: -4, sua1: 1, sfa1: 1, sua2: 1, sfa2: 1, eb1: -1, eb2: -1,
    t1x: 162, t1y: FLOOR, t2x: 157, t2y: FLOOR, ft1: 0, ft2: 0, kb1: 1, kb2: 1,
    th1: 0, sh1: 0, th2: 0, sh2: 0, sth1: 1, ssh1: 1, sth2: 1, ssh2: 1,
  };
  const BODY_FRONT = { ua1: 7, fa1: 7, ua2: 7, fa2: 7, t1x: 139, t2x: 161 };

  function joints(p, front, fk) {
    const H = { x: p.hx, y: p.hy };
    const up = { x: Math.sin(p.tr * R), y: -Math.cos(p.tr * R) };
    const fw = { x: Math.cos(p.tr * R), y: Math.sin(p.tr * R) };
    const N = add(H, up, L.torso * p.ts);
    const J = { H, N, up, fw };

    if (front) {
      J.head = add(N, rot({ x: 0, y: -(L.neck + L.head) }, p.htl));
      J.S1 = { x: N.x - 17, y: N.y + 6 - p.se };
      J.S2 = { x: N.x + 17, y: N.y + 6 - p.se };
    } else {
      const ha = (p.tr + p.hd) * R;
      J.head = add(add(N, { x: Math.sin(ha), y: -Math.cos(ha) }, L.neck + L.head), { x: 1, y: 0 }, p.ht);
      J.S1 = add(add(N, up, p.se - 5), fw, p.sp);
      J.S2 = add(J.S1, fw, -2);
    }

    for (const i of [1, 2]) {
      const sx = front ? (i === 1 ? -1 : 1) : 1;
      const S = J['S' + i];
      if (p['h' + i + 'x'] !== undefined) {
        const r = ik(S, { x: p['h' + i + 'x'], y: p['h' + i + 'y'] }, L.ua, L.fa, p['eb' + i] * (front ? -sx : 1));
        J['E' + i] = r.mid;
        J['W' + i] = r.end;
      } else {
        const off = p.rel ? p.tr : 0;
        const u = vec(p['ua' + i] + off, L.ua * p['sua' + i]);
        u.x *= sx;
        J['E' + i] = add(S, u);
        const f = vec(p['fa' + i] + off, L.fa * p['sfa' + i]);
        f.x *= sx;
        J['W' + i] = add(J['E' + i], f);
      }

      const hip = front ? { x: H.x + sx * 10, y: H.y } : H;
      J['P' + i] = hip;
      const ft = p['ft' + i];
      if (fk) {
        const t = vec(p['th' + i], L.th * p['sth' + i]);
        t.x *= sx;
        J['K' + i] = add(hip, t);
        const s = vec(p['sh' + i], L.sh * p['ssh' + i]);
        s.x *= sx;
        J['A' + i] = add(J['K' + i], s);
      } else {
        const toe = { x: p['t' + i + 'x'], y: p['t' + i + 'y'] };
        const at = front
          ? { x: toe.x, y: toe.y - 9 - Math.sin(ft * R) * 14 }
          : add(toe, rot({ x: -16, y: -9 }, ft));
        const r = ik(hip, at, L.th, L.sh, p['kb' + i] * sx);
        J['K' + i] = r.mid;
        J['A' + i] = r.end;
      }
      const A = J['A' + i];
      if (front) {
        J['T' + i] = { x: A.x + sx * 6, y: A.y + 7 };
        J['Hl' + i] = { x: A.x - sx * 2, y: A.y + 7 };
      } else {
        J['T' + i] = add(A, rot({ x: 16, y: 9 }, ft));
        J['Hl' + i] = add(J['T' + i], rot({ x: -22, y: 0 }, ft));
      }
    }
    return J;
  }

  const BACK_PROPS = { chair: 1, chairF: 1, wall: 1, wallBg: 1, mat: 1, glow: 1 };

  function prop(pr, J, p) {
    const at = a => (Array.isArray(a) ? (typeof a[0] === 'string' ? mix(J[a[0]], J[a[1]], a[2]) : { x: a[0], y: a[1] }) : J[a]);
    switch (pr.t) {
      case 'chair': {
        const x = pr.x, d = pr.dir || 1, y = 166, top = y - (pr.back || 68);
        return `<path class="prop" d="M${x} ${y} L${x + d * 52} ${y} M${x + 3 * d} ${y} L${x + 3 * d} ${FLOOR + 3} M${x + d * 49} ${y} L${x + d * 49} ${FLOOR + 3} M${x} ${y} L${x - d * 4} ${top}"/>`;
      }
      case 'chairF': {
        const x = p.hx;
        return `<rect class="pf" x="${x - 30}" y="96" width="60" height="66" rx="8"/><path class="prop" d="M${x - 34} 168 L${x + 34} 168 M${x - 30} 168 L${x - 30} ${FLOOR + 3} M${x + 30} 168 L${x + 30} ${FLOOR + 3}"/>`;
      }
      case 'wall':
        return `<rect class="wall" x="${pr.x}" y="0" width="${300 - pr.x}" height="${FLOOR + 4}"/><line class="wall-l" x1="${pr.x}" y1="0" x2="${pr.x}" y2="${FLOOR + 4}"/>`;
      case 'wallBg':
        return `<rect class="wall" x="78" y="6" width="144" height="${FLOOR - 2}" rx="6"/><text class="lbl" x="150" y="${FLOOR - 8}" text-anchor="middle">stena za chrbtom</text>`;
      case 'mat':
        return `<rect class="mat" x="16" y="${FLOOR + 2}" width="268" height="6" rx="3"/>`;
      case 'glow': {
        const c = at(pr.at), op = pr.op ? ` style="opacity:${n(0.35 * p[pr.op])}"` : '';
        return `<circle class="glow" cx="${n(c.x)}" cy="${n(c.y)}" r="${pr.r || 15}"${op}/>`;
      }
      case 'blockAt': {
        const c = at(pr.at), w = pr.w || 14, h = pr.h || 26;
        return `<rect class="blk" x="${n(c.x - w / 2)}" y="${n(c.y - h / 2)}" width="${w}" height="${h}" rx="3"/>`;
      }
      case 'blockK': {
        const c = mix(J.K1, J.K2, 0.5);
        return `<rect class="blk" x="${n(c.x - 7)}" y="${n(c.y - 13)}" width="14" height="26" rx="3"/>`;
      }
      case 'ball': {
        const c = add(at(pr.at), { x: pr.dx || 0, y: pr.dy || 0 });
        return `<circle class="ball" cx="${n(c.x)}" cy="${n(c.y)}" r="${pr.r || 7}"/>`;
      }
      case 'band':
        return `<path class="band" d="M${P(at(pr.a))} L${P(at(pr.b))}"/>`;
      case 'towel': {
        const c = mix(J['S' + pr.i], J['E' + pr.i], 0.6), dx = pr.i === 1 ? 6 : -6;
        return `<rect class="towel" x="${n(c.x + dx - 5)}" y="${n(c.y - 8)}" width="10" height="16" rx="4"/>`;
      }
    }
    return '';
  }

  function drawBody(p, anim) {
    const front = anim.view === 'front';
    const J = joints(p, front, anim.legs === 'fk');
    const props = anim.props || [];
    let s = `<line class="floor" x1="0" y1="${FLOOR + 3.5}" x2="300" y2="${FLOOR + 3.5}"/>`;
    for (const pr of props) if (BACK_PROPS[pr.t]) s += prop(pr, J, p);

    const leg = (i, cls) =>
      path([J['P' + i], J['K' + i], J['A' + i]], `fig leg ${cls}`) +
      `<path class="fig foot ${cls}" d="M${P(J['A' + i])} L${P(J['Hl' + i])} L${P(J['T' + i])} Z"/>`;
    const arm = (i, cls) =>
      path([J['S' + i], J['E' + i], J['W' + i]], `fig arm ${cls}`) +
      `<circle class="hand ${cls}" cx="${n(J['W' + i].x)}" cy="${n(J['W' + i].y)}" r="4.6"/>`;

    let head;
    if (front) {
      const h = J.head, tl = p.htl, o = p.nose * 5;
      const e1 = add(h, rot({ x: -4.5 + o, y: -1 }, tl)), e2 = add(h, rot({ x: 4.5 + o, y: -1 }, tl));
      head = `<circle class="head" cx="${n(h.x)}" cy="${n(h.y)}" r="${L.head}"/>` +
        `<circle class="eye" cx="${n(e1.x)}" cy="${n(e1.y)}" r="1.9"/><circle class="eye" cx="${n(e2.x)}" cy="${n(e2.y)}" r="1.9"/>`;
    } else {
      const a = (p.tr + p.hd) * R, h = J.head;
      const e = add(add(h, { x: Math.cos(a), y: Math.sin(a) }, 6.5), { x: Math.sin(a), y: -Math.cos(a) }, 1.5);
      head = `<circle class="head" cx="${n(h.x)}" cy="${n(h.y)}" r="${L.head}"/><circle class="eye" cx="${n(e.x)}" cy="${n(e.y)}" r="1.9"/>`;
    }
    const neck = path([J.N, mix(J.N, J.head, 0.6)], 'fig neck');

    if (front) {
      s += leg(1, '') + leg(2, '');
      s += `<path class="fig torso-f" d="M${P(J.S1)} L${P(J.S2)} L${P({ x: J.P2.x, y: J.P2.y })} L${P({ x: J.P1.x, y: J.P1.y })} Z"/>`;
      s += neck + arm(1, '') + arm(2, '') + head;
    } else {
      const c = add(mix(J.H, J.N, 0.5), J.fw, p.tb);
      s += leg(2, 'far') + arm(2, 'far');
      s += `<path class="fig torso" d="M${P(J.H)} Q${P(c)} ${P(J.N)}"/>`;
      s += neck + head + leg(1, '') + arm(1, '');
    }
    for (const pr of props) if (!BACK_PROPS[pr.t]) s += prop(pr, J, p);
    return s;
  }

  /* ---------- Chodidlo zboku (vnútorná strana) ---------- */
  const FOOT = { arch: 0, t1: 0, t2: 0, hl: 0, ank: 0, lift: 0, fx: 0, ball: 0, air: 0, circle: 0, ca: 0, blok: 0, band: 0 };

  function drawFoot(p) {
    const a = p.arch, bs = -7 * a, ay = n(193 - 16 * a);
    const ankle = { x: 104, y: 138 }, ballPt = { x: 196 + bs, y: 198 };
    const piv = p.air ? ankle : ballPt, ang = p.air ? -p.ank : p.hl;
    const dx = p.fx, dy = -p.lift;
    const T = q => add(add(piv, rot({ x: q.x - piv.x, y: q.y - piv.y }, ang)), { x: dx, y: dy });
    const floorY = p.blok ? 236 : 200 + (p.air ? 22 : 0);
    const gA = T(ankle);
    const top = { x: p.air ? gA.x : 98 + dx, y: -30 };
    const toe = (base, deg, len) => {
      const th = (deg + (p.air ? 0 : p.hl)) * R;
      return { x: base.x + Math.cos(th) * len, y: base.y - Math.sin(th) * len };
    };
    const tb1 = { x: 203 + bs, y: 191 }, tb2 = { x: 200 + bs, y: 193 };
    const outline = `M86 132 L70 158 Q60 198 92 198 C116 198 126 ${ay} 150 ${ay} C172 ${ay} ${178 + bs} 198 ${194 + bs} 198 L${206 + bs} 198 L${206 + bs} 182 Q164 160 124 130 Z`;

    let s = `<line class="floor" x1="0" y1="${floorY + 1.5}" x2="300" y2="${floorY + 1.5}"/>`;
    if (p.blok) s += `<rect class="blk" x="30" y="199" width="171" height="37" rx="3"/>`;
    if (p.ball) s += `<circle class="ball spiky" cx="150" cy="186" r="13" style="stroke-dashoffset:${n(-p.fx * 0.8)}"/>`;
    s += skin([top, gA], 44);
    s += `<g transform="translate(${n(dx)} ${n(dy)}) rotate(${n(ang)} ${piv.x} ${piv.y})">`;
    s += `<path class="toe2" d="M${P(tb2)} L${P(toe(tb2, p.t2, 22))}"/>`;
    s += `<path class="sk-f" d="${outline}"/>`;
    if (a > 0.01) s += `<ellipse class="glow" cx="148" cy="${n(ay + 4)}" rx="32" ry="9" style="opacity:${n(0.45 * a)}"/>`;
    s += `<circle class="bone" cx="106" cy="150" r="5"/>`;
    s += skin([tb1, toe(tb1, p.t1, 27)], 12);
    s += `</g>`;
    if (p.band) s += `<path class="band" d="M${P(T(toe(tb1, p.t1, 18)))} L296 236"/>`;
    if (a > 0.2) s += `<text class="lbl" x="150" y="228" text-anchor="middle" opacity="${n(a)}">klenba sa dvíha</text>`;
    if (p.circle > 0.01) {
      const cx = 230, cy = 191 - p.lift - 4;
      const dot = { x: cx + 10 * Math.cos(p.ca * R), y: cy - 24 * Math.sin(p.ca * R) };
      s += `<g opacity="${n(p.circle)}"><ellipse class="trace" cx="${cx}" cy="${cy}" rx="10" ry="24"/><circle class="dot" cx="${n(dot.x)}" cy="${n(dot.y)}" r="5"/></g>`;
    }
    return s;
  }

  /* ---------- Ruka zboku, predlaktie na stole ---------- */
  const HAND = { w: 0, fg: 0, press: 0, blk: 0 };

  function drawHand(p) {
    const W = { x: 180, y: 104 };
    const dir = d => ({ x: Math.cos(d * R), y: -Math.sin(d * R) });
    const pe = add(W, dir(p.w), 40), tip = add(pe, dir(p.w + p.fg), 34);
    const tb = add(W, dir(p.w), 12), tt = add(tb, dir(p.w + 38), 20);
    let s = `<line class="floor" x1="0" y1="${FLOOR + 3.5}" x2="300" y2="${FLOOR + 3.5}"/>`;
    s += `<rect class="pf" x="-10" y="118" width="186" height="12" rx="3"/><path class="prop" d="M24 130 L24 ${FLOOR + 3} M158 130 L158 ${FLOOR + 3}"/>`;
    s += skin([{ x: 6, y: 104 }, W], 24);
    if (p.blk) {
      const f = add(W, dir(p.w), 16), b = add(f, dir(p.w + 90), 86);
      s += `<path class="blk-l" d="M${P(add(f, dir(p.w + 90), -14))} L${P(b)}"/>`;
      s += skin([W, f], 22) + `<circle class="sk-f" cx="${n(f.x)}" cy="${n(f.y)}" r="15"/>`;
      s += `<text class="lbl" x="250" y="226" text-anchor="middle">palec hore</text>`;
      return s;
    }
    s += skin([tb, tt], 9);
    s += skin([W, pe], 22) + skin([pe, tip], 12);
    if (p.press > 0.01) {
      const nr = dir(p.w + p.fg - 90);
      const a = add(mix(pe, tip, 0.15), nr, 15), b = add(tip, nr, 15);
      s += `<g opacity="${n(p.press)}">${skin([a, b], 18)}</g>`;
      s += `<text class="lbl" x="250" y="40" text-anchor="middle" opacity="${n(p.press)}">druhá ruka</text>`;
    }
    return s;
  }

  /* ---------- Otáčanie predlaktia, päsť spredu ---------- */
  const TWIST = { r: 0 };

  function drawTwist(p) {
    const c = { x: 150, y: 132 };
    const th = add(c, rot({ x: 0, y: -19 }, p.r));
    let s = `<line class="floor" x1="0" y1="${FLOOR + 3.5}" x2="300" y2="${FLOOR + 3.5}"/>`;
    s += `<path class="trace" d="M62 132 A88 88 0 0 1 238 132"/>`;
    s += `<text class="lbl" x="44" y="156" text-anchor="middle">dlaň dole</text><text class="lbl" x="256" y="156" text-anchor="middle">dlaň hore</text>`;
    s += `<g transform="rotate(${n(p.r)} ${c.x} ${c.y})"><rect class="blk" x="137" y="62" width="26" height="140" rx="5"/></g>`;
    s += `<circle class="sk-f" cx="${c.x}" cy="${c.y}" r="25"/>`;
    s += `<circle class="sk-f" cx="${n(th.x)}" cy="${n(th.y)}" r="8"/>`;
    s += `<text class="lbl" x="150" y="232" text-anchor="middle">pravá päsť spredu · lakeť pri tele</text>`;
    return s;
  }

  /* ---------- Dlaň spredu s loptičkou ---------- */
  const GRIP = { sq: 0, curl: 0, spread: 0, band: 0, ball: 1, table: 0, l1: 0, l2: 0, l3: 0, l4: 0, lt: 0 };

  function drawGrip(p) {
    const base = [{ x: 126, y: 110 }, { x: 142, y: 104 }, { x: 158, y: 104 }, { x: 174, y: 110 }];
    const len = [38, 46, 44, 34], spr = [-1.5, -0.5, 0.5, 1.5];
    const tips = base.map((b, i) => {
      const a = spr[i] * (4 + 9 * p.spread), l = len[i] * (1 - 0.62 * p.curl) * (1 + 0.25 * p['l' + (i + 1)]);
      return add(b, { x: Math.sin(a * R) * l, y: -Math.cos(a * R) * l });
    });
    const tb = { x: 118, y: 158 }, ta = -58 - 16 * p.spread + 34 * p.curl, tl = 36 * (1 - 0.3 * p.curl);
    const ttip = add(tb, { x: Math.sin(ta * R) * tl, y: -Math.cos(ta * R) * tl });
    let s = p.table ? `<rect class="pf" x="0" y="0" width="300" height="240"/>` : '';
    s += skin([{ x: 150, y: 190 }, { x: 150, y: 260 }], 50);
    if (p.ball) s += `<circle class="ball spiky" cx="150" cy="${n(132 + 6 * p.curl)}" r="${n(41 * (1 - 0.1 * p.sq))}"/>`;
    tips.forEach((t, i) => {
      s += skin([base[i], t], 13);
      const l = p['l' + (i + 1)];
      if (l > 0.05) s += `<circle class="glow" cx="${n(t.x)}" cy="${n(t.y)}" r="11" style="opacity:${n(0.6 * l)}"/>`;
    });
    s += skin([tb, ttip], 14);
    if (p.lt > 0.05) s += `<circle class="glow" cx="${n(ttip.x)}" cy="${n(ttip.y)}" r="11" style="opacity:${n(0.6 * p.lt)}"/>`;
    s += `<rect class="sk-f" x="112" y="102" width="76" height="92" rx="26"/>`;
    if (p.band > 0.01) {
      const ring = [ttip, ...tips];
      s += `<path class="band" opacity="${n(p.band)}" d="M${ring.map(P).join(' L')} Z"/>`;
    }
    return s;
  }

  /* ---------- Otvorená kniha, pohľad od hlavy ---------- */
  const BOOK = { a: -45, band: 0, ball: 0 };

  function drawBook(p) {
    const sh = { x: 150, y: 132 };
    const hand = { x: sh.x + Math.cos(p.a * R) * 92, y: sh.y - Math.sin(p.a * R) * 92 };
    const chest = ((p.a + 45) / 270) * 55;
    const gaze = { x: Math.cos(p.a * R), y: -Math.sin(p.a * R) };
    let s = `<line class="floor" x1="0" y1="${FLOOR + 3.5}" x2="300" y2="${FLOOR + 3.5}"/>`;
    s += `<rect class="mat" x="16" y="${FLOOR + 2}" width="268" height="6" rx="3"/>`;
    s += `<g transform="rotate(${n(-chest)} 150 178)"><ellipse class="torso-x" cx="150" cy="168" rx="24" ry="44"/></g>`;
    if (p.ball)
      s += `<circle class="knee" cx="226" cy="200" r="13"/><circle class="knee" cx="226" cy="158" r="13"/><circle class="ball" cx="226" cy="179" r="9"/><text class="lbl" x="288" y="120" text-anchor="end">loptička medzi kolenami</text>`;
    else s += `<circle class="knee" cx="226" cy="186" r="15"/><text class="lbl" x="226" y="160" text-anchor="middle">kolená</text>`;
    s += path([{ x: 156, y: 208 }, { x: 236, y: 209 }], 'fig arm far');
    s += `<rect class="blk" x="122" y="196" width="56" height="20" rx="4"/>`;
    s += `<circle class="head" cx="150" cy="182" r="15"/>`;
    const e = add({ x: 150, y: 182 }, gaze, 8);
    s += `<circle class="eye" cx="${n(e.x)}" cy="${n(e.y)}" r="2.4"/>`;
    s += path([sh, hand], 'fig arm');
    s += `<circle class="hand" cx="${n(hand.x)}" cy="${n(hand.y)}" r="5"/>`;
    if (p.band) s += `<path class="band" d="M${P(hand)} L236 209"/>`;
    s += `<text class="lbl" x="12" y="22">pohľad od hlavy</text>`;
    return s;
  }

  /* ---------- Dúha prstami, pravé chodidlo spredu ----------
     a = -1 vonkajšia hrana (malíček) na zemi, 0 = vrchol oblúka, 1 = palec na zemi */
  const DUHA = { a: -1 };

  function drawDuha(p) {
    const a = p.a, floorY = 206, ankle = { x: 150, y: 120 };
    const c = { x: 150 + 42 * a, y: floorY - 12 - 50 * (1 - a * a) };
    const tilt = 16 * a;
    const toes = [[-27, 5.5], [-15, 6], [-3, 6.5], [10, 7], [26, 9.5]];
    let s = `<line class="floor" x1="0" y1="${floorY + 1.5}" x2="300" y2="${floorY + 1.5}"/>`;
    s += `<path class="trace" d="M100 ${floorY - 34} Q150 ${floorY - 132} 200 ${floorY - 34}"/>`;
    s += `<text class="lbl" x="70" y="${floorY + 22}" text-anchor="middle">malíček</text><text class="lbl" x="230" y="${floorY + 22}" text-anchor="middle">palec</text>`;
    s += `<ellipse class="heel" cx="150" cy="${floorY - 9}" rx="20" ry="10"/>`;
    s += `<text class="lbl" x="150" y="${floorY + 22}" text-anchor="middle">päta na zemi</text>`;
    s += skin([{ x: 150, y: -30 }, ankle], 44);
    s += skin([ankle, c], 28);
    s += `<g transform="translate(${n(c.x)} ${n(c.y)}) rotate(${n(tilt)})">`;
    s += `<rect class="sk-f" x="-38" y="-10" width="76" height="22" rx="11"/>`;
    for (const [x, r] of toes) s += `<circle class="sk-f" cx="${x}" cy="-10" r="${r}"/>`;
    s += `</g>`;
    if (a > 0.6) s += `<text class="lbl" x="150" y="40" text-anchor="middle" opacity="${n((a - 0.6) / 0.4)}">klenba ostáva hore</text>`;
    return s;
  }

  /* ---------- Engine ---------- */
  const RIGS = {
    body: { def: a => Object.assign({}, BODY, a.view === 'front' ? BODY_FRONT : null), draw: drawBody },
    chodidlo: { def: () => FOOT, draw: drawFoot },
    ruka: { def: () => HAND, draw: drawHand },
    predlaktie: { def: () => TWIST, draw: drawTwist },
    dlan: { def: () => GRIP, draw: drawGrip },
    kniha: { def: () => BOOK, draw: drawBook },
    duha: { def: () => DUHA, draw: drawDuha },
  };

  function prep(anim) {
    if (anim._c) return anim._c;
    const base = Object.assign({}, RIGS[anim.rig].def(anim), anim.base);
    const poses = anim.keys.map(k => Object.assign({}, base, k.p));
    const cues = [];
    let last = '';
    for (let pass = 0; pass < 2; pass++)
      anim.keys.forEach((k, i) => {
        if (k.c) last = k.c;
        cues[i] = last;
      });
    const total = anim.keys.reduce((s, k) => s + (k.d ?? 900) + (k.h ?? 500), 0);
    return (anim._c = { poses, cues, total });
  }

  function sample(anim, ms) {
    const c = prep(anim), keys = anim.keys, k = keys.length;
    let t = ((ms % c.total) + c.total) % c.total;
    for (let i = 0; i < k; i++) {
      const d = keys[i].d ?? 900, h = keys[i].h ?? 500;
      if (t < d + h || i === k - 1) {
        const a = c.poses[(i - 1 + k) % k], b = c.poses[i];
        const e = t >= d ? 1 : keys[i].lin ? t / d : ease(t / d);
        const p = {};
        for (const key in b)
          p[key] = typeof b[key] === 'number' && typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * e : b[key];
        return { p, cue: c.cues[i] };
      }
      t -= d + h;
    }
  }

  function render(anim, ms) {
    const { p, cue } = sample(anim, ms);
    return { svg: RIGS[anim.rig].draw(p, anim), cue };
  }

  const live = new Set();
  let raf = 0;
  function loop(now) {
    raf = 0;
    for (const f of live) {
      if (!f.el.isConnected) {
        live.delete(f);
        continue;
      }
      if (!f.paused) f.draw(now);
    }
    if (live.size) raf = requestAnimationFrame(loop);
  }
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  function mount(el, anim, opts = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 300 240');
    svg.setAttribute('class', 'an');
    svg.setAttribute('aria-hidden', 'true');
    el.replaceChildren(svg);
    let t0 = performance.now(), pausedAt = 0, lastCue = null;
    const f = {
      el: svg,
      paused: false,
      draw(now) {
        const r = render(anim, now - t0);
        svg.innerHTML = r.svg;
        if (r.cue !== lastCue) {
          lastCue = r.cue;
          if (opts.onCue) opts.onCue(r.cue);
        }
      },
      pause() {
        if (!f.paused) {
          f.paused = true;
          pausedAt = performance.now();
        }
      },
      play() {
        if (f.paused) {
          t0 += performance.now() - pausedAt;
          f.paused = false;
          kick();
        }
      },
    };
    f.draw(t0);
    live.add(f);
    kick();
    return f;
  }

  // statický obrázok – póza na začiatku držania kľúča `still` (predvolene druhý kľúč)
  function still(anim) {
    const k = anim.keys, i = anim.still ?? Math.min(1, k.length - 1);
    let t = 0;
    for (let j = 0; j <= i; j++) t += (k[j].d ?? 900) + (j < i ? k[j].h ?? 500 : 0);
    return `<svg class="an" viewBox="0 0 300 240" aria-hidden="true">${render(anim, t + 1).svg}</svg>`;
  }

  window.Anim = { mount, still };
})();
