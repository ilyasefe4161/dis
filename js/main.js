/* ============================================================
   GÜNSOY — etkileşim motoru
   ============================================================ */

/* ---- klinikten teyit alınacak tek yer: çalışma saatleri ---- */
const HOURS = {
  1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19],  // pazartesi–cuma
  6: [9, 14],                                                   // cumartesi
  0: null                                                       // pazar kapalı
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse  = matchMedia('(pointer: coarse)').matches;

/* kare hızından bağımsız yumuşatma */
const sK = (base, dt) => Math.min(1, 1 - Math.pow(1 - base, dt / 16.67));

const ticks = [];

/* ============================================================
   1. AKIŞKAN SCROLL
   Gerçek scroll pozisyonunu yumuşatıyoruz (transform değil),
   böylece position:sticky olduğu gibi çalışıyor.
   ============================================================ */

class Smooth {
  constructor() {
    this.on = !coarse && !reduced;
    this.target = this.cur = this.last = window.scrollY;
    if (!this.on) return;

    document.documentElement.classList.add('lenis');
    addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      this.target = clamp(this.target + (e.deltaMode === 1 ? e.deltaY * 18 : e.deltaY), 0, this.max);
    }, { passive: false });
  }

  get max() { return Math.max(0, document.documentElement.scrollHeight - innerHeight); }

  to(y) {
    if (!this.on) { scrollTo({ top: y, behavior: 'smooth' }); return; }
    this.target = clamp(y, 0, this.max);
  }

  tick(dt) {
    if (!this.on) { this.last = window.scrollY; return; }
    // klavye / scrollbar / sayfa içi arama dışarıdan kaydırdıysa senkronla
    if (Math.abs(window.scrollY - this.last) > 2) this.target = this.cur = window.scrollY;

    this.target = clamp(this.target, 0, this.max);
    this.cur = lerp(this.cur, this.target, sK(0.11, dt));
    if (Math.abs(this.cur - this.target) < 0.2) this.cur = this.target;
    if (Math.abs(this.cur - window.scrollY) > 0.05) scrollTo(0, this.cur);
    this.last = window.scrollY;
  }
}
const smooth = new Smooth();

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const t = $(id);
    if (!t) return;
    e.preventDefault();
    smooth.to(t.getBoundingClientRect().top + window.scrollY);
  });
});

/* ============================================================
   2. SCROLL İLE SÜRÜKLENEN VİDEO
   ============================================================ */

class Scrub {
  constructor(video, opts = {}) {
    this.v = video;
    this.scope = opts.scope;
    this.onTick = opts.onTick || null;
    this.measureFn = opts.measure || null;
    this.ready = false; this.seeking = false; this.seekAt = 0;
    this.visible = false; this.dur = 0; this.p = 0; this.sm = 0;

    video.muted = true; video.playsInline = true; video.pause();

    const ready = () => {
      if (this.ready) return;
      this.dur = video.duration || 8;
      this.ready = true;
      this.seek(this.sm, true);
    };
    if (video.readyState >= 2) ready();
    video.addEventListener('loadeddata', ready, { once: true });
    video.addEventListener('canplay', ready, { once: true });
    video.addEventListener('seeked', () => { this.seeking = false; });

    // iOS: ilk dokunuşa kadar seek kilitli kalıyor
    const unlock = () => video.play().then(() => video.pause()).catch(() => {});
    addEventListener('touchstart', unlock, { once: true, passive: true });
    addEventListener('pointerdown', unlock, { once: true });

    new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; },
      { rootMargin: '25% 0px' }).observe(this.scope);
  }

  measure() {
    if (this.measureFn) { this.p = this.measureFn(); return; }
    const r = this.scope.getBoundingClientRect();
    const total = this.scope.offsetHeight - innerHeight;
    this.p = total > 0 ? clamp(-r.top / total) : clamp(-r.top / this.scope.offsetHeight);
  }

  seek(p, force = false) {
    if (!this.ready) return;
    const frame = Math.min(this.dur - 0.001, Math.round(p * this.dur * 24) / 24);
    if (Math.abs(this.v.currentTime - frame) < 1 / 48) { this.seeking = false; return; }
    const now = performance.now();
    // aynı kareye seek'te bazı tarayıcılar "seeked" atmıyor → zaman aşımıyla aç
    if (this.seeking && !force && now - this.seekAt < 140) return;
    this.seeking = true; this.seekAt = now;
    try { this.v.currentTime = frame; } catch (_) { this.seeking = false; }
  }

  tick(dt) {
    if (!this.visible) return;
    this.measure();
    this.sm = lerp(this.sm, this.p, reduced ? 1 : sK(0.2, dt));
    if (Math.abs(this.sm - this.p) < 0.0004) this.sm = this.p;
    this.seek(this.sm);
    this.scope.style.setProperty('--p', this.sm.toFixed(4));
    if (this.onTick) this.onTick(this.sm);
  }
}

