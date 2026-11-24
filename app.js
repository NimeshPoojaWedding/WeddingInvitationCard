/* ═══════════════════════════════════════════════════════════
   Nimesh & Pooja — Wedding Invitation
   Tap → film plays → curtains open → names pop out over the film
   → film settles on its last frame (curtains stay) → card scrolls up.
   ═══════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);

/* the invitation's current language ('en' | 'hi' — see the i18n block at the
   bottom). Read at event time, so dynamic strings fall in step with the toggle. */
const LANG = () => document.documentElement.lang;   // 'en' | 'hi' | 'gu'

const body      = document.body;
const hero      = $('hero');
const stageEl   = hero.querySelector('.hero__stage');
const video     = $('introVideo');
const tap       = $('tapTarget');
const skip      = $('skipBtn');
const card      = $('card');
const scrollCue = $('scrollCue');
const replay    = $('replayBtn');

/* seconds into the film when the curtains have parted and the names should pop */
const EMERGE_AT = 3.6;

let emerged   = false;
let revealed  = false;
let watchdog  = null;

/* ─────────────── Names pop out over the film ─────────────── */
function emerge() {
  if (emerged) return;
  emerged = true;
  hero.classList.add('is-emerged');
}

/* ─────────────── Scroll unlocked, card ready ─────────────── */
function revealCard() {
  if (revealed) return;
  revealed = true;
  emerge();
  clearInterval(watchdog);

  skip.hidden = true;                    // no longer anything to skip
  body.classList.remove('is-locked');
  body.classList.add('is-open');

  card.classList.add('is-revealed');
  card.setAttribute('aria-hidden', 'false');
}

/* ─────────────── Background music ─────────────── */
/* Starts with the tap, loops quietly, and can be silenced at any time. It
   fades rather than cutting, so the guest never hears a hard start. If the
   browser refuses to play it (or the file never loads) the control simply
   stays hidden instead of showing a button that does nothing. */
const musicEl  = $('music');
const musicBtn = $('musicBtn');

const MUSIC_VOLUME = 0.55;      // low enough to sit under the film's own sound
let musicWanted = false;        // the guest has not muted it
let fadeTimer = 0;

function fadeMusic(to, ms) {
  clearInterval(fadeTimer);
  if (!musicEl) return;
  const from = musicEl.volume;
  const steps = Math.max(1, Math.round(ms / 60));
  let i = 0;
  fadeTimer = setInterval(() => {
    i += 1;
    musicEl.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
    if (i >= steps) clearInterval(fadeTimer);
  }, 60);
}

function showMusicControl(show) {
  if (!musicBtn) return;
  musicBtn.hidden = !show;
  if (show) requestAnimationFrame(() => musicBtn.classList.add('is-live'));
  else musicBtn.classList.remove('is-live');
}

function startMusic() {
  if (!musicEl) return;
  musicEl.volume = 0;
  const p = musicEl.play();
  if (p && p.then) {
    p.then(() => {
        musicWanted = true;
        showMusicControl(true);
        fadeMusic(MUSIC_VOLUME, 1600);
      })
      .catch(() => showMusicControl(false));   // blocked — leave the page alone
  } else {
    musicWanted = true;
    showMusicControl(true);
    fadeMusic(MUSIC_VOLUME, 1600);
  }
}

function stopMusic(fade) {
  if (!musicEl) return;
  if (!fade) { try { musicEl.pause(); } catch (_) {} return; }
  fadeMusic(0, 600);
  setTimeout(() => { if (!musicWanted) { try { musicEl.pause(); } catch (_) {} } }, 620);
}

if (musicEl) {
  musicEl.loop = true;
  musicEl.addEventListener('error', () => showMusicControl(false));
}

if (musicBtn) {
  musicBtn.addEventListener('click', () => {
    if (!musicEl) return;
    musicWanted = !musicWanted;

    if (musicWanted) {
      const p = musicEl.play();
      if (p && p.catch) p.catch(() => {});
      fadeMusic(MUSIC_VOLUME, 700);
    } else {
      stopMusic(true);
    }

    musicBtn.classList.toggle('is-muted', !musicWanted);
    musicBtn.setAttribute('aria-pressed', String(!musicWanted));
    musicBtn.setAttribute('aria-label', musicWanted ? 'Mute the music' : 'Play the music');
  });
}

/* ─────────────── Tap anywhere to open ─────────────── */
function beginOpening() {
  tap.classList.add('is-hidden');
  skip.hidden = false;
  startMusic();                 // the tap is the gesture that lets it play

  /* iOS Safari honours preload hints only once play() has been asked for:
     waiting for `canplay` before play() meant it never fetched a byte, so
     `canplay` never fired and the 3.2 s fallback opened the card over a
     frozen poster (the iPhone report). Android honours preload, which is why
     it played fine. So: ask to play at once, inside the tap gesture, and
     keep re-asking as data lands — muted inline playback needs no gesture. */
  const tryStart = () => {
    const p = video.play();
    if (p && p.catch) p.catch(() => {});   // data not there yet — retried below
  };
  const stopRetrying = () => {
    video.removeEventListener('canplay', tryStart);
    video.removeEventListener('loadeddata', tryStart);
  };
  video.addEventListener('canplay', tryStart);
  video.addEventListener('loadeddata', tryStart);
  video.addEventListener('playing', stopRetrying, { once: true });
  video.addEventListener('error', stopRetrying, { once: true });

  try { video.currentTime = 0; } catch (_) {}   // harmless before any data
  tryStart();

  // Belt & braces: poll the clock so the pop is never missed, even if
  // `timeupdate` is throttled on a slow device.
  watchdog = setInterval(() => {
    if (video.currentTime >= EMERGE_AT) emerge();
    if (video.ended) revealCard();
  }, 120);

  // If the film truly cannot start (stalled download, blocked decoder),
  // still open the invitation rather than leaving the guest on the poster.
  setTimeout(emerge, 1800);
  setTimeout(revealCard, 3200);
}

