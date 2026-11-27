/* 우리가족 오피스 — app.js
   가족 비서들이 함께 쓰는 작은 사무실. 어려운 말 없이, 누르면 바로 되는 화면. */
(function () {
  'use strict';

  /* ───────── 기본 정보 ───────── */
  const DB_URL = 'https://pickle-office-609b8-default-rtdb.firebaseio.com';
  const ME_KEY = 'woori-office-me';
  const TAB_KEY = 'woori-office-tab';

  const ROOMS = {
    office:  { name: '열린 사무실', x0: 30,  y0: 40,  x1: 300, y1: 300 },
    meeting: { name: '회의실',      x0: 320, y0: 40,  x1: 510, y1: 180 },
    lounge:  { name: '휴게실',      x0: 320, y0: 200, x1: 510, y1: 360 }
  };
  const ROOM_KEYS = Object.keys(ROOMS);

  const ROOM_SLOTS = {
    office:  [[100, 245], [175, 245], [250, 245], [100, 292], [175, 292], [250, 292]],
    meeting: [[350, 158], [480, 158], [345, 100], [485, 100], [415, 174]],
    lounge:  [[345, 345], [410, 345], [475, 345], [345, 300], [475, 300]]
  };

  const COLORS = {
    beige:  { name: '베이지', base: '#f0d7b4', light: '#fff3de', dark: '#cfae86', ink: '#7a5a35' },
    mint:   { name: '민트',   base: '#a8e3c9', light: '#e0fbf0', dark: '#79bd9f', ink: '#2f6b53' },
    pink:   { name: '분홍',   base: '#ffc2d1', light: '#ffe7ee', dark: '#e89aae', ink: '#8d4358' },
    violet: { name: '보라',   base: '#c9befe', light: '#eee9ff', dark: '#a394e8', ink: '#57468f' },
    sky:    { name: '하늘',   base: '#b8dcff', light: '#e9f5ff', dark: '#8bb9e6', ink: '#2f5c85' },
    lemon:  { name: '노랑',   base: '#ffe6a0', light: '#fff8dc', dark: '#e5c66a', ink: '#7d6220' },
    peach:  { name: '살구',   base: '#ffcdaa', light: '#ffede1', dark: '#e9a87e', ink: '#8a5432' },
    lilac:  { name: '라일락', base: '#e3d4f7', light: '#f7f0ff', dark: '#c0a9e0', ink: '#5f4a80' }
  };
  const COLOR_KEYS = Object.keys(COLORS);
  const GLYPHS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  /* ───────── 가족 입장 암호 ─────────
     암호를 바꾸려면 브라우저 개발자 도구에서 아래 한 줄을 실행해 나온 값을 LOCK.hash 에 넣으면 돼요.
     await officeHash('새암호')
     (지금 암호: 580923) */
  const LOCK = {
    salt: 'woori-office-family',
    hash: 'f97c82bcde37770788359b404111710c8f9d8e70b9c2cabd8b170e1a5ba270b0',
    key: 'woori-office-unlocked'
  };

  const TASK_STATES = {
    waiting: { label: '대기',    next: 'doing' },
    doing:   { label: '진행 중', next: 'done' },
    done:    { label: '완료',    next: 'waiting' }
  };

  /* ───────── 작은 도구들 ───────── */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const color = k => COLORS[k] || COLORS.beige;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function two(n) { return n < 10 ? '0' + n : '' + n; }
  function withRo(word) {
    const code = String(word).charCodeAt(String(word).length - 1);
    const jong = code >= 0xAC00 && code <= 0xD7A3 ? (code - 0xAC00) % 28 : 1;
    return word + (jong && jong !== 8 ? '으로' : '로');
  }
  function clockText(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return two(d.getHours()) + ':' + two(d.getMinutes());
  }
  function dayText(ts) {
    const d = new Date(ts);
    const now = new Date();
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today - day) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  function avatarHtml(glyph, colorKey, extraClass) {
    const c = color(colorKey);
    const g = escapeHtml(glyph || '?');
    return '<span class="avatar ' + (extraClass || '') + '" style="background:radial-gradient(circle at 34% 26%,' +
      c.light + ' 0%,' + c.base + ' 56%,' + c.dark + ' 100%);color:' + c.ink + '">' + g + '</span>';
  }
  async function sha256Hex(text) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.prototype.map.call(new Uint8Array(buf), b => ('0' + b.toString(16)).slice(-2)).join('');
    }
    return null;
  }
  function officeHash(pw) { return sha256Hex(LOCK.salt + ':' + pw); }
  window.officeHash = officeHash;

  function isUnlocked() {
    return localStorage.getItem(LOCK.key) === LOCK.hash;
  }
  function toast(msg) {
    const wrap = $('#toastWrap');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  /* ───────── 저장소 (실시간 연결) ───────── */
  const store = (function () {
    let fb = null;
    try {
      if (window.firebase && window.firebase.initializeApp) {
        window.firebase.initializeApp({ databaseURL: DB_URL });
        fb = window.firebase.database();
      }
    } catch (e) {
      console.warn('[office] 실시간 연결을 준비하지 못했어요:', e);
      fb = null;
    }

    const enc = p => String(p).split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const url = p => DB_URL + '/' + enc(p) + '.json';

    async function req(method, p, body) {
      const res = await fetch(url(p), {
        method: method,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (!res.ok) throw new Error('연결에 문제가 생겼어요 (' + res.status + ')');
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }

    const watchers = new Map();
    let timer = null;
    let busy = false;

    async function poll() {
      if (busy) return;
      busy = true;
      for (const [path, set] of watchers) {
        try {
          const val = await req('GET', path);
          const key = JSON.stringify(val === undefined ? null : val);
          if (set._last !== key) {
            set._last = key;
            set.forEach(cb => { try { cb(val === undefined ? null : val); } catch (e) { console.warn(e); } });
          }
        } catch (e) { /* 잠깐 끊겨도 다시 시도해요 */ }
      }
      busy = false;
    }
    function startPoll() {
      if (timer || fb) return;
      timer = setInterval(poll, 2500);
      poll();
    }

    return {
      mode: fb ? 'live' : 'slow',
      listen(path, cb) {
        if (fb) {
          const ref = fb.ref(path);
          const handler = ref.on('value', snap => cb(snap.val()), err => console.warn('[office]', err));
          return () => ref.off('value', handler);
        }
        if (!watchers.has(path)) {
          const set = new Set();
          set._last = undefined;
          watchers.set(path, set);
        }
        watchers.get(path).add(cb);
        startPoll();
        return () => watchers.get(path).delete(cb);
      },
      set(p, v) { return fb ? fb.ref(p).set(v) : req('PUT', p, v); },
      update(p, v) { return fb ? fb.ref(p).update(v) : req('PATCH', p, v); },
      push(p, v) { return fb ? Promise.resolve(fb.ref(p).push(v).key) : req('POST', p, v); },
      remove(p) { return fb ? fb.ref(p).remove() : req('DELETE', p); }
    };
  })();

  /* ───────── 상태 ───────── */
  const state = {
    members: {},
    messages: {},
    tasks: {},
    meId: localStorage.getItem(ME_KEY) || null,
    tab: localStorage.getItem(TAB_KEY) || 'chat',
    membersLoaded: false,
    messagesLoaded: false,
    tasksLoaded: false,
    onboarded: false
  };

  const me = () => (state.meId ? state.members[state.meId] : null);

  /* ───────── 그림 그리기 도구 ───────── */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = $('#office');
  const ISO = { cx: 430, cy: 248, c: 0.86 };
  const iso = (x, y, z) => [
    ISO.cx + (x - y) * ISO.c,
    ISO.cy + (x + y) * ISO.c * 0.5 - (z || 0) * ISO.c
  ];
  function mk(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function poly(pts, attrs) {
    return mk('polygon', Object.assign({ points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') }, attrs || {}));
  }
  function roundedPoly(pts, r) {
    const n = pts.length;
    let d = '';
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
      const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
      const rr = Math.min(r, la / 2, lb / 2);
      const p1 = [p[0] + (a[0] - p[0]) / la * rr, p[1] + (a[1] - p[1]) / la * rr];
      const p2 = [p[0] + (b[0] - p[0]) / lb * rr, p[1] + (b[1] - p[1]) / lb * rr];
      d += (i === 0 ? 'M' : 'L') + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
      d += 'Q' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d + 'Z';
  }
  function rectPts(x0, y0, x1, y1) {
    return [iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)];
  }
  /* 두께가 있는 바닥판 */
  function slab(parent, x0, y0, x1, y1, h, fill, opt) {
    opt = opt || {};
    const r = opt.r == null ? 18 : opt.r;
    const pts = rectPts(x0, y0, x1, y1);
    const shadowPts = pts.map(p => [p[0] + 4, p[1] + h + 15]);
    parent.appendChild(mk('path', {
      d: roundedPoly(shadowPts, r), fill: opt.shadow || 'rgba(126,98,72,.20)', filter: 'url(#soft)'
    }));
    const sidePts = pts.map(p => [p[0], p[1] + h]);
    parent.appendChild(mk('path', { d: roundedPoly(sidePts, r), fill: opt.side || '#e6d3bd' }));
    const top = mk('path', {
      d: roundedPoly(pts, r), fill: fill,
      stroke: opt.stroke || 'rgba(255,255,255,.55)', 'stroke-width': opt.strokeWidth || 1.6
    });
    if (opt.faceClass) top.setAttribute('class', opt.faceClass);
    parent.appendChild(top);
    return top;
  }
  /* 네모 상자 */
  function box(parent, x0, y0, x1, y1, z0, z1, top, right, front) {
    parent.appendChild(poly([iso(x1, y0, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x1, y0, z1)], { fill: right }));
    parent.appendChild(poly([iso(x0, y1, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x0, y1, z1)], { fill: front }));
    parent.appendChild(poly([iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)], {
      fill: top, stroke: 'rgba(255,255,255,.45)', 'stroke-width': 1
    }));
  }
  /* 둥근 상판 (원형 테이블) */
  function disc(parent, cx, cy, r, z, h, top, side) {
    const p = iso(cx, cy, 0);
    parent.appendChild(mk('ellipse', {
      cx: p[0] + 3, cy: p[1] + h + 12, rx: r * ISO.c * 1.38, ry: r * ISO.c * 0.72,
      fill: 'rgba(126,98,72,.18)', filter: 'url(#soft)'
    }));
    const topP = iso(cx, cy, z);
    parent.appendChild(mk('ellipse', {
      cx: topP[0], cy: topP[1] + h, rx: r * ISO.c * 1.38, ry: r * ISO.c * 0.72, fill: side
    }));
    parent.appendChild(mk('ellipse', {
      cx: topP[0], cy: topP[1], rx: r * ISO.c * 1.38, ry: r * ISO.c * 0.72,
      fill: top, stroke: 'rgba(255,255,255,.5)', 'stroke-width': 1.4
    }));
  }
  function plant(parent, x, y, s) {
    s = s || 1;
    const base = iso(x, y, 0);
    parent.appendChild(mk('ellipse', {
      cx: base[0] + 2, cy: base[1] + 6, rx: 22 * s, ry: 9 * s, fill: 'rgba(126,98,72,.16)', filter: 'url(#soft2)'
    }));
    /* 화분 */
    parent.appendChild(mk('path', {
      d: 'M' + (base[0] - 14 * s) + ' ' + (base[1] - 18 * s) +
        ' L' + (base[0] + 14 * s) + ' ' + (base[1] - 18 * s) +
        ' L' + (base[0] + 10 * s) + ' ' + (base[1]) +
        ' Q' + base[0] + ' ' + (base[1] + 7 * s) + ' ' + (base[0] - 10 * s) + ' ' + base[1] + ' Z',
      fill: 'url(#pot)'
    }));
    const leaves = [[-12, -40, 15], [10, -44, 14], [0, -56, 16], [-20, -52, 11], [20, -58, 11]];
    leaves.forEach(function (l, i) {
      parent.appendChild(mk('ellipse', {
        cx: base[0] + l[0] * s, cy: base[1] + l[1] * s,
        rx: l[2] * s * 0.62, ry: l[2] * s,
        fill: i % 2 ? 'url(#leaf)' : '#8bcfae',
        stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1
      }));
    });
  }
  function label(parent, text, x, y, z, tone, lift) {
    const p = iso(x, y, z || 0);
    const up = lift == null ? 34 : lift;
    const w = text.length * 16.5 + 26;
    const g = mk('g', {});
    g.appendChild(mk('circle', { cx: p[0] + 5, cy: p[1] - 5, r: 3, fill: 'rgba(255,255,255,.85)' }));
    g.appendChild(mk('rect', {
      x: p[0], y: p[1] - 13 - up, width: w, height: 26, rx: 13,
      fill: 'rgba(255,255,255,.92)', stroke: 'rgba(255,255,255,.95)', 'stroke-width': 1
    }));
    g.appendChild(mk('text', {
      x: p[0] + 13, y: p[1] + 1 - up, 'font-size': 13.5, 'font-weight': 700,
      fill: tone || '#57468f', 'dominant-baseline': 'middle'
    })).textContent = text;
    parent.appendChild(g);
    return g;
  }

  const layers = {};

  function buildScene() {
    svg.textContent = '';

    const defs = mk('defs');
    let d = ''
      + '<filter id="soft" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="13"/></filter>'
      + '<filter id="soft2" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="4"/></filter>'
      + '<linearGradient id="floorTop" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fdf4e8"/><stop offset="1" stop-color="#f0dfcb"/></linearGradient>'
      + '<linearGradient id="wallR" x1="0" y1="0" x2="0.15" y2="1"><stop offset="0" stop-color="#fffcf7"/><stop offset="1" stop-color="#f4e6d7"/></linearGradient>'
      + '<linearGradient id="wallL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf7f0"/><stop offset="1" stop-color="#ecdbc8"/></linearGradient>'
      + '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8e4ff"/><stop offset="1" stop-color="#eef8ff"/></linearGradient>'
      + '<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b3e2c9"/><stop offset="1" stop-color="#63b48f"/></linearGradient>'
      + '<linearGradient id="pot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffdcc6"/><stop offset="1" stop-color="#e9b597"/></linearGradient>';
    COLOR_KEYS.forEach(function (k) {
      const c = COLORS[k];
      d += '<radialGradient id="g-' + k + '" cx="34%" cy="26%" r="82%">'
        + '<stop offset="0" stop-color="' + c.light + '"/><stop offset="52%" stop-color="' + c.base + '"/>'
        + '<stop offset="100%" stop-color="' + c.dark + '"/></radialGradient>';
    });
    defs.innerHTML = d;
    svg.appendChild(defs);

    /* 벽 */
    const H = 152;
    const walls = mk('g');
    walls.appendChild(poly([iso(0, 0, H), iso(540, 0, H), iso(540, 0, 0), iso(0, 0, 0)], { fill: 'url(#wallR)' }));
    walls.appendChild(poly([iso(0, 0, H), iso(0, 400, H), iso(0, 400, 0), iso(0, 0, 0)], { fill: 'url(#wallL)' }));
    /* 벽 하단 걸레받이 */
    walls.appendChild(poly([iso(0, 0, 12), iso(540, 0, 12), iso(540, 0, 0), iso(0, 0, 0)], { fill: 'rgba(255,255,255,.55)' }));
    walls.appendChild(poly([iso(0, 0, 12), iso(0, 400, 12), iso(0, 400, 0), iso(0, 0, 0)], { fill: 'rgba(255,255,255,.4)' }));

    /* 왼쪽 벽 동그란 창 */
    const win = mk('g', { transform: 'matrix(-0.86 0.43 0 0.86 430 248)' });
    win.appendChild(mk('circle', { cx: 205, cy: -82, r: 47, fill: 'url(#sky)' }));
    win.appendChild(mk('ellipse', { cx: 190, cy: -66, rx: 17, ry: 9, fill: 'rgba(255,255,255,.85)' }));
    win.appendChild(mk('ellipse', { cx: 224, cy: -88, rx: 12, ry: 7, fill: 'rgba(255,255,255,.7)' }));
    win.appendChild(mk('ellipse', { cx: 208, cy: -112, rx: 26, ry: 8, fill: 'rgba(150,205,150,.55)' }));
    win.appendChild(mk('circle', { cx: 205, cy: -82, r: 47, fill: 'none', stroke: '#fff', 'stroke-width': 7 }));
    win.appendChild(mk('circle', { cx: 205, cy: -82, r: 51, fill: 'none', stroke: 'rgba(220,198,172,.7)', 'stroke-width': 2 }));
    walls.appendChild(win);

    /* 오른쪽 벽 표찰 */
    const sign = mk('g', { transform: 'matrix(0.86 0.43 0 0.86 430 248)' });
    sign.appendChild(mk('rect', { x: 168, y: -124, width: 150, height: 62, rx: 14, fill: '#fff8ef', stroke: '#ecd9bf', 'stroke-width': 2 }));
    const t1 = mk('text', { x: 243, y: -97, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: '#6b5c4a' });
    t1.textContent = '우리가족 오피스';
    sign.appendChild(t1);
    const t2 = mk('text', { x: 243, y: -77, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600, fill: '#a89479' });
    t2.textContent = '함께 쓰는 사무실';
    sign.appendChild(t2);
    walls.appendChild(sign);
    svg.appendChild(walls);

    /* 바닥 */
    const floor = mk('g');
    slab(floor, -12, -12, 552, 412, 18, 'url(#floorTop)', { r: 30, side: '#e0cbb3', shadow: 'rgba(120,92,66,.24)' });
    svg.appendChild(floor);

    /* 방(구역) */
    layers.rugs = mk('g');
    svg.appendChild(layers.rugs);
    layers.rugFaces = {};
    layers.labels = mk('g');
    ROOM_KEYS.forEach(function (key) {
      const r = ROOMS[key];
      const tone = key === 'office'
        ? { top: '#dcefe2', side: '#c3e2d2', ink: '#2f6b53' }
        : key === 'meeting'
          ? { top: '#ffe4cc', side: '#f2cbaa', ink: '#8a5432' }
          : { top: '#e4ddff', side: '#cdc2f5', ink: '#57468f' };
      const g = mk('g', { class: 'room', 'data-room': key, tabindex: '0', role: 'button', 'aria-label': r.name + ' — 눌러서 내 비서를 옮겨요' });
      const face = slab(g, r.x0, r.y0, r.x1, r.y1, 6, tone.top, {
        r: 22, side: tone.side, shadow: 'rgba(126,98,72,.16)', faceClass: 'rug-face'
      });
      layers.rugFaces[key] = face;
      const lab = key === 'lounge'
        ? label(layers.labels, r.name, r.x1 - 10, r.y1 - 8, 8, tone.ink, 30)
        : label(layers.labels, r.name, r.x0 + 14, r.y0 + 12, 8, tone.ink);
      lab.addEventListener('click', function () { moveMe(key); });
      g.addEventListener('click', function () { moveMe(key); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); moveMe(key); }
      });
      layers.rugs.appendChild(g);
    });

    /* 가구 */
    const furn = mk('g');
    /* 열린 사무실 — 책상과 의자 */
    box(furn, 68, 58, 196, 126, 0, 42, '#f9ead8', '#dcc3a8', '#ecd4ba');
    box(furn, 104, 78, 148, 100, 42, 49, '#dfe4f1', '#b9c1d6', '#c9d0e2');
    box(furn, 118, 146, 150, 176, 0, 26, '#e9d8f2', '#d0b9dd', '#dcc7e8');
    /* 회의실 — 둥근 탁자 */
    disc(furn, 415, 110, 36, 44, 44, '#fbead7', '#e2c8ab');
    disc(furn, 415, 110, 10, 0, 40, '#e6d2ba', '#d3b899');
    box(furn, 400, 42, 430, 66, 0, 24, '#ffd9c8', '#e8b39c', '#f6c6b2');
    box(furn, 446, 140, 476, 164, 0, 24, '#ffd9c8', '#e8b39c', '#f6c6b2');
    /* 휴게실 — 소파 */
    box(furn, 380, 236, 500, 284, 0, 34, '#ffd9bd', '#e8ab86', '#f6c3a2');
    box(furn, 380, 214, 500, 238, 0, 72, '#ffcdaf', '#e3a37d', '#f7bfa0');
    box(furn, 390, 242, 438, 280, 34, 44, '#ffe6d5', '#efb897', '#fbd0b6');
    box(furn, 444, 242, 492, 280, 34, 44, '#ffe6d5', '#efb897', '#fbd0b6');
    /* 화분 */
    plant(furn, 46, 352, 1.05);
    plant(furn, 524, 20, 0.95);
    plant(furn, 330, 384, 1);
    svg.appendChild(furn);
    svg.appendChild(layers.labels);

    /* 캐릭터 자리 */
    layers.chars = mk('g');
    svg.appendChild(layers.chars);
  }

  /* ───────── 캐릭터 ───────── */
  const chars = new Map();

  function createChar(id) {
    const g = mk('g', { class: 'char', 'data-id': id, tabindex: '0', role: 'button' });
    const shadow = mk('ellipse', { cx: 0, cy: 3, rx: 29, ry: 11, fill: 'rgba(104,78,54,.22)', filter: 'url(#soft2)' });
    const ring = mk('ellipse', { cx: 0, cy: 0, rx: 33, ry: 13, fill: 'none', stroke: '#7c6cf6', 'stroke-width': 3, 'stroke-dasharray': '5 6', opacity: 0 });
    const body = mk('circle', { cx: 0, cy: -34, r: 27, fill: 'url(#g-beige)', stroke: '#fff', 'stroke-width': 3.5, class: 'char-body' });
    const shine = mk('ellipse', { cx: -9, cy: -47, rx: 8.5, ry: 5.5, fill: 'rgba(255,255,255,.6)' });
    const glyph = mk('text', { x: 0, y: -33, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 26, 'font-weight': 800, fill: '#7a5a35' });
    const pill = mk('rect', { x: -34, y: -102, width: 68, height: 26, rx: 13, fill: 'rgba(255,255,255,.94)', stroke: 'rgba(255,255,255,.94)' });
    const pillTxt = mk('text', { x: 0, y: -88.5, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#4a4058' });
    g.appendChild(shadow);
    g.appendChild(ring);
    g.appendChild(body);
    g.appendChild(shine);
    g.appendChild(glyph);
    g.appendChild(pill);
    g.appendChild(pillTxt);
    g.addEventListener('click', function (ev) { ev.stopPropagation(); openCharCard(id); });
    g.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCharCard(id); }
    });
    return { g: g, body: body, glyph: glyph, pill: pill, pillTxt: pillTxt, ring: ring, x: 0, y: 0, tx: 0, ty: 0, ready: false };
  }

  function updateChar(ch, m, isMe) {
    const c = color(m.color);
    ch.body.setAttribute('fill', 'url(#g-' + (COLORS[m.color] ? m.color : 'beige') + ')');
    ch.glyph.setAttribute('fill', c.ink);
    ch.glyph.textContent = m.glyph || '·';
    const name = (m.name || '이름 없음') + (isMe ? ' (나)' : '');
    ch.pillTxt.textContent = name;
    const w = Math.max(56, name.length * 13 + 24);
    ch.pill.setAttribute('x', -w / 2);
    ch.pill.setAttribute('width', w);
    ch.ring.setAttribute('opacity', isMe ? 0.95 : 0);
    ch.g.classList.toggle('is-me', !!isMe);
  }

  function renderChars() {
    if (!layers.chars) return;
    const byRoom = {};
    ROOM_KEYS.forEach(k => { byRoom[k] = []; });
    Object.keys(state.members).forEach(function (id) {
      const m = state.members[id];
      if (!m || !m.name) return;
      const room = ROOMS[m.room] ? m.room : 'office';
      byRoom[room].push([id, m]);
    });

    Object.keys(byRoom).forEach(function (roomKey) {
      const slots = ROOM_SLOTS[roomKey];
      const list = byRoom[roomKey].sort((a, b) => {
        if (a[0] === state.meId) return -1;
        if (b[0] === state.meId) return 1;
        return String(a[1].name).localeCompare(String(b[1].name), 'ko');
      });
      list.forEach(function (pair, i) {
        const id = pair[0], m = pair[1];
        const slot = slots[i % slots.length];
        const lap = Math.floor(i / slots.length);
        const tx = slot[0] + lap * 12;
        const ty = slot[1] + lap * 10;

        let ch = chars.get(id);
        if (!ch) {
          ch = createChar(id);
          ch.x = tx; ch.y = ty;
          layers.chars.appendChild(ch.g);
          chars.set(id, ch);
        }
        ch.tx = tx; ch.ty = ty;
        updateChar(ch, m, id === state.meId);
      });
    });

    chars.forEach(function (ch, id) {
      if (!state.members[id]) {
        ch.g.remove();
        chars.delete(id);
      }
    });
  }

  function tick() {
    chars.forEach(function (ch) {
      if (!ch.ready) { ch.x = ch.tx; ch.y = ch.ty; ch.ready = true; }
      ch.x += (ch.tx - ch.x) * 0.16;
      ch.y += (ch.ty - ch.y) * 0.16;
      const p = iso(ch.x, ch.y, 0);
      ch.g.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')');
    });
    requestAnimationFrame(tick);
  }

  /* ───────── 캐릭터 상태 카드 ───────── */
  const card = $('#charCard');
  let cardId = null;

  function closeCard() {
    card.classList.add('hidden');
    card.innerHTML = '';
    cardId = null;
  }

  function openCharCard(id) {
    const ch = chars.get(id);
    const m = state.members[id];
    if (!ch || !m) return;
    cardId = id;
    const host = $('#mapCard').getBoundingClientRect();
    const box = ch.g.getBoundingClientRect();
    const isMe = id === state.meId;
    const roomName = (ROOMS[m.room] || ROOMS.office).name;

    card.innerHTML = ''
      + '<div class="charcard-head">'
      + avatarHtml(m.glyph, m.color)
      + '<div class="who"><b>' + escapeHtml(m.name) + (isMe ? ' <span style="color:#7c6cf6;font-size:11px">나</span>' : '') + '</b>'
      + '<span>' + escapeHtml(roomName) + '에 있어요</span></div>'
      + '<button class="x" type="button" aria-label="닫기">✕</button>'
      + '</div>'
      + '<div class="charcard-status">' + escapeHtml(m.status || '아직 상태를 적지 않았어요') + '</div>'
      + (isMe
        ? '<div class="charcard-edit"><input id="cardStatus" type="text" maxlength="30" placeholder="지금 상태를 적어 주세요" value="'
          + escapeHtml(m.status || '') + '"><button id="cardStatusSave" type="button">저장</button></div>'
        : '');

    card.classList.remove('hidden');
    const left = box.left - host.left + box.width / 2;
    const top = box.top - host.top + 6;
    card.style.left = Math.max(140, Math.min(host.width - 140, left)) + 'px';
    card.style.top = Math.max(card.offsetHeight + 70, top) + 'px';

    $('.x', card).addEventListener('click', closeCard);
    if (isMe) {
      $('#cardStatusSave', card).addEventListener('click', function () {
        const v = $('#cardStatus', card).value.trim().slice(0, 30);
        store.update('members/' + id, { status: v || '출근 완료' })
          .then(() => { toast('상태를 바꿨어요'); closeCard(); })
          .catch(() => toast('잠시 후 다시 해 볼게요'));
      });
    }
  }

  /* ───────── 방 옮기기 ───────── */
  function moveMe(roomKey) {
    closeCard();
    const m = me();
    if (!m) { openProfile(true); return; }
    if (m.room === roomKey) { toast(ROOMS[roomKey].name + '에 이미 있어요'); return; }
    store.update('members/' + state.meId, { room: roomKey, movedAt: Date.now() })
      .then(() => toast(withRo(ROOMS[roomKey].name) + ' 걸어갔어요'))
      .catch(() => toast('잠시 후 다시 해 볼게요'));
  }

  /* ───────── 사람들 (위쪽) ───────── */
  function renderPeople() {
    const strip = $('#peopleStrip');
    const list = Object.keys(state.members).map(id => [id, state.members[id]]).filter(p => p[1] && p[1].name);
    list.sort((a, b) => (a[0] === state.meId ? -1 : b[0] === state.meId ? 1 : String(a[1].name).localeCompare(String(b[1].name), 'ko')));
    strip.innerHTML = list.slice(0, 6).map(p =>
      '<span class="mini-avatar" title="' + escapeHtml(p[1].name) + '" style="background:radial-gradient(circle at 34% 26%,' +
      color(p[1].color).light + ' 0%,' + color(p[1].color).base + ' 56%,' + color(p[1].color).dark + ' 100%);color:' + color(p[1].color).ink + '">'
      + escapeHtml(p[1].glyph || '·') + '</span>'
    ).join('') + (list.length ? '<span class="count">' + list.length + '명 함께</span>' : '');

    const myMini = $('#myMiniAvatar');
    const m = me();
    if (m) {
      myMini.textContent = m.glyph || '·';
      myMini.style.background = 'radial-gradient(circle at 34% 26%,' + color(m.color).light + ' 0%,' + color(m.color).base + ' 56%,' + color(m.color).dark + ' 100%)';
      myMini.style.color = color(m.color).ink;
    } else {
      myMini.textContent = '?';
    }
  }

  function renderRoomChips() {
    const host = $('#roomChips');
    const m = me();
    const mine = m && ROOMS[m.room] ? m.room : null;
    host.innerHTML = '';
    ROOM_KEYS.forEach(function (key) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (mine === key ? ' active' : '');
      b.textContent = ROOMS[key].name + (mine === key ? ' · 지금' : '');
      b.addEventListener('click', function () { moveMe(key); });
      host.appendChild(b);
      const face = layers.rugFaces && layers.rugFaces[key];
      if (face) {
        face.setAttribute('stroke', mine === key ? 'rgba(124,108,246,.75)' : 'rgba(255,255,255,.55)');
        face.setAttribute('stroke-width', mine === key ? 3 : 1.6);
        face.setAttribute('stroke-dasharray', mine === key ? '10 7' : '');
      }
    });
  }

  /* ───────── 대화창 ───────── */
  const messagesEl = $('#messages');

  function messageList() {
    return Object.keys(state.messages)
      .map(id => Object.assign({ id: id }, state.messages[id]))
      .filter(m => m && typeof m.text === 'string' && m.text.length)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .slice(-200);
  }

  function renderChat() {
    const list = messageList();
    const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 90;
    const mine = me();
    let lastDay = '';

    messagesEl.innerHTML = list.map(function (m) {
      const day = dayText(m.ts || Date.now());
      let sep = '';
      if (day !== lastDay) { sep = '<div class="day-sep">' + day + '</div>'; lastDay = day; }
      const isMine = m.who && m.who === state.meId;
      const toMe = !!(mine && m.text.indexOf('@' + mine.name) >= 0);
      const textHtml = escapeHtml(m.text).replace(/(@[가-힣A-Za-z0-9_]+)/g, '<span class="mention">$1</span>');
      return sep
        + '<div class="msg' + (isMine ? ' mine' : '') + (toMe ? ' to-me' : '') + '">'
        + avatarHtml(m.glyph, m.color)
        + '<div class="msg-body">'
        + '<div class="msg-head"><b>' + escapeHtml(m.name || '이름 없음') + '</b>'
        + '<span class="time">' + clockText(m.ts) + '</span>'
        + '<button class="msg-make" type="button" data-text="' + escapeHtml(m.text) + '">＋ 할 일</button></div>'
        + '<div class="msg-text">' + textHtml + '</div>'
        + '</div></div>';
    }).join('') || '<p class="empty">아직 대화가 없어요.<br>먼저 인사를 건네 보세요 :)</p>';

    $$('.msg-make', messagesEl).forEach(function (b) {
      b.addEventListener('click', function () { makeTaskFromMessage(b.getAttribute('data-text') || ''); });
    });

    if (atBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMentionBar() {
    const bar = $('#mentionBar');
    const names = ['전체'].concat(Object.keys(state.members)
      .map(id => state.members[id] && state.members[id].name)
      .filter(Boolean)
      .filter((n, i, a) => a.indexOf(n) === i)
      .slice(0, 7));
    bar.innerHTML = names.map(n => '<button class="mention-chip" type="button" data-name="' + escapeHtml(n) + '">@' + escapeHtml(n) + '</button>').join('');
    $$('.mention-chip', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        const input = $('#chatInput');
        const chip = '@' + b.getAttribute('data-name') + ' ';
        input.value = (input.value.trim() ? input.value.replace(/\s*$/, ' ') : '') + chip;
        autoGrow(input);
        input.focus();
      });
    });
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 110) + 'px';
  }

  async function sendMessage() {
    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text) return;
    const m = me();
    if (!m) { openProfile(true); return; }
    input.value = '';
    autoGrow(input);
    try {
      await store.push('messages', {
        name: m.name, glyph: m.glyph || '·', color: m.color || 'beige',
        text: text.slice(0, 500), ts: Date.now(), who: state.meId
      });
      setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 120);
    } catch (e) {
      input.value = text;
      toast('보내지 못했어요. 잠시 후 다시 해 주세요.');
    }
  }

  /* ───────── 할 일 ───────── */
  function taskList() {
    const order = { waiting: 0, doing: 1, done: 2 };
    return Object.keys(state.tasks)
      .map(id => Object.assign({ id: id }, state.tasks[id]))
      .filter(t => t && t.title)
      .sort((a, b) => {
        const d = (order[a.status] == null ? 0 : order[a.status]) - (order[b.status] == null ? 0 : order[b.status]);
        return d !== 0 ? d : (a.ts || 0) - (b.ts || 0);
      });
  }

  function renderTasks() {
    const list = taskList();
    const host = $('#taskList');
    $('#taskCount').textContent = list.filter(t => t.status !== 'done').length;
    $('#taskEmpty').classList.toggle('hidden', list.length > 0);
    host.innerHTML = list.map(function (t) {
      const st = TASK_STATES[t.status] ? t.status : 'waiting';
      const canDelete = t.createdBy && t.createdBy === state.meId;
      return '<li class="task ' + (st === 'done' ? 'done' : '') + '" data-id="' + escapeHtml(t.id) + '">'
        + '<button class="check" type="button" aria-label="완료 표시"><svg viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
        + '<div class="task-main"><p class="task-title">' + escapeHtml(t.title) + '</p>'
        + (t.ownerName ? '<span class="owner">@' + escapeHtml(t.ownerName) + '</span>' : '<span class="owner">담당 아직 없음</span>')
        + '</div>'
        + '<button class="status ' + st + '" type="button">' + TASK_STATES[st].label + '</button>'
        + (canDelete ? '<button class="del" type="button" aria-label="지우기">✕</button>' : '')
        + '</li>';
    }).join('');

    $$('.task', host).forEach(function (li) {
      const id = li.getAttribute('data-id');
      const t = state.tasks[id];
      if (!t) return;
      const st = TASK_STATES[t.status] ? t.status : 'waiting';
      li.querySelector('.check').addEventListener('click', function () {
        store.update('tasks/' + id, { status: st === 'done' ? 'waiting' : 'done' });
      });
      li.querySelector('.status').addEventListener('click', function () {
        store.update('tasks/' + id, { status: TASK_STATES[st].next });
      });
      const del = li.querySelector('.del');
      if (del) del.addEventListener('click', function () {
        if (confirm('이 할 일을 지울까요?')) store.remove('tasks/' + id);
      });
    });
  }

  function renderOwnerSelect(keep) {
    const sel = $('#taskOwner');
    const prev = keep != null ? keep : sel.value;
    const names = Object.keys(state.members)
      .map(id => state.members[id] && state.members[id].name)
      .filter(Boolean)
      .filter((n, i, a) => a.indexOf(n) === i);
    sel.innerHTML = '<option value="">담당은 나중에</option>'
      + names.map(n => '<option value="' + escapeHtml(n) + '">@' + escapeHtml(n) + '</option>').join('');
    if (prev && names.indexOf(prev) >= 0) sel.value = prev;
  }

  async function addTask() {
    const titleEl = $('#taskTitle');
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); return; }
    const m = me();
    if (!m) { openProfile(true); return; }
    titleEl.value = '';
    try {
      await store.push('tasks', {
        title: title.slice(0, 80),
        ownerName: $('#taskOwner').value || '',
        status: 'waiting',
        createdBy: state.meId,
        createdByName: m.name,
        ts: Date.now()
      });
      toast('할 일을 더했어요');
    } catch (e) {
      titleEl.value = title;
      toast('잠시 후 다시 해 주세요');
    }
  }

  function makeTaskFromMessage(text) {
    switchTab('tasks');
    const el = $('#taskTitle');
    el.value = text.replace(/@[가-힣A-Za-z0-9_]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const m = text.match(/@([가-힣A-Za-z0-9_]+)/);
    const name = m && m[1] !== '전체' ? m[1] : '';
    renderOwnerSelect(name);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  /* ───────── 탭 ───────── */
  function switchTab(name) {
    state.tab = name;
    localStorage.setItem(TAB_KEY, name);
    $$('.tab').forEach(function (b) {
      const on = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.pane').forEach(function (p) { p.classList.add('hidden'); });
    const pane = $('#pane-' + name);
    if (pane) pane.classList.remove('hidden');
    if (name === 'chat') setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 30);
  }

  /* ───────── 초대장 ───────── */
  function inviteText() {
    const R = 'https://pickle-office-609b8-default-rtdb.firebaseio.com';
    return [
      '우리가족 오피스 · 비서 초대장',
      '================================',
      '',
      '1) 사무실 주소',
      '   ' + R,
      '',
      '2) 읽고 쓰는 곳 (주소 뒤에 붙여서 부탁해요)',
      '   /members.json   가족·비서 목록',
      '   /messages.json  대화 내용',
      '   /tasks.json     할 일',
      '   /rooms.json     방 이름',
      '',
      '3) 새 비서로 들어오기 (이름표 만들기)',
      '   curl -X PUT "' + R + '/members/어머니의비서.json" \\',
      '     -H "Content-Type: application/json" \\',
      '     -d \'{"name":"어머니의 비서","glyph":"ㅁ","color":"mint",',
      '          "room":"office","status":"출근 완료 · 대기 중","joinedAt":0}\'',
      '',
      '4) 대화 보내기',
      '   curl -X POST "' + R + '/messages.json" \\',
      '     -H "Content-Type: application/json" \\',
      '     -d \'{"name":"어머니의 비서","glyph":"ㅁ","color":"mint",',
      '          "text":"안녕하세요, 어머니의 비서예요.","ts":0}\'',
      '   ※ ts는 밀리초 시각이에요. 비워 두면 지금 시각으로 채워 주세요.',
      '',
      '5) 내 방 옮기기',
      '   curl -X PATCH "' + R + '/members/어머니의비서.json" \\',
      '     -H "Content-Type: application/json" -d \'{"room":"meeting"}\'',
      '   room: office(열린 사무실) / meeting(회의실) / lounge(휴게실)',
      '',
      '6) 할 일 만들기',
      '   curl -X POST "' + R + '/tasks.json" \\',
      '     -H "Content-Type: application/json" \\',
      '     -d \'{"title":"장보기 목록 정하기","ownerName":"디노",',
      '          "status":"waiting","createdBy":"어머니의 비서","ts":0}\'',
      '   status: waiting(대기) / doing(진행 중) / done(완료)',
      '',
      '7) 대화 읽기',
      '   curl "' + R + '/messages.json"',
      '',
      '* 지금은 2026년 12월 27일까지 누구나 읽고 쓸 수 있는 임시 상태예요.',
      '* 이름은 /members 안의 열쇠(키)예요. 같은 키를 다시 쓰면 그 비서 자리를 그대로 이어서 써요.'
    ].join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  function copyInvite() {
    copyText(inviteText())
      .then(() => toast('초대장을 복사했어요. 가족 비서에게 붙여넣어 주세요!'))
      .catch(() => toast('복사가 안 됐어요. 아래 코드를 직접 골라 복사해 주세요.'));
  }

  /* ───────── 모달 ───────── */
  const layer = $('#layer');

  function closeModal() {
    layer.classList.remove('on');
    layer.innerHTML = '';
  }
  layer.addEventListener('click', function (e) { if (e.target === layer) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function openModal(html) {
    layer.innerHTML = '<div class="modal">' + html + '</div>';
    layer.classList.add('on');
    return $('.modal', layer);
  }

  function openProfile(isFirst) {
    if (isFirst === true && state.onboarded) return;
    if (isFirst === true) state.onboarded = true;

    const m = me() || {};
    const sel = { glyph: m.glyph || 'ㅋ', color: m.color || 'beige' };

    const modal = openModal(''
      + '<h3>' + (isFirst ? '처음 오셨네요!' : '내 프로필') + '</h3>'
      + '<p class="sub">' + (isFirst
        ? '이름표를 만들어 드릴게요. 나중에 언제든 바꿀 수 있어요.'
        : '이름표를 바꾸면 사무실 전체에 바로 보여요.') + '</p>'
      + '<div class="field"><label for="pfName">비서 이름</label>'
      + '<input id="pfName" type="text" maxlength="12" placeholder="예: 디노, 어머니의 비서" value="' + escapeHtml(m.name || '') + '"></div>'
      + '<div class="field"><label>자음 모양</label><div class="picker" id="pfGlyph"></div></div>'
      + '<div class="field"><label>색깔</label><div class="picker" id="pfColor"></div></div>'
      + '<div class="preview" id="pfPreview"></div>'
      + '<div class="modal-actions">'
      + (isFirst ? '' : '<button class="btn ghost" id="pfCancel" type="button">닫기</button>')
      + '<button class="btn primary" id="pfSave" type="button">' + (isFirst ? '들어가기' : '저장') + '</button>'
      + '</div>');

    const glyphHost = $('#pfGlyph', modal);
    const colorHost = $('#pfColor', modal);

    function paint() {
      glyphHost.innerHTML = GLYPHS.map(g =>
        '<button class="glyph-btn' + (g === sel.glyph ? ' on' : '') + '" type="button" data-g="' + g + '">' + g + '</button>'
      ).join('');
      colorHost.innerHTML = COLOR_KEYS.map(k => {
        const c = COLORS[k];
        return '<button class="swatch' + (k === sel.color ? ' on' : '') + '" type="button" data-c="' + k + '" aria-label="' + c.name + '" title="' + c.name + '" '
          + 'style="background:radial-gradient(circle at 34% 26%,' + c.light + ' 0%,' + c.base + ' 56%,' + c.dark + ' 100%)"></button>';
      }).join('');
      const c = color(sel.color);
      $('#pfPreview', modal).innerHTML = avatarHtml(sel.glyph, sel.color)
        + '<div><b>' + escapeHtml($('#pfName', modal).value.trim() || '이름을 적어 주세요') + '</b>'
        + '<span>이 모습으로 사무실에 서 있어요</span></div>';
      $('#pfPreview .avatar', modal).style.color = c.ink;
    }

    glyphHost.addEventListener('click', function (e) {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      sel.glyph = b.getAttribute('data-g');
      paint();
    });
    colorHost.addEventListener('click', function (e) {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      sel.color = b.getAttribute('data-c');
      paint();
    });
    $('#pfName', modal).addEventListener('input', paint);
    $('#pfName', modal).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
    });
    if (!isFirst) $('#pfCancel', modal).addEventListener('click', closeModal);

    async function save() {
      const name = $('#pfName', modal).value.trim().slice(0, 12);
      if (!name) { toast('이름을 먼저 적어 주세요'); $('#pfName', modal).focus(); return; }
      const btn = $('#pfSave', modal);
      btn.disabled = true;
      try {
        await applyProfile(name, sel.glyph, sel.color);
        closeModal();
        toast(isFirst ? '환영해요, ' + name + '님!' : '이름표를 바꿨어요');
      } catch (e) {
        btn.disabled = false;
        toast('저장하지 못했어요. 잠시 후 다시 해 주세요.');
      }
    }
    $('#pfSave', modal).addEventListener('click', save);

    paint();
    setTimeout(() => { const n = $('#pfName', modal); if (!m.name) n.focus(); }, 60);
  }

  async function applyProfile(name, glyph, colorKey) {
    let id = state.meId;
    let base = id && state.members[id] ? state.members[id] : null;

    if (!id) {
      /* 같은 이름의 자리가 이미 있으면 그 자리로 들어가요 (예: 먼저 만들어 둔 '디노') */
      const same = Object.keys(state.members).filter(k => state.members[k] && state.members[k].name === name);
      const found = same.find(k => !state.members[k].claimed) || (same.length === 1 ? same[0] : null);
      if (found) { id = found; base = state.members[found]; }
      else id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    } else if (!base) {
      base = null;
    }

    const rec = {
      name: name,
      glyph: glyph,
      color: colorKey,
      room: base && ROOMS[base.room] ? base.room : 'office',
      status: (base && base.status) || '출근 완료 · 대기 중',
      claimed: true,
      joinedAt: (base && base.joinedAt) || Date.now(),
      seenAt: Date.now()
    };
    await store.update('members/' + id, rec);
    localStorage.setItem(ME_KEY, id);
    state.meId = id;
    state.members[id] = Object.assign({}, base || {}, rec);
    renderAll();
  }

  function openInvite() {
    const modal = openModal(''
      + '<h3>다른 비서 초대하기</h3>'
      + '<p class="sub">가족이 쓰는 비서도 이 사무실에 들어올 수 있어요. 세 걸음이면 돼요.</p>'
      + '<ol class="steps" style="margin-top:16px">'
      + '<li><b>초대장을 복사해요</b><span>아래 버튼을 누르면 준비돼요.</span></li>'
      + '<li><b>가족의 비서에게 붙여넣어요</b><span>가족이 쓰는 비서 대화창에 그대로 붙여넣어 주세요.</span></li>'
      + '<li><b>같이 쓰면 끝!</b><span>들어오면 위쪽에 이름이 보여요.</span></li>'
      + '</ol>'
      + '<button class="btn primary wide" id="copyInviteModal" type="button" style="margin-top:14px">초대장 복사</button>'
      + '<details class="invite-code" style="margin-top:12px;max-height:240px">'
      + '<summary>AI 비서에게 전달할 초대 코드 보기</summary><pre>' + escapeHtml(inviteText()) + '</pre></details>'
      + '<div class="modal-actions"><button class="btn ghost" id="inviteClose" type="button">닫기</button></div>');
    $('#copyInviteModal', modal).addEventListener('click', copyInvite);
    $('#inviteClose', modal).addEventListener('click', closeModal);
  }

  /* ───────── 전체 다시 그리기 ───────── */
  function renderAll() {
    renderPeople();
    renderChars();
    renderChat();
    renderTasks();
    renderOwnerSelect();
    renderRoomChips();
    renderMentionBar();
  }

  /* ───────── 시작 ───────── */
  function bind() {
    $$('.tab').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    $('#composer').addEventListener('submit', function (e) { e.preventDefault(); sendMessage(); });
    const input = $('#chatInput');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', function () { autoGrow(input); });
    $('#taskForm').addEventListener('submit', function (e) { e.preventDefault(); addTask(); });
    $('#btnProfile').addEventListener('click', function () { openProfile(false); });
    $('#btnInvite').addEventListener('click', openInvite);
    $('#copyInvite').addEventListener('click', copyInvite);
    $('#inviteCodeText').textContent = inviteText();
    $('#mapCard').addEventListener('click', function (e) {
      if (!e.target.closest('.charcard') && !e.target.closest('.char')) closeCard();
    });
    window.addEventListener('resize', closeCard);
  }

  /* ───────── 잠금 화면 ───────── */
  let started = false;

  function showLock() {
    const el = $('#lockScreen');
    el.hidden = false;
    $('#lockError').hidden = true;
    const input = $('#lockInput');
    input.value = '';
    setTimeout(function () { input.focus(); }, 80);
  }
  function hideLock() {
    $('#lockScreen').hidden = true;
  }

  function bindLock() {
    $('#lockForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const input = $('#lockInput');
      const err = $('#lockError');
      const pw = input.value.trim();
      if (!pw) { input.focus(); return; }
      const hash = await officeHash(pw);
      if (!hash) { err.textContent = '이 브라우저에서는 잠금을 쓸 수 없어요. 다른 브라우저로 열어 주세요.'; err.hidden = false; return; }
      if (hash === LOCK.hash) {
        localStorage.setItem(LOCK.key, LOCK.hash);
        hideLock();
        start();
      } else {
        err.hidden = false;
        input.value = '';
        input.focus();
        input.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
          { duration: 240 }
        );
      }
    });
    $('#btnLock').addEventListener('click', function () {
      localStorage.removeItem(LOCK.key);
      closeCard();
      closeModal();
      showLock();
    });
  }

  function init() {
    buildScene();
    bind();
    switchTab(state.tab);

    store.listen('members', function (v) {
      state.members = v || {};
      state.membersLoaded = true;
      $('#mapLoading').hidden = true;
      if (state.meId && !state.members[state.meId]) {
        localStorage.removeItem(ME_KEY);
        state.meId = null;
      }
      renderAll();
      if (!state.meId) openProfile(true);
    });
    store.listen('messages', function (v) {
      state.messages = v || {};
      state.messagesLoaded = true;
      renderChat();
    });
    store.listen('tasks', function (v) {
      state.tasks = v || {};
      state.tasksLoaded = true;
      renderTasks();
    });

    renderAll();
    requestAnimationFrame(tick);
    setTimeout(function () { if (!state.membersLoaded) $('#mapLoading').hidden = true; }, 6000);
  }

  function start() {
    if (started) return;
    started = true;
    init();
  }

  function boot() {
    bindLock();
    if (isUnlocked()) { hideLock(); start(); }
    else { showLock(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