/* --- pinlenen sahneler --- */
$$('[data-sc]').forEach((sec) => {
  const v = $('[data-scrub]', sec);
  if (!v) return;
  const steps  = $$('[data-step]', sec);
  const shades = $$('[data-shade]', sec);
  const pct    = $('[data-pctv]', sec);
  const hots   = $('[data-hotlayer]', sec);

  ticks.push(new Scrub(v, {
    scope: sec,
    onTick(p) {
      if (steps.length) {
        const i = Math.min(steps.length - 1, Math.floor(p * steps.length * 1.1));
        steps.forEach((s, k) => s.classList.toggle('on', k <= i));
      }
      if (shades.length) {
        const i = Math.round(p * (shades.length - 1));
        shades.forEach((s, k) => s.classList.toggle('on', k === i));
      }
      if (pct) pct.textContent = Math.round(p * 100) + '%';
      // animasyon bitince anatomi noktaları belirsin
      if (hots) hots.classList.toggle('hots-on', p > 0.88);
    }
  }));
});

/* --- hero --- */
const heroV = $('[data-hero-scrub]');
if (heroV) {
  const hero = heroV.closest('.hero');
  ticks.push(new Scrub(heroV, {
    scope: hero,
    measure: () => clamp(-hero.getBoundingClientRect().top / (hero.offsetHeight * 0.85))
  }));
}

/* --- anatomi noktaları: tek panel, noktalar paneli besliyor --- */
$$('[data-hotlayer]').forEach((layer) => {
  const panel = $('[data-hotpanel]', layer);
  if (!panel) return;
  const title = panel.querySelector('b'), desc = panel.querySelector('span');
  const dots = $$('.hot__d', layer);
  const base = { t: title.textContent, d: desc.textContent };

  const show = (t, d) => { title.textContent = t; desc.textContent = d; };

  dots.forEach((dot) => {
    const pick = () => {
      dots.forEach((x) => x.classList.toggle('on', x === dot));
      show(dot.dataset.t, dot.dataset.d);
    };
    dot.addEventListener('click', (e) => { e.stopPropagation(); pick(); });
    dot.addEventListener('mouseenter', pick);
  });

  layer.addEventListener('mouseleave', () => {
    if (!dots.some((d) => d.classList.contains('on'))) show(base.t, base.d);
  });
});

/* ============================================================
   3. İMLEÇ + MANYETİK BUTONLAR
   ============================================================ */

if (!coarse) {
  const cur = $('.cur');
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;

  addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY; cur.classList.add('is-on');
  }, { passive: true });

  ticks.push({
    tick(dt) {
      const k = sK(0.3, dt);
      cx = lerp(cx, tx, k); cy = lerp(cy, ty, k);
      cur.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`;
    }
  });

  $$('[data-cursor]').forEach((el) => {
    el.addEventListener('mouseenter', () => cur.classList.add('is-big'));
    el.addEventListener('mouseleave', () => cur.classList.remove('is-big'));
  });

  $$('[data-magnet]').forEach((el) => {
    el.addEventListener('mouseenter', () => (el.style.transition = ''));
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform =
        `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.26}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
      el.style.transform = '';
      setTimeout(() => (el.style.transition = ''), 620);
    });
  });
}

/* ============================================================
   4. YATAY KAYAN TEDAVİLER
   ============================================================ */

$$('[data-hx]').forEach((sec) => {
  const track = $('[data-hx-track]', sec);
  const ix = $('[data-hx-i]', sec);
  const bar = $('.hx__n', sec);
  const cards = $$('.card', track);
  let cur = 0, vis = false;

  new IntersectionObserver((e) => { vis = e[0].isIntersecting; },
    { rootMargin: '25% 0px' }).observe(sec);

  ticks.push({
    tick(dt) {
      if (!vis) return;
      const r = sec.getBoundingClientRect();
      const total = sec.offsetHeight - innerHeight;
      const p = total > 0 ? clamp(-r.top / total) : 0;
      const dist = Math.max(0, track.scrollWidth - innerWidth + 24);
      cur = lerp(cur, p * dist, reduced ? 1 : sK(0.16, dt));
      track.style.transform = `translate3d(${-cur}px,0,0)`;
      if (bar) bar.style.setProperty('--hp', p.toFixed(3));
      if (ix && cards.length) {
        ix.textContent = String(Math.min(cards.length, Math.floor(p * cards.length) + 1)).padStart(2, '0');
      }
    }
  });
});