/* ─────────────── Replay everything ─────────────── */
function replayIntro() {
  emerged = false;
  revealed = false;
  clearInterval(watchdog);

  body.classList.add('is-locked');
  body.classList.remove('is-open');
  card.classList.remove('is-revealed');
  card.setAttribute('aria-hidden', 'true');
  hero.classList.remove('is-emerged');

  tap.classList.remove('is-hidden');
  skip.hidden = true;

  try { video.pause(); video.currentTime = 0; } catch (_) {}
  window.scrollTo({ top: 0, behavior: 'auto' });

  // drop the depth cues back to a flat plane immediately
  hero.classList.remove('is-recede');
  card.classList.remove('is-rising');
  document.documentElement.style.setProperty('--p', '0');

  // and stop the music — the next tap will start it again
  musicWanted = false;
  stopMusic(false);
  try { if (musicEl) musicEl.currentTime = 0; } catch (_) {}
  showMusicControl(false);
  if (musicBtn) {
    musicBtn.classList.remove('is-muted');
    musicBtn.setAttribute('aria-pressed', 'false');
    musicBtn.setAttribute('aria-label', 'Mute the music');
  }
}

/* ─────────────── Wiring ─────────────── */
tap.addEventListener('click', beginOpening);
skip.addEventListener('click', (e) => { e.stopPropagation(); emerge(); revealCard(); });
video.addEventListener('timeupdate', () => { if (video.currentTime >= EMERGE_AT) emerge(); });
video.addEventListener('ended', () => setTimeout(revealCard, 260));
video.addEventListener('error', () => revealCard());
scrollCue.addEventListener('click', () => {
  window.scrollTo({ top: hero.offsetHeight, behavior: 'smooth' });
});
replay.addEventListener('click', replayIntro);

/* ─────────────── Reveal the sections below the fold ─────────────── */
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 })
  : null;

document.querySelectorAll('.body .reveal').forEach((el) => {
  if (io) io.observe(el); else el.classList.add('is-in');
});

/* ─────────────── Scroll-driven 3D depth ─────────────── */
/* One rAF-throttled scroll read feeds every depth cue: `--p` is the fraction
   of a screen the page has scrolled, and the two classes switch the 3D
   transforms on and off. They are removed the instant the motion settles so
   the film and the long-form text are never left on a resampled layer. */
(function depth(){
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0;

  function update(){
    raf = 0;
    const h = hero.offsetHeight || 1;
    const p = Math.min(1, Math.max(0, window.scrollY / h));
    document.documentElement.style.setProperty('--p', p.toFixed(4));
    hero.classList.toggle('is-recede', p > 0.002 && !calm.matches);
    card.classList.toggle('is-rising', p < 0.995 && !calm.matches);
  }
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  if (calm.addEventListener) calm.addEventListener('change', onScroll);
  update();
})();

