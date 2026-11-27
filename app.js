/* 우리가족 오피스 — app.js
   3D 클레이 오피스 그림 위에 가족 비서들이 서 있어요.
   방을 누르면 내 비서가 그 방으로 걸어가고, 비서를 누르면 지금 상태가 보여요. */
(function () {
  'use strict';

  /* ───────── 기본 정보 ───────── */
  const DB_URL = 'https://pickle-office-609b8-default-rtdb.firebaseio.com';
  const ME_KEY = 'woori-office-me';
  const TAB_KEY = 'woori-office-tab';
  const SCENE_AR = 1536 / 1024;

  const ROOMS = {
    office:  { name: '열린 사무실' },
    meeting: { name: '회의실' },
    lounge:  { name: '휴게실' }
  };
  const ROOM_KEYS = Object.keys(ROOMS);

  /* 방 안에서 서는 자리 — 그림 위 좌표(%), 그림 높이에 대한 키 비율(h) */
  const ROOM_SLOTS = {
    office: [
      { x: 41.5, y: 67.5, h: 0.252 },
      { x: 34.5, y: 69.5, h: 0.256 },
      { x: 47.0, y: 58.0, h: 0.238 },
      { x: 29.0, y: 73.0, h: 0.258 }
    ],
    meeting: [
      { x: 48.8, y: 54.5, h: 0.240 },
      { x: 57.4, y: 55.5, h: 0.245 },
      { x: 63.6, y: 52.0, h: 0.235 },
      { x: 47.8, y: 47.5, h: 0.228 }
    ],
    lounge: [
      { x: 65.5, y: 73.0, h: 0.255 },
      { x: 72.6, y: 75.0, h: 0.265 },
      { x: 82.0, y: 69.0, h: 0.250 },
      { x: 87.5, y: 76.5, h: 0.262 }
    ]
  };

  /* 비서 얼굴(3D 클레이) */
  const AVATARS = {
    dino:   { src: 'assets/char-dino.png?v=2',   scale: 0.84, label: '동글 로봇' },
    mom:    { src: 'assets/char-mom.png?v=2',    scale: 1,    label: '다정한 어른' },
    guest1: { src: 'assets/char-guest1.png?v=2', scale: 1,    label: '분홍 머리' },
    guest2: { src: 'assets/char-guest2.png?v=2', scale: 1,    label: '파란 후드' }
  };
  const AVATAR_KEYS = Object.keys(AVATARS);

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

  /* ───────── 가족 입장 암호 ─────────
     암호를 바꾸려면 브라우저 개발자 도구 콘솔에서 아래 한 줄을 실행해 나온 값을 LOCK.hash 에 넣으면 돼요.
       await officeHash('새암호')
     암호 자체는 이 파일에 적지 않아요(해시만 둡니다). */
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

  /* ───────── 비서 얼굴 고르기 ─────────
     고른 얼굴이 있으면 그것을, 없으면 이름이 맞는 얼굴을, 나머지는 겹치지 않게 차례로 나눠 줘요. */
  const avatarCache = new Map();

  function pickAvatar(name, id) {
    const s = String(name == null ? '' : name) + '|' + String(id == null ? '' : id);
    if (/디노|dino/i.test(s)) return 'dino';
    if (/엄마|어머니|맘|mom/i.test(s)) return 'mom';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return AVATAR_KEYS[h % AVATAR_KEYS.length];
  }

  function rebuildAvatars() {
    avatarCache.clear();
    const ids = Object.keys(state.members).filter(id => state.members[id] && state.members[id].name);
    ids.forEach(function (id) {
      const a = state.members[id].avatar;
      if (AVATARS[a]) avatarCache.set(id, a);
    });
    const used = new Set(avatarCache.values());

    ids.forEach(function (id) {
      if (avatarCache.has(id)) return;
      const n = String(state.members[id].name);
      let want = null;
      if (/디노|dino/i.test(n)) want = 'dino';
      else if (/엄마|어머니|맘|mom/i.test(n)) want = 'mom';
      if (want && !used.has(want)) { avatarCache.set(id, want); used.add(want); }
    });

    const rest = ids.filter(id => !avatarCache.has(id)).sort(function (a, b) {
      return (state.members[a].joinedAt || 0) - (state.members[b].joinedAt || 0);
    });
    const pool = AVATAR_KEYS.filter(k => !used.has(k));
    rest.forEach(function (id) {
      const key = pool.length ? pool.shift() : pickAvatar(state.members[id].name, id);
      avatarCache.set(id, key);
    });
  }

  function avatarKey(m, id) {
    if (m && AVATARS[m.avatar]) return m.avatar;
    if (id && avatarCache.has(id)) return avatarCache.get(id);
    return pickAvatar(m && m.name, id);
  }
  function avatarSrc(m, id) { return AVATARS[avatarKey(m, id)].src; }
  function avatarHtml(m, id, extraClass) {
    return '<span class="avatar ' + (extraClass || '') + '"><img src="' + avatarSrc(m, id) +
      '" alt="" aria-hidden="true" loading="lazy"></span>';
  }
  function faceHtml(key, extraClass) {
    return '<span class="avatar ' + (extraClass || '') + '"><img src="' + AVATARS[key].src +
      '" alt="" aria-hidden="true"></span>';
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

  /* ───────── 오피스 무대 ───────── */
  const stage = {
    scene: $('#scene'),
    actors: $('#actors'),
    els: new Map(),
    ready: false
  };

  function fitScene() {
    if (!stage.scene) return;
    const wrap = $('#sceneWrap');
    const r = wrap.getBoundingClientRect();
    const cs = getComputedStyle(wrap);
    const availW = Math.max(0, r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const availH = Math.max(0, r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    if (!availW) return;
    let w = availW;
    let h = w / SCENE_AR;
    if (availH && h > availH) { h = availH; w = h * SCENE_AR; }
    stage.scene.style.width = Math.round(w) + 'px';
    stage.scene.style.height = Math.round(h) + 'px';
    stage.ready = true;
    renderChars();
    closeCard();
  }

  function actorEl(id) {
    let el = stage.els.get(id);
    if (el) return el;
    el = document.createElement('button');
    el.type = 'button';
    el.className = 'actor';
    el.innerHTML = '<span class="actor-shadow"></span><img alt=""><span class="actor-tag"></span>';
    el.addEventListener('click', function (ev) { ev.stopPropagation(); openCharCard(id); });
    stage.actors.appendChild(el);
    stage.els.set(id, el);
    return el;
  }

  function renderChars() {
    if (!stage.ready) return;
    const sceneH = stage.scene.clientHeight || 1;
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
      const list = byRoom[roomKey].sort(function (a, b) {
        if (a[0] === state.meId) return -1;
        if (b[0] === state.meId) return 1;
        return String(a[1].name).localeCompare(String(b[1].name), 'ko');
      });
      list.forEach(function (pair, i) {
        const id = pair[0], m = pair[1];
        const slot = slots[i % slots.length];
        const lap = Math.floor(i / slots.length);
        const x = slot.x + lap * 2.4;
        const y = slot.y + lap * 1.6;

        const el = actorEl(id);
        const key = avatarKey(m, id);
        const av = AVATARS[key];
        const hpx = Math.round(sceneH * slot.h * av.scale);

        el.style.left = x.toFixed(2) + '%';
        el.style.top = y.toFixed(2) + '%';
        el.style.zIndex = String(Math.round(y * 10));
        el.style.setProperty('--h', hpx + 'px');

        const img = el.querySelector('img');
        const src = av.src;
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
        img.alt = m.name;

        const isMe = id === state.meId;
        el.classList.toggle('is-me', isMe);
        const tag = el.querySelector('.actor-tag');
        tag.innerHTML = escapeHtml(m.name) + (isMe ? '<i>나</i>' : '');
        el.setAttribute('aria-label', m.name + ' — 지금 상태 보기');
        el.dataset.room = roomKey;
      });
    });

    stage.els.forEach(function (el, id) {
      if (!state.members[id]) {
        el.remove();
        stage.els.delete(id);
      }
    });
  }

  function animateWalk(id, fromRoom, toRoom) {
    const el = stage.els.get(id);
    if (!el || fromRoom === toRoom) return;
    el.classList.add('walking');
    setTimeout(function () { el.classList.remove('walking'); }, 1000);
    setTimeout(function () {
      el.classList.add('just-moved');
      setTimeout(function () { el.classList.remove('just-moved'); }, 520);
    }, 900);
  }

  /* ───────── 비서 상태 카드 ───────── */
  const card = $('#charCard');
  let cardId = null;

  function closeCard() {
    card.classList.add('hidden');
    card.innerHTML = '';
    cardId = null;
  }

  function openCharCard(id) {
    const el = stage.els.get(id);
    const m = state.members[id];
    if (!el || !m) return;
    cardId = id;
    const host = $('#mapCard').getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const isMe = id === state.meId;
    const roomName = (ROOMS[m.room] || ROOMS.office).name;

    card.innerHTML = ''
      + '<div class="charcard-head">'
      + avatarHtml(m, id)
      + '<div class="who"><b>' + escapeHtml(m.name) + (isMe ? ' <span style="color:#7c6cf6;font-size:11px">나</span>' : '') + '</b>'
      + '<span>' + escapeHtml(roomName) + '에 있어요</span></div>'
      + '<button class="x" type="button" aria-label="닫기">✕</button>'
      + '</div>'
      + '<div class="charcard-status">' + escapeHtml(m.status || '아직 상태를 적지 않았어요') + '</div>'
      + (isMe
        ? '<div class="charcard-edit"><input id="cardStatus" type="text" maxlength="30" placeholder="지금 상태를 적어 주세요" value="'
          + escapeHtml(m.status || '') + '"><button id="cardStatusSave" type="button">저장</button></div>'
          + '<div class="charcard-links"><button id="cardRename" type="button">이름 바꾸기</button></div>'
        : '');

    card.classList.remove('hidden');

    // 카드 폭을 먼저 알아야 자리를 잡을 수 있어요
    const cw = card.offsetWidth;
    const chh = card.offsetHeight;
    const hostW = host.width;
    let left = box.left - host.left + box.width / 2;
    left = Math.max(cw / 2 + 10, Math.min(hostW - cw / 2 - 10, left));
    let top = box.top - host.top - 8;
    if (top - chh < 8) top = box.bottom - host.top + chh + 8;
    card.style.left = left + 'px';
    card.style.top = top + 'px';

    $('.x', card).addEventListener('click', closeCard);
    if (isMe) {
      $('#cardRename', card).addEventListener('click', function () { closeCard(); openProfile(false); });
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
    const before = m.room;
    store.update('members/' + state.meId, { room: roomKey, movedAt: Date.now() })
      .then(() => {
        animateWalk(state.meId, before, roomKey);
        toast(withRo(ROOMS[roomKey].name) + ' 걸어갔어요');
      })
      .catch(() => toast('잠시 후 다시 해 볼게요'));
  }

  /* ───────── 사람들 (위쪽) ───────── */
  function renderPeople() {
    const strip = $('#peopleStrip');
    const list = Object.keys(state.members).map(id => [id, state.members[id]]).filter(p => p[1] && p[1].name);
    list.sort((a, b) => (a[0] === state.meId ? -1 : b[0] === state.meId ? 1 : String(a[1].name).localeCompare(String(b[1].name), 'ko')));
    strip.innerHTML = list.slice(0, 6).map(p =>
      '<span class="mini-avatar" title="' + escapeHtml(p[1].name) + '"><img src="' +
      avatarSrc(p[1], p[0]) + '" alt=""></span>'
    ).join('') + (list.length ? '<span class="count">' + list.length + '명 함께</span>' : '');

    const myMini = $('#myMiniAvatar');
    const m = me();
    if (m) {
      myMini.innerHTML = '<img src="' + avatarSrc(m, state.meId) + '" alt="">';
    } else {
      myMini.innerHTML = '';
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
    });
    $$('.zone').forEach(function (z) {
      z.classList.toggle('on', mine === z.getAttribute('data-room'));
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
      const writer = m.who && state.members[m.who] ? state.members[m.who] : null;
      const av = (m.avatar && AVATARS[m.avatar])
        ? faceHtml(m.avatar)
        : (writer ? avatarHtml(writer, m.who) : faceHtml(pickAvatar(m.name, m.who)));
      return sep
        + '<div class="msg' + (isMine ? ' mine' : '') + (toMe ? ' to-me' : '') + '">'
        + av
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
        name: m.name, glyph: m.glyph || '·', color: m.color || 'beige', avatar: avatarKey(m, state.meId),
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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeCard(); } });

  function openModal(html) {
    layer.innerHTML = '<div class="modal">' + html + '</div>';
    layer.classList.add('on');
    return $('.modal', layer);
  }

  function seatList() {
    return Object.keys(state.members)
      .filter(id => state.members[id] && state.members[id].name)
      .map(id => ({ id: id, m: state.members[id] }))
      .sort(function (a, b) { return (a.m.joinedAt || 0) - (b.m.joinedAt || 0); });
  }

  function openProfile(isFirst) {
    if (isFirst === true && state.onboarded) return;
    if (isFirst === true) state.onboarded = true;

    const m = me() || {};
    const seats = seatList();
    const mineSeat = state.meId && state.members[state.meId] ? state.meId : null;
    const sel = {
      seat: mineSeat,
      avatar: m.avatar && AVATARS[m.avatar] ? m.avatar : pickAvatar(m.name, state.meId),
      color: m.color || 'beige'
    };
    const startName = mineSeat ? state.members[mineSeat].name : (m.name || '');

    const modal = openModal(''
      + '<h3>' + (isFirst ? '어느 자리로 들어갈까요?' : '내 프로필') + '</h3>'
      + '<p class="sub">' + (isFirst
        ? (seats.length
          ? '이미 사무실에 있는 자리를 그대로 이어 쓰거나, 새 자리를 만들 수 있어요.'
          : '사무실에 세울 내 모습을 골라 주세요. 나중에 언제든 바꿀 수 있어요.')
        : '이름·얼굴·이름표 색을 바꾸면 사무실에 바로 보여요.') + '</p>'
      + (seats.length
        ? '<div class="field"><label>내 자리</label><div class="picker seats" id="pfSeat"></div>'
          + '<p class="field-hint" id="pfSeatHint">이미 있는 자리를 고르면 새로 만들지 않고 그 자리 이름만 바뀌어요.</p></div>'
        : '')
      + '<div class="field"><label for="pfName">비서 이름</label>'
      + '<input id="pfName" type="text" maxlength="12" placeholder="예: 세비, 호우" value="' + escapeHtml(startName) + '"></div>'
      + '<div class="field"><label>내 모습</label><div class="picker" id="pfFace"></div></div>'
      + '<div class="field"><label>이름표 색</label><div class="picker" id="pfColor"></div></div>'
      + '<div class="preview" id="pfPreview"></div>'
      + '<div class="modal-actions">'
      + '<button class="btn ghost" id="pfCancel" type="button">' + (isFirst ? '나중에 할게요' : '닫기') + '</button>'
      + '<button class="btn primary" id="pfSave" type="button">' + (isFirst ? '이 자리로 들어가기' : '저장') + '</button>'
      + '</div>');

    const faceHost = $('#pfFace', modal);
    const colorHost = $('#pfColor', modal);
    const seatHost = $('#pfSeat', modal);

    function paintSeats() {
      if (!seatHost) return;
      seatHost.innerHTML = seats.map(function (s) {
        const roomName = (ROOMS[s.m.room] || ROOMS.office).name;
        return '<button class="seat-btn' + (sel.seat === s.id ? ' on' : '') + '" type="button" data-seat="' + escapeHtml(s.id) + '">'
          + '<span class="avatar"><img src="' + avatarSrc(s.m, s.id) + '" alt=""></span>'
          + '<span class="seat-txt"><b>' + escapeHtml(s.m.name) + '</b>'
          + '<i>' + escapeHtml(roomName) + (s.id === mineSeat ? ' · 지금 내 자리' : '') + '</i></span>'
          + '</button>';
      }).join('')
        + '<button class="seat-btn new' + (sel.seat === null ? ' on' : '') + '" type="button" data-seat="">'
        + '<span class="seat-plus">＋</span>'
        + '<span class="seat-txt"><b>새 자리</b><i>새로 만들기</i></span></button>';
    }

    function paint() {
      paintSeats();
      faceHost.innerHTML = AVATAR_KEYS.map(k =>
        '<button class="face-btn' + (k === sel.avatar ? ' on' : '') + '" type="button" data-a="' + k + '" aria-label="' + AVATARS[k].label + '" title="' + AVATARS[k].label + '">'
        + '<img src="' + AVATARS[k].src + '" alt=""></button>'
      ).join('');
      colorHost.innerHTML = COLOR_KEYS.map(k => {
        const c = COLORS[k];
        return '<button class="swatch' + (k === sel.color ? ' on' : '') + '" type="button" data-c="' + k + '" aria-label="' + c.name + '" title="' + c.name + '" '
          + 'style="background:radial-gradient(circle at 34% 26%,' + c.light + ' 0%,' + c.base + ' 56%,' + c.dark + ' 100%)"></button>';
      }).join('');
      const isRename = !!(sel.seat && state.members[sel.seat] && state.members[sel.seat].name !== $('#pfName', modal).value.trim());
      $('#pfPreview', modal).innerHTML = faceHtml(sel.avatar)
        + '<div><b>' + escapeHtml($('#pfName', modal).value.trim() || '이름을 적어 주세요') + '</b>'
        + '<span>' + (sel.seat
          ? (isRename ? '이 자리의 이름이 이렇게 바뀌어요' : '지금 쓰고 있는 자리예요')
          : '새 자리로 사무실에 서요') + '</span></div>';
    }

    if (seatHost) {
      seatHost.addEventListener('click', function (e) {
        const b = e.target.closest('[data-seat]');
        if (!b) return;
        const id = b.getAttribute('data-seat');
        sel.seat = id || null;
        const input = $('#pfName', modal);
        if (id && state.members[id]) {
          const sm = state.members[id];
          sel.avatar = avatarKey(sm, id);
          sel.color = sm.color || sel.color;
          input.value = sm.name || '';
        }
        paint();
      });
    }
    faceHost.addEventListener('click', function (e) {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      sel.avatar = b.getAttribute('data-a');
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
    $('#pfCancel', modal).addEventListener('click', closeModal);

    async function save() {
      const name = $('#pfName', modal).value.trim().slice(0, 12);
      if (!name) { toast('이름을 먼저 적어 주세요'); $('#pfName', modal).focus(); return; }
      const btn = $('#pfSave', modal);
      btn.disabled = true;
      try {
        const renamed = await applyProfile(name, sel.avatar, sel.color, sel.seat);
        closeModal();
        toast(renamed ? '이름을 \'' + name + '\'으로 바꿨어요' : (isFirst ? '환영해요, ' + name + '님!' : '이름표를 바꿨어요'));
      } catch (e) {
        btn.disabled = false;
        toast('저장하지 못했어요. 잠시 후 다시 해 주세요.');
      }
    }
    $('#pfSave', modal).addEventListener('click', save);

    paint();
    setTimeout(() => { const n = $('#pfName', modal); if (!startName) n.focus(); }, 60);
  }

  /* 고른 자리가 있으면 그 키의 이름만 바꾸고, 없으면 같은 이름의 자리를 찾아 이어 쓰고,
     그래도 없을 때만 새 키를 만들어요 — 한 사람당 자리 하나. */
  async function applyProfile(name, avatar, colorKey, seatId) {
    let id = null;
    let base = null;

    if (seatId && state.members[seatId]) {
      id = seatId;
      base = state.members[seatId];
    } else if (state.meId && state.members[state.meId]) {
      id = state.meId;
      base = state.members[state.meId];
    } else {
      /* 같은 이름의 자리가 이미 있으면 그 자리로 들어가요 */
      const same = Object.keys(state.members).filter(k => state.members[k] && state.members[k].name === name);
      const found = same.find(k => !state.members[k].claimed) || (same.length === 1 ? same[0] : null);
      if (found) { id = found; base = state.members[found]; }
      else id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    }

    const renamed = !!(base && base.name && base.name !== name);
    const rec = {
      name: name,
      avatar: avatar,
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
    return renamed;
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
    rebuildAvatars();
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
    $$('.zone').forEach(function (z) {
      z.addEventListener('click', function () { moveMe(z.getAttribute('data-room')); });
    });
    $('#mapCard').addEventListener('click', function (e) {
      if (!e.target.closest('.charcard') && !e.target.closest('.actor')) closeCard();
    });
    window.addEventListener('resize', function () { fitScene(); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { fitScene(); }).observe($('#sceneWrap'));
    }
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
    bind();
    switchTab(state.tab);
    fitScene();

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