/* ============================================================
   5. KAYAN YAZI ŞERİDİ (scroll hızına tepki veriyor)
   ============================================================ */

$$('[data-mq]').forEach((mq) => {
  const row = $('.mq__r', mq);
  mq.appendChild(row.cloneNode(true));
  const rows = $$('.mq__r', mq);
  let x = 0, prevY = window.scrollY;

  ticks.push({
    tick(dt) {
      const w = rows[0].offsetWidth;
      if (!w) return;
      const vel = window.scrollY - prevY;
      prevY = window.scrollY;
      x -= (0.045 * dt) + Math.abs(vel) * 0.18;
      if (x <= -w) x += w;
      const sk = clamp(vel * 0.1, -6, 6);
      rows.forEach((r) => { r.style.transform = `translate3d(${x}px,0,0) skewX(${sk}deg)`; });
    }
  });
});

/* ============================================================
   6. PARALLAX
   ============================================================ */

$$('[data-plx]').forEach((el) => {
  const k = parseFloat(el.dataset.plx) || 0.1;
  let vis = false;
  new IntersectionObserver((e) => { vis = e[0].isIntersecting; },
    { rootMargin: '20% 0px' }).observe(el);

  if (el.classList.contains('clinic__v')) {
    const v = el.querySelector('video');
    if (v) { v.style.height = `${100 + Math.abs(k) * 200}%`; v.style.position = 'absolute'; v.style.inset = '0'; }
  }

  ticks.push({
    tick() {
      if (!vis || reduced) return;
      const r = el.getBoundingClientRect();
      const mid = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      const target = el.classList.contains('clinic__v') ? el.querySelector('video') || el : el;
      target.style.transform = `translate3d(0, ${(-mid * k * 100).toFixed(2)}px, 0)`;
    }
  });
});

/* ============================================================
   7. AÇILIŞ ANİMASYONLARI
   ============================================================ */

/* başlıkları kelimelere böl (<br> ve <em> korunur) */
$$('[data-split]').forEach((el) => {
  const out = [];
  let i = 0;
  const walk = (node, tag) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (!t.trim()) { out.push({ space: true }); return; }
          const last = out[out.length - 1];
          // "<em>acelesiz</em>," gibi durumlarda noktalama tek başına
          // satır başına düşmesin diye önceki kelimeye yapıştır
          if (/^[.,;:!?)»”’]+$/.test(t) && last && last.word) {
            last.word += t;
            return;
          }
          out.push({ word: t, tag });
        });
      } else if (n.nodeName === 'BR') {
        out.push({ br: true });
      } else {
        walk(n, n.nodeName);
      }
    });
  };
  walk(el, null);

  el.textContent = '';
  out.forEach((p) => {
    if (p.space) { el.appendChild(document.createTextNode(' ')); return; }
    if (p.br) { el.appendChild(document.createElement('br')); return; }
    const s = document.createElement('span');
    s.className = 'sp';
    const inner = document.createElement('i');
    inner.style.setProperty('--sd', `${i * 48}ms`);
    if (p.tag === 'EM' || p.tag === 'STRONG') {
      const t = document.createElement(p.tag.toLowerCase());
      t.textContent = p.word;
      inner.appendChild(t);
    } else inner.textContent = p.word;
    s.appendChild(inner);
    el.appendChild(s);
    i++;
  });
});

const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    revealIO.unobserve(e.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });

$$('[data-rv], [data-split]').forEach((el, i) => {
  // sayfa ortasından açıldıysa üstte kalanlar görünmez kalmasın
  if (el.getBoundingClientRect().bottom < 0) { el.classList.add('is-in'); return; }
  if (el.hasAttribute('data-rv') && !el.style.getPropertyValue('--sd')) {
    el.style.setProperty('--sd', `${(i % 4) * 80}ms`);
  }
  revealIO.observe(el);
});

/* ============================================================
   8. SAYAÇLAR
   ============================================================ */

const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const to = parseFloat(el.dataset.count);
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / 1500);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    countIO.unobserve(el);
  });
}, { threshold: 0.4 });

$$('[data-count]').forEach((el) => countIO.observe(el));

/* ============================================================
   9. NAV + İLERLEME ÇİZGİSİ
   ============================================================ */