/* ═════════════════ SCRATCH TO REVEAL — the save-the-date card ═════════════════ */
(function scratchCard() {
  const wrap = $('scratch');
  if (!wrap) return;

  const canvas = $('scratchCanvas');
  const video  = $('dateVideo');
  const ctx    = canvas.getContext('2d');

  /* Scratch progress is tracked on a coarse grid, not by reading pixels back
     out of the canvas. Marking the cells a stroke passes over is cheap enough
     to run on every pointer move, needs no getImageData (which is slow on
     phones), and lets us count only the area a thumb can actually reach — so
     guests never have to hunt for the last stubborn corner. */
  const COLS = 16, ROWS = 10, CELLS = COLS * ROWS;
  const cells = new Uint8Array(CELLS);
  let marked = 0;

  /* Tuning note: this card is wide and short, so one full-width sweep really
     does clear ~40% of its area. A 0.28 threshold therefore opened it on the
     very first swipe and spoiled the reveal. Requiring ~42% lands on a
     satisfying two-to-three passes, and the travel fallback below guarantees
     nobody gets stuck rubbing one spot. */
  const brushBase  = 0.115;   // brush radius as a fraction of the card width
  const REVEAL_AT  = 0.42;    // coverage that opens the card
  const MAX_TRAVEL = 2.5;     // …or this many card-widths of scratching

  let W = 0, H = 0, brush = 30, opened = false, touched = false;
  let drawing = false, lastPt = null, painted = false, travelled = 0;
  let activeId = null, rect = null;

  const point = (e) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });

  /* ---- paint the paper sheet the guest has to scratch away ---- */
  function paint() {
    rect = wrap.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    cells.fill(0); marked = 0;

    // warm handmade paper
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#f9f2e4');
    g.addColorStop(.45, '#ede0c9');
    g.addColorStop(1, '#f6eeda');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // grain + soft blotches
    for (let i = 0, n = Math.round((W * H) / 42); i < n; i++) {
      const a = Math.random() * 0.055;
      ctx.fillStyle = `rgba(132,108,72,${a})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 22 + Math.random() * 64;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(198,170,130,.11)');
      rg.addColorStop(1, 'rgba(198,170,130,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // gold dashed frame
    ctx.save();
    ctx.strokeStyle = 'rgba(176,138,54,.6)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 6]);
    ctx.strokeRect(12, 12, W - 24, H - 24);
    ctx.restore();

    // centre medallion
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.185;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const ring = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.1, cx, cy, R);
    ring.addColorStop(0, 'rgba(255,253,247,.92)');
    ring.addColorStop(1, 'rgba(244,233,212,.72)');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.strokeStyle = 'rgba(176,138,54,.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#9a7434';
    ctx.font = `600 ${Math.round(R * 0.58)}px 'Great Vibes', cursive`;
    ctx.fillText('N  \u2665  P', cx, cy + R * 0.06);

    // little sparkle inside the ring
    ctx.beginPath();
    const s = R * 0.2, sx = cx, sy = cy - R * 0.56;
    ctx.moveTo(sx, sy - s);
    ctx.quadraticCurveTo(sx, sy, sx + s, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + s);
    ctx.quadraticCurveTo(sx, sy, sx - s, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - s);
    ctx.fillStyle = 'rgba(176,138,54,.75)';
    ctx.fill();
    ctx.restore();

    painted = true;
  }

  /* ---- coverage: which cells has the guest scratched through? ---- */
  function mark(x, y, rad) {
    const cw = W / COLS, ch = H / ROWS, r2 = rad * rad;
    const c0 = Math.max(0, Math.floor((x - rad) / cw));
    const c1 = Math.min(COLS - 1, Math.floor((x + rad) / cw));
    const r0 = Math.max(0, Math.floor((y - rad) / ch));
    const r1 = Math.min(ROWS - 1, Math.floor((y + rad) / ch));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * COLS + c;
        if (cells[i]) continue;
        const dx = (c + 0.5) * cw - x, dy = (r + 0.5) * ch - y;
        if (dx * dx + dy * dy <= r2) { cells[i] = 1; marked++; }
      }
    }
  }

  function markSeg(x0, y0, x1, y1, rad) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (rad * 0.5)));
    for (let i = 1; i <= steps; i++) mark(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, rad);
  }

  const coverage = () => marked / CELLS;

  /* ---- erasing: one stroked path per segment, so a fast swipe never
     leaves a dotted trail of gaps behind it ---- */
  function scratchTo(x, y, rad) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = rad * 2;

    if (lastPt) {
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      travelled += Math.hypot(x - lastPt.x, y - lastPt.y);
      markSeg(lastPt.x, lastPt.y, x, y, rad);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      mark(x, y, rad);
    }
    ctx.restore();
    lastPt = { x, y };
  }

  function maybeOpen(force) {
    if (opened) return;
    if (!force && coverage() < REVEAL_AT && travelled < W * MAX_TRAVEL) return;

    opened = true;
    drawing = false;
    activeId = null;
    wrap.classList.add('is-open');          // the paper fades away
    canvas.classList.add('is-gone');
    if (video) {
      video.classList.add('is-revealed');   // the film settles in and opens the date
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  /* ---- pointer ---- */
  const stop = () => {
    if (!drawing) return;
    drawing = false;
    activeId = null;
    lastPt = null;
    wrap.classList.remove('is-scratching');
    maybeOpen();
  };

  wrap.addEventListener('pointerdown', (e) => {
    if (opened) return;
    if (activeId !== null && e.pointerId !== activeId) return;   // ignore 2nd finger
    touched = true;
    activeId = e.pointerId;
    drawing = true;
    lastPt = null;
    rect = wrap.getBoundingClientRect();
    wrap.classList.add('is-scratching');
    try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
    const p = point(e);
    // even a plain tap takes a generous bite, so hesitant guests make progress
    scratchTo(p.x, p.y, brush * 1.45);
    maybeOpen();
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!drawing || opened || e.pointerId !== activeId) return;
    // a press released off-screen leaves `buttons` at 0
    if (e.pointerType === 'mouse' && e.buttons === 0) { stop(); return; }
    rect = wrap.getBoundingClientRect();
    // Coalesced events keep the line smooth at high pointer sampling rates —
    // but the list is allowed to come back empty, so never treat it as the
    // only source: fall back to the event itself or scratching would stall.
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    if (evs.length) {
      for (const ev of evs) {
        const q = point(ev);
        scratchTo(q.x, q.y, brush);
      }
    } else {
      const q = point(e);
      scratchTo(q.x, q.y, brush);
    }
    maybeOpen();
  });

  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  wrap.addEventListener('lostpointercapture', stop);

  /* ---- keyboard / accessible fallback ---- */
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); maybeOpen(true); }
  });

  /* when the film stops, swap to the clean still so the date is razor sharp */
  if (video) video.addEventListener('ended', () => wrap.classList.add('is-ended'));
  /* if the film cannot load at all, the still still carries the reveal */
  if (video) video.addEventListener('error', () => wrap.classList.add('is-ended'));

  /* ---- sizing ---- */
  /* ---- sizing ---- */
  let rt;
  function size() {
    paint();
    brush = Math.max(20, W * brushBase);
  }
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (!touched && !opened) size(); }, 180);
  });

  size();

  // repaint once the script fonts land, so the medallion is drawn in the right face
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (!touched && !opened && painted) size(); });
  }
})();

/* ═════════════════ PHOTO SLIDER — Moments ═════════════════ */
(function gallery() {
  const root  = $('slider');
  const track = $('sliderTrack');
  const dots  = $('sliderDots');
  const prev  = $('sliderPrev');
  const next  = $('sliderNext');
  if (!root || !track || !dots) return;

  const slides = Array.from(track.children);
  const n = slides.length;
  if (!n) return;

  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0, timer = 0;

  const marks = slides.map((_, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Photo ' + (k + 1) + ' of ' + n);
    b.addEventListener('click', () => { go(k); restart(); });
    dots.appendChild(b);
    return b;
  });

  function go(k) {
    i = ((k % n) + n) % n;
    track.style.transform = 'translateX(' + (-i * 100) + '%)';
    marks.forEach((d, j) => {
      const on = j === i;
      d.classList.toggle('is-active', on);
      d.setAttribute('aria-selected', String(on));
    });
    slides.forEach((s, j) => s.setAttribute('aria-hidden', String(j !== i)));
  }

  function start() {
    stop();
    if (calm() || n < 2) return;
    timer = setInterval(() => go(i + 1), 5200);
  }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }
  function restart() { start(); }

  prev.addEventListener('click', () => { go(i - 1); restart(); });
  next.addEventListener('click', () => { go(i + 1); restart(); });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { go(i - 1); restart(); }
    if (e.key === 'ArrowRight') { go(i + 1); restart(); }
  });

  /* Swipe: read the gesture on release and only take it when it is clearly
     horizontal, so a vertical drag still scrolls the page as usual. */
  let sx = 0, sy = 0, down = false;
  root.addEventListener('pointerdown', (e) => {
    down = true; sx = e.clientX; sy = e.clientY; stop();
  }, { passive: true });
  root.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1));
    start();
  });
  root.addEventListener('pointercancel', () => { down = false; start(); });

  /* Only runs while it is actually on screen. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((ents) => {
      ents.forEach((en) => (en.isIntersecting ? start() : stop()));
    }, { threshold: 0.35 }).observe(root);
  } else {
    start();
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  go(0);
})();

/* ═════════════════ COUNTDOWN to 21 December 2026, 4:00 PM ═════════════════ */
(function countdown() {
  const box = $('countdown');
  if (!box) return;

  const el = { d: $('cdD'), h: $('cdH'), m: $('cdM'), s: $('cdS') };
  const label = box.querySelector('.countdown__label');
  const when  = $('cdWhen');

  // 21 Dec 2026, 16:00 in the guest's own timezone
  const TARGET = new Date(2026, 11, 21, 16, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');

  function tick() {
    const ms = TARGET.getTime() - Date.now();
    if (ms <= 0) {
      el.d.textContent = el.h.textContent = el.m.textContent = el.s.textContent = '00';
      const L = LANG();
      label.textContent = L === 'hi' ? 'आज ही वह दिन है — वहीं मिलते हैं!'
                        : L === 'gu' ? 'આજનો જ દિવસ છે — ત્યાં મળીએ!'
                        : 'Today is the day — see you there!';
      when.textContent = L === 'hi' ? '21 दिसंबर 2026 · दोपहर 4:00'
                       : L === 'gu' ? '21 ડિસેમ્બર 2026 · બપોરે 4:00'
                       : '21 December 2026 · 4:00 PM';
      box.classList.add('is-now');
      return;
    }
    const s = Math.floor(ms / 1000);
    el.d.textContent = pad(Math.floor(s / 86400));
    el.h.textContent = pad(Math.floor(s / 3600) % 24);
    el.m.textContent = pad(Math.floor(s / 60) % 60);
    el.s.textContent = pad(s % 60);
  }

  tick();
  setInterval(tick, 1000);
})();

/* ─────────────── Petals & sparkles over the film ─────────────── */
(function petals() {
  const canvas = $('petals');
  if (!canvas || !stageEl) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, particles = [], raf = 0, last = 0;
  const COLORS = ['185,159,217', '123,90,181', '236,211,152', '255,248,232'];

  function spawn(initial) {
    const isPetal = Math.random() < 0.7;
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : -24,
      r: isPetal ? 4 + Math.random() * 7 : 1 + Math.random() * 1.6,
      vy: isPetal ? 14 + Math.random() * 26 : 6 + Math.random() * 14,
      vx: -12 + Math.random() * 24,
      sway: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      a: 0.22 + Math.random() * 0.5,
      rot: Math.random() * Math.PI * 2,
      vr: -0.5 + Math.random(),
      isPetal,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      tw: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stageEl.clientWidth; H = stageEl.clientHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(46, Math.max(14, (W * H) / 26000)));
    particles = Array.from({ length: count }, () => spawn(true));
  }

  function draw(t) {
    const dt = Math.min((t - last) / 1000 || 0, 0.05);
    last = t;
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      p.phase += dt * p.sway;
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(p.phase) * 14) * dt;
      p.rot += p.vr * dt;
      if (p.y - 30 > H || p.x < -60 || p.x > W + 60) Object.assign(p, spawn(false));

      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.isPetal) {
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.a;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 1.7);
        g.addColorStop(0, `rgba(${p.color},.95)`);
        g.addColorStop(1, `rgba(${p.color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.7, p.r, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        p.tw += dt * 2.4;
        const s = p.r * (1.2 + Math.sin(p.tw) * 0.55);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = `rgba(${p.color},.95)`;
        ctx.shadowColor = `rgba(${p.color},.95)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  resize();
  start();
})();

/* ═════════════ हिन्दी · ગુજરાતી ⇄ ENGLISH — one tap cycles the whole card ═════════════ */
/* Each rule addresses a translatable element by its class and recognises it
   by its English text. Switching to Hindi swaps only that element's text (or
   a small, known-safe chunk of markup such as the <br> of an address), and
   the pristine markup of every touched element is remembered so switching
   back is an exact restore — the slider, the scratch card and every event
   listener carry on untouched. Dynamic strings (the countdown label) read
   LANG() — 'en' | 'hi' | 'gu' — at event time. */
(function i18n() {
  const btn = document.getElementById('langBtn');
  if (!btn) return;

  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  const TITLES = {
    en: document.title,
    hi: 'निमेश व पूजा — विवाह निमंत्रण',
    gu: 'નિમેશ અને પૂજા — લગ્ન નિમંત્રણ',
  };
  /* the button always names the language the NEXT tap will bring */
  const NEXT_LABEL = { en: 'हिन्दी', hi: 'ગુજરાતી', gu: 'English' };

  const RULES = [
    /* — the hero — */
    { sel: '.kicker',              match: 'Together with their families', hi: 'परिवार की सहमति से', gu: 'પરિવારની સંમતિથી' },
    { sel: '.name',                match: 'Nimesh',                       hi: 'निमेश', gu: 'નિમેશ' },
    { sel: '.name',                match: 'Pooja',                        hi: 'पूजा', gu: 'પૂજા' },
    { sel: '.parents',             match: 'son of',      hi: 'पुत्र — <em>सुरेशकुमार ठक्कर</em> एवं <em>सरला ठक्कर</em>', gu: 'પુત્ર — <em>સુરેશકુમાર ઠક્કર</em> અને <em>સરલા ઠક્કર</em>', html: true },
    { sel: '.parents',             match: 'daughter of', hi: 'पुत्री — <em>भगवानदास क्रिपलानी</em> एवं <em>सरिता क्रिपलानी</em>', gu: 'પુત્રી — <em>ભગવાનદાસ ક્રિપલાની</em> અને <em>સરિતા ક્રિપલાની</em>', html: true },
    { sel: '.ask',                 match: 'request the honour', hi: 'दंपती के शुभ विवाहोत्सव में<br>आपकी गरिमामयी उपस्थिति की कामना करते हैं', gu: 'તેમના શુભ લગ્નોત્સવમાં<br>તમારી ગરિમામય ઉપસ્થિતિની નમ્ર વિનંતી', html: true },
    { sel: '.tap__hint',           match: 'Tap to open', hi: 'खोलने के लिए टैप करें', gu: 'ખોલવા ટેપ કરો' },
    { sel: '.skip',                match: 'Skip',        hi: 'छोड़ें ›', gu: 'છોડો ›' },
    { sel: '.scroll-cue > span',   match: 'scroll',      hi: 'नीचे देखें', gu: 'નીચે જુઓ' },

    /* — the invitation — */
    { sel: '.invite__lead',  match: 'With the blessings', hi: 'श्री गणेश और परिवार-जनों के आशीर्वाद से,', gu: 'શ્રી ગણેશ અને પરિવારજનોના આશીર્વાદથી,' },
    { sel: '.invite__body',  match: 'hearts full of joy', hi: 'आनंद से भरे हृदय से हम आपको निमेश और पूजा के विवाहोत्सव में शामिल होने का निमंत्रण देते हैं। दो हृदय, दो परिवार और जीवन भर का साथ — इस शुभ अवसर पर हमारे साथ आपकी उपस्थिति हमारे लिए गर्व की बात होगी। आइए, दंपति को आशीर्वाद दें, हमारी खुशियों में शामिल हों और उन यादों का हिस्सा बनें जिन्हें हम हमेशा संजोए रखेंगे।', gu: 'હૃદય આનંદથી ભરાઈ ગયા છે — અમે તમને નિમેશ અને પૂજાના લગ્નોત્સવમાં જોડાવા આમંત્રણ આપીએ છીએ. બે હૃદય, બે પરિવાર અને જીવનભરનો સંગ — આ શુભ દિવસે અમારી સાથે તમારી ઉપસ્થિતિ અમારા માટે ગૌરવની વાત છે. આવો, દંપતીને આશીર્વાદ આપો, અમારી ખુશીઓમાં ભાગીદાર બનો અને તે યાદોનો ભાગ બનો જે અમે હંમેશા સાચવીશું.' },
    { sel: '.invite__close', match: 'Your presence',      hi: 'आपकी उपस्थिति हमारी खुशी को पूर्ण करेगी।', gu: 'તમારી ઉપસ્થિતિ અમારી ખુશી પૂર્ણ કરશે.' },

    /* — save the date + countdown — */
    { sel: '.panel__title',      match: 'Save the Date',       hi: 'शुभ तिथि', gu: 'શુભ તારીખ' },
    { sel: '.panel__sub',        match: 'reveal the date',     hi: 'तारीख़ जानने के लिए खुरचें', gu: 'તારીખ દેખાવા માટે સ્ક્રેચ કરો' },
    { sel: '.countdown__label',  match: 'celebration begins',  hi: 'उत्सव शुरू होने में', gu: 'ઉત્સવ શરૂ થવામાં' },
    { sel: '.unit > span',       match: 'Days',                hi: 'दिन', gu: 'દિવસ' },
    { sel: '.unit > span',       match: 'Hours',               hi: 'घंटे', gu: 'કલાક' },
    { sel: '.unit > span',       match: 'Minutes',             hi: 'मिनट', gu: 'મિનિટ' },
    { sel: '.unit > span',       match: 'Seconds',             hi: 'सेकंड', gu: 'સેકન્ડ' },

    /* — the photo gallery — */
    { sel: '.panel__title', match: 'Nimesh & Pooja',   hi: 'निमेश व पूजा', gu: 'નિમેશ અને પૂજા' },
    { sel: '.panel__sub',   match: 'moments together', hi: 'साथ बिताए कुछ पल', gu: 'સાથે બિતાવેલા કેટલાક ક્ષણો' },

    /* — the families who invite you — */
    { sel: '.panel__title', match: 'From the Family', hi: 'परिवार की ओर से, प्रेम सहित', gu: 'પરિવાર તરફથી, પ્રેમ સાથે' },
    { sel: '.panel__sub',   match: 'whole-heartedly invite you', hi: 'जो पूरे हृदय से आपको हमारे साथ उत्सव मनाने का निमंत्रण देते हैं', gu: 'જે પૂરા હૃદયથી તમને અમારી સાથે ઉત્સવ મનાવવાનું આમંત્રણ આપે છે' },
    { sel: '.family__head', match: 'Thakkar Family Members', hi: 'ठक्कर परिवार के सदस्य', gu: 'ઠક્કર પરિવારના સભ્યો' },
    { sel: '.family__head', match: 'Nanihal Paksh',           hi: 'ननिहाल पक्ष', gu: 'નનિહાલ પક્ષ' },

    /* the people themselves — names transliterated, not translated */
    { sel: '.family__list b', match: 'Shri Sureshkumar Thakkar',  hi: 'श्री सुरेशकुमार ठक्कर एवं श्रीमती सरला ठक्कर', gu: 'શ્રી સુરેશકુમાર ઠક્કર અને શ્રીમતી સરલા ઠક્કર' },
    { sel: '.family__list b', match: 'Shri Bharatkumar Thakkar',  hi: 'श्री भरतकुमार ठक्कर एवं श्रीमती देविका ठक्कर', gu: 'શ્રી ભરતકુમાર ઠક્કર અને શ્રીમતી દેવિકા ઠક્કર' },
    { sel: '.family__list b', match: 'Shri Shekhar Thakkar',      hi: 'श्री शेखर ठक्कर एवं श्रीमती उषा ठक्कर', gu: 'શ્રી શેખર ઠક્કર અને શ્રીમતી ઉષા ઠક્કર' },
    { sel: '.family__list b', match: 'Shri Jagdishkumar Thakkar', hi: 'श्री जगदीशकुमार ठक्कर', gu: 'શ્રી જગદીશકુમાર ઠક્કર' },
    { sel: '.family__list b', match: 'Dhanvanti Motvani',         hi: 'श्रीमती धनवंती मोतवानी एवं श्री लक्ष्मणदास मोतवानी', gu: 'શ્રીમતી ધનવંતી મોતવાણી અને શ્રી લક્ષ્મણદાસ મોતવાણી' },
    { sel: '.family__list b', match: 'Vidya Ainani',              hi: 'स्व. श्रीमती विद्या ऐनानी एवं श्री गंगाधर ऐनानी', gu: 'સ્વ. શ્રીમતી વિદ્યા ઐનાની અને શ્રી ગંગાધર ઐનાની' },
    { sel: '.family__list b', match: 'Rameshwari Khiyani',        hi: 'श्रीमती रमेश्वरी खियानी एवं श्री चंद्रकुमार खियानी', gu: 'શ્રીમતી રમેશ્વરી ખિયાણી અને શ્રી ચંદ્રકુમાર ખિયાણી' },
    { sel: '.family__list b', match: 'Veena Jaswani',             hi: 'श्रीमती वीणा जसवानी एवं श्री जगदीशकुमार जवानी', gu: 'શ્રીમતી વીણા જસવાણી અને શ્રી જગદીશકુમાર જવાણી' },
    { sel: '.family__list b', match: 'Jyoti, Kajal',              hi: 'ज्योति, कजल, नीरज, हर्ष, पार्थ, हेमिश एवं कैंडी', gu: 'જ્યોતિ, કાજલ, નીરજ, હર્ષ, પાર્થ, હેમિશ અને કેન્ડી' },
    { sel: '.family__list b', match: 'Gyanchand Khilwani',        hi: 'स्व. श्री ज्ञानचंद खिलवानी एवं श्रीमती वीणादेवी खिलवानी', gu: 'સ્વ. શ્રી જ્ઞાનચંદ ખિલવાણી અને શ્રીમતી વીણાદેવી ખિલવાણી' },
    { sel: '.family__list b', match: 'Shyamkumar Khilwani',       hi: 'श्री श्यामकुमार खिलवानी', gu: 'શ્રી શ્યામકુમાર ખિલવાણી' },
    { sel: '.family__list b', match: 'Nitinkumar Khilwani',       hi: 'श्री नितिनकुमार खिलवानी', gu: 'શ્રી નિતિનકુમાર ખિલવાણી' },
    { sel: '.family__list b', match: 'Manojkumar Goindani',       hi: 'श्री मनोजकुमार गोइंदानी एवं श्रीमती कविता गोइंदानी', gu: 'શ્રી મનોજકુમાર ગોઇંદાણી અને શ્રીમતી કવિતા ગોઇંદાણી' },
    { sel: '.family__list i', match: 'Mata & Pita',     hi: 'माता एवं पिता', gu: 'માતા અને પિતા' },
    { sel: '.family__list i', match: 'Chacha & Chachi',  hi: 'चाचा एवं चाची', gu: 'કાકા અને કાકી' },
    { sel: '.family__list i', match: 'Chacha',           hi: 'चाचा', gu: 'કાકા' },
    { sel: '.family__list i', match: 'Bua & Jijaji',     hi: 'बुआ एवं जीजाजी', gu: 'ફોઈ અને ફુઆ' },
    { sel: '.family__list i', match: 'Cousins',          hi: 'कज़िन', gu: 'કઝિન' },
    { sel: '.family__list i', match: 'Nana & Nani',      hi: 'नाना एवं नानी', gu: 'નાના અને નાની' },
    { sel: '.family__list i', match: 'Mama',             hi: 'मामा', gu: 'મામા' },
    { sel: '.family__list i', match: 'Bhai',             hi: 'भाई', gu: 'ભાઈ' },
    { sel: '.family__list i', match: 'Masad & Masi',     hi: 'मौसा एवं मौसी', gu: 'માસા અને માસી' },

    /* — itinerary — */
    { sel: '.panel__title', match: 'Itinerary',      hi: 'कार्यक्रम', gu: 'કાર્યક્રમ' },
    { sel: '.panel__sub',   match: 'Three days',     hi: 'तीन दिनों का उत्सव', gu: 'ત્રણ દિવસનો ઉત્સવ' },
    { sel: '.day__mon',     match: 'December',       hi: 'दिसंबर', gu: 'ડિસેમ્બર' },
    { sel: '.slot__time',   match: '7 PM onwards',  hi: 'शाम 7 से<em>शाम</em>', gu: 'સાંજ 7 થી<em>સાંજ</em>', html: true },
    { sel: '.slot__what',   match: 'Jagdish',       hi: '<b>जगदीश का जन्मदिन उत्सव</b>', gu: '<b>જગદીશનો જન્મદિવસ ઉત્સવ</b>', html: true },
    { sel: '.slot__time',   match: '12 PM onwards', hi: 'दोपहर 12 से<em>दोपहर</em>', gu: 'બપોર 12 થી<em>બપોર</em>', html: true },
    { sel: '.slot__what',   match: 'Haldi & Games', hi: '<b>हल्दी एवं खेल</b><i>हल्दी से खेल · भोजन</i><span class="theme-chip theme-chip--haldi">बेबी पिंक थीम</span>', gu: '<b>હળદી અને રમતો</b><i>હળદીની રમતો · ભોજન</i><span class="theme-chip theme-chip--haldi">બેબી પિંક થીમ</span>', html: true },
    { sel: '.slot__time',   match: '5 PM onwards',  hi: 'शाम 5 से<em>शाम</em>', gu: 'સાંજ 5 થી<em>સાંજ</em>', html: true },
    { sel: '.slot__what',   match: 'Ladies Sangeet', hi: '<b>लेडीज़ संगीत</b>', gu: '<b>લેડીઝ સંગીત</b>', html: true },
    { sel: '.slot__what',   match: 'Bherana',       hi: '<b>भेरणा साहेब</b>', gu: '<b>ભેરણા સાહેબ</b>', html: true },
    { sel: '.slot__time',   match: '10 PM onwards', hi: 'रात 10 से<em>रात्रि</em>', gu: 'રાત્રે 10 થી<em>રાત્રિ</em>', html: true },
    { sel: '.slot__what',   match: 'Dance Performances', hi: '<b>नृत्य प्रस्तुतियाँ</b>', gu: '<b>નૃત્ય પ્રસ્તુતિઓ</b>', html: true },
    { sel: '.slot__time',   match: '11 AM onwards', hi: 'सुबह 11 से<em>प्रातः</em>', gu: 'સવારે 11 થી<em>પ્રાતઃ</em>', html: true },
    { sel: '.slot__what',   match: 'Saat Son',       hi: '<b>सात सोन</b>', gu: '<b>સાત સોન</b>', html: true },
    { sel: '.slot__time',   match: '1 PM onwards',  hi: 'दोपहर 1 से<em>दोपहर</em>', gu: 'બપોર 1 થી<em>બપોર</em>', html: true },
    { sel: '.slot__what',   match: 'Lunch & Dikh',  hi: '<b>भोजन एवं दीख</b>', gu: '<b>ભોજન અને દીખ</b>', html: true },
    { sel: '.slot__time',   match: '3 PM onwards',  hi: 'दोपहर 3 से<em>दोपहर</em>', gu: 'બપોર 3 થી<em>બપોર</em>', html: true },
    { sel: '.slot__what',   match: 'Baarat',        hi: '<b>बारात</b>', gu: '<b>બારાત</b>', html: true },
    { sel: '.slot__time',   match: '4 PM onwards',  hi: 'दोपहर 4 से<em>सायं</em>', gu: 'બપોર 4 થી<em>સાયં</em>', html: true },
    { sel: '.slot__what',   match: 'Wedding',       hi: '<b>विवाह</b><span class="theme-chip theme-chip--wedding">पैस्टल रंग थीम</span>', gu: '<b>લગ્ન</b><span class="theme-chip theme-chip--wedding">પેસ્ટલ રંગ થીમ</span>', html: true },
    { sel: '.slot__time',   match: '8 PM onwards',  hi: 'रात 8 से<em>भोजन</em>', gu: 'રાત્રે 8 થી<em>ભોજન</em>', html: true },
    { sel: '.slot__what',   match: 'Dinner Party',  hi: '<b>भोजन समारोह</b>', gu: '<b>ભોજન સમારોહ</b>', html: true },

    /* — the venue — */
    { sel: '.panel__title', match: 'The Venue', hi: 'स्थान', gu: 'સ્થળ' },
    { sel: '.venue__addr',  match: 'State Highway Road', hi: 'आर.एस. नं. 3138, स्टेट हाईवे रोड,<br>सी.एन.जी. पंप के सामने, उणावा, ता. ऊँझा,<br>मेहसाणा, गुजरात 384160', gu: 'આર.એસ. નં. 3138, સ્ટેટ હાઈવે રોડ,<br>સી.એન.જી. પંપ સામે, ઉણાવા, તા. ઊંઝા,<br>મહેસાણા, ગુજરાત 384160', html: true },
    { sel: '.venue .btn',   match: 'Google Maps', hi: 'गूगल मैप्स में खोलें', gu: 'ગૂગલ મેપ્સમાં ખોલો' },

    /* — footer — */
    { sel: '.foot__names',  match: 'Nimesh', hi: 'निमेश <span>व</span> पूजा', gu: 'નિમેશ <span>અને</span> પૂજા', html: true },
    { sel: '.foot__contact', match: 'contact', hi: 'किसी जानकारी या प्रबंध हेतु संपर्क करें', gu: 'કોઈ જાણકારી કે આયોજન માટે સંપર્ક કરો' },
    { sel: '.foot__phone-name',  match: 'SureshKumar',  hi: 'सुरेशकुमार ठक्कर', gu: 'સુરેશકુમાર ઠક્કર' },
    { sel: '.foot__phone-name',  match: 'BharatKumar',  hi: 'भरत ठक्कर', gu: 'ભરત ઠક્કર' },
    { sel: '.foot__phone-name',  match: 'Shekhar',      hi: 'शेखर ठक्कर', gu: 'શેખર ઠક્કર' },
    { sel: '.foot__phone-name',  match: 'Harsh Thakkar',   hi: 'हर्ष ठक्कर', gu: 'હર્ષ ઠક્કર' },
    { sel: '.foot__phone-name',  match: 'Nimesh Thakkar',  hi: 'निमेश ठक्कर', gu: 'નિમેશ ઠક્કર' },
    { sel: '.foot__phone-name',  match: 'Niraj Thakkar',   hi: 'नीरज ठक्कर', gu: 'નીરજ ઠક્કર' },
    { sel: '.foot__small',  match: 'Made with love',     hi: 'प्रेम से निर्मित ·', gu: 'પ્રેમથી બનાવ્યું ·' },
    { sel: '#replayBtn',    match: 'Replay invitation',  hi: 'निमंत्रण फिर चलाएँ', gu: 'નિમંત્રણ ફરી ચલાવો' },
  ];

  const touched = [];
  const ORDER = ['en', 'hi', 'gu'];
  let cur = 'en';

  /* into a language: match each rule on the pristine English text, store the
     untouched markup, swap it */
  function applyFor(lang) {
    for (const rule of RULES) {
      for (const el of document.querySelectorAll(rule.sel)) {
        if (el.__npLang) continue;                      // one rule per element
        if (!norm(el.textContent).includes(rule.match)) continue;

        let rec = null;
        if (rule.html) {
          rec = { el, html: el.innerHTML };
          el.innerHTML = rule[lang];
        } else {
          const node = Array.from(el.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
          if (!node) continue;                          // nothing to translate here
          rec = { el, node, text: node.textContent };
          node.textContent = rule[lang];
        }
        el.__npLang = true;
        touched.push(rec);
      }
    }
  }

  /* to English (or back to pristine before another language): put every
     remembered element back exactly as it was */
  function applyEn() {
    for (const rec of touched) {
      if (rec.node) rec.node.textContent = rec.text;
      else rec.el.innerHTML = rec.html;
      rec.el.__npLang = false;
    }
    touched.length = 0;
  }

  btn.addEventListener('click', () => {
    /* the cycle is English → हिन्दी → ગુજરાતી → English. Rules match against
       the English text, so every switch passes through the pristine card. */
    const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
    applyEn();
    if (next !== 'en') applyFor(next);
    cur = next;

    document.documentElement.lang = cur;
    document.documentElement.classList.toggle('hi', cur === 'hi');   // drives the Devanagari font rules
    document.documentElement.classList.toggle('gu', cur === 'gu');   // …and the Gujarati ones
    document.title = TITLES[cur];
    btn.textContent = NEXT_LABEL[cur];
    btn.setAttribute('aria-label',
      'Show the invitation in ' + ({ en: 'English', hi: 'Hindi', gu: 'Gujarati' }[cur]));

  });
})();