const nav = $('#nav'), prog = $('.prog');
ticks.push({
  tick() {
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    prog.style.setProperty('--sp', (y / max).toFixed(4));
    nav.classList.toggle('solid', y > 40);
  }
});

/* ============================================================
   6. AÇIK / KAPALI DURUMU
   ============================================================ */

function status() {
  const msg = $('[data-msg]'), dot = $('[data-dot]');
  if (!msg) return;

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const d = now.getDay(), h = now.getHours(), m = now.getMinutes();
  const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const today = HOURS[d];
  const open = !!today && h >= today[0] && h < today[1];

  dot.classList.toggle('off', !open);

  if (open) {
    msg.textContent = `${hhmm} · Şu anda açığız`;
    return;
  }
  // bir sonraki açılış gününü bul
  let i = 1, next = null;
  while (i <= 7) {
    const dd = (d + (today && h < today[0] ? 0 : i)) % 7;
    if (HOURS[dd]) { next = { dd, hh: HOURS[dd][0] }; break; }
    i++;
  }
  const names = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  if (today && h < today[0]) {
    msg.textContent = `${hhmm} · Bugün ${String(today[0]).padStart(2, '0')}:00’da açılıyoruz`;
  } else if (next) {
    const label = next.dd === (d + 1) % 7 ? 'Yarın' : names[next.dd];
    msg.textContent = `${hhmm} · ${label} ${String(next.hh).padStart(2, '0')}:00’da açığız`;
  } else {
    msg.textContent = `${hhmm} · Şu anda kapalıyız`;
  }
}
status();
setInterval(status, 30000);

/* ============================================================
   7. SSS / FORM
   ============================================================ */

$$('.faq__q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq__i');
    const was = item.classList.contains('open');
    $$('.faq__i', item.closest('.faq')).forEach((i) => {
      i.classList.remove('open');
      $('.faq__q', i).setAttribute('aria-expanded', 'false');
    });
    if (!was) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
  });
});

$$('.chip').forEach((c) => {
  c.addEventListener('click', () => {
    $$('.chip', c.parentElement).forEach((x) => x.classList.remove('on'));
    c.classList.add('on');
  });
});

const form = $('#form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = $('.fm__ok', form);
    ok.textContent = 'Teşekkürler — talebiniz alındı. En kısa sürede sizi arayacağız.';
    ok.classList.add('on');
    $$('input, textarea', form).forEach((i) => (i.value = ''));
  });
}

/* ============================================================
   8. ANA DÖNGÜ
   ============================================================ */

let raf = null, prev = performance.now();
function loop(now = performance.now()) {
  const dt = Math.min(64, now - prev);
  prev = now;
  smooth.tick(dt);
  for (const t of ticks) t.tick(dt);
  raf = requestAnimationFrame(loop);
}
loop();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
  else if (!raf) { prev = performance.now(); loop(); }
});

/* ============================================================
   9. PRELOADER
   ============================================================ */

(() => {
  const pre = $('#pre');
  const ring = $('.pre__ring .fg');
  const pct = $('[data-pct]');
  const stage = $('[data-stage]');
  const vids = $$('video');

  const STAGES = [
    [0,    'Hazırlanıyor'],
    [0.35, 'Tedavi görselleri yükleniyor'],
    [0.7,  'Son dokunuşlar'],
    [0.92, 'Hoş geldiniz']
  ];

  let loaded = 0;
  const total = vids.length;
  vids.forEach((v) => {
    const done = () => loaded++;
    if (v.readyState >= 2) done();
    else {
      v.addEventListener('loadeddata', done, { once: true });
      v.addEventListener('error', done, { once: true });
    }
  });

  const t0 = performance.now();
  const MIN = 900, MAX = 3400;
  let shown = 0;

  const step = () => {
    const el = performance.now() - t0;
    const real = total ? loaded / total : 1;
    const want = Math.max(clamp(el / MAX), real * clamp(el / MIN));
    shown = Math.max(shown, Math.min(want, el < MIN ? 0.9 : 1));

    ring.style.setProperty('--lp', shown.toFixed(3));
    pct.textContent = Math.round(shown * 100);
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (shown >= STAGES[i][0]) { stage.textContent = STAGES[i][1]; break; }
    }

    if (shown >= 1 || el > MAX) {
      ring.style.setProperty('--lp', '1');
      pct.textContent = '100';
      stage.textContent = 'Hoş geldiniz';
      setTimeout(() => {
        pre.classList.add('is-done');
        document.body.classList.remove('is-loading');
        $$('[data-rv], [data-split]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
        });
      }, 260);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})();
