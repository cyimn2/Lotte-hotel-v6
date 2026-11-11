/* Lotte Hotels & Resorts — fullpage motion flow
   One wheel / swipe / key press = one step. Text enters and leaves with a blur. */
(() => {
  const root = document.documentElement;
  const body = document.body;
  const TOTAL = 12; // 0 intro · 1-3 moments · 4-7 brands · 8 offers · 9 rewards · 10 experience · 11 footer

  /* ---------- 1. scale the 1920×1080 canvas to the viewport ---------- */
  // Desktop: 1920×1080 canvas. Mobile (portrait / narrow): 430-wide canvas, height follows the screen.
  function fit() {
    const W = window.innerWidth, H = window.innerHeight;
    const mobile = W < 768 && H > W * 1.1;
    body.classList.toggle('is-mobile', mobile);
    root.classList.toggle('is-mobile-root', mobile);
    const ms = document.getElementById('msite');
    if (ms) ms.style.zoom = mobile ? W / 375 : '';
    // never enlarge past the 1920×1080 design: big monitors get more background, not bigger content
    const s = mobile ? W / 430 : Math.min(W / 1920, H / 1080, 1);
    const sw = W / s, sh = H / s;
    root.style.setProperty('--s', s);
    root.style.setProperty('--sw', sw);
    root.style.setProperty('--sh', sh);
    root.style.setProperty('--ox', mobile ? 0 : (sw - 1920) / 2);
    root.style.setProperty('--oy', mobile ? 0 : (sh - 1080) / 2);
  }
  fit();
  window.addEventListener('resize', fit);

  /* ---------- 2. split text into blur pieces ---------- */
  function splitChars(el) {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          [...child.textContent].forEach(c => {
            if (c === '\n') return;
            const sp = document.createElement('span');
            sp.className = 'ch bp';
            sp.textContent = c;
            sp.style.setProperty('--i', i++);
            frag.appendChild(sp);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
  }
  document.querySelectorAll('[data-split]').forEach(el => {
    const mode = el.dataset.split;
    if (mode === 'chars') splitChars(el);
    else if (mode === 'lines') el.querySelectorAll('.ln').forEach((l, i) => { l.classList.add('bp'); l.style.setProperty('--i', i); });
    else if (mode === 'items') [...el.children].forEach((c, i) => { c.classList.add('bp'); c.style.setProperty('--i', i); });
    else if (mode === 'self') el.classList.add('bp');
    // data-random: every piece gets its own random delay instead of left-to-right order
    if (el.hasAttribute('data-random')) {
      el.querySelectorAll('.bp').forEach(p => {
        if (p.textContent.trim()) p.style.setProperty('--i', (Math.random() * 30).toFixed(2));
      });
    }
  });

  /* ---------- 3. which steps each .anim belongs to ---------- */
  const parseSteps = str => {
    const set = new Set();
    str.split(',').forEach(part => {
      const [a, b] = part.split('-').map(Number);
      for (let n = a; n <= (isNaN(b) ? a : b); n++) set.add(n);
    });
    return set;
  };
  const anims = [...document.querySelectorAll('.stage .anim')].map(el => ({ el, steps: parseSteps(el.dataset.steps) }));
  const slides = [...document.querySelectorAll('.stage .bslide')];

  /* ---------- 4. clock: the visitor's current local time, ticking ---------- */
  const cells = [];
  document.querySelectorAll('.clock .cg').forEach(g => {
    for (let k = 0; k < 2; k++) {
      const cd = document.createElement('span');
      cd.className = 'cd';
      g.appendChild(cd);
      cells.push(cd);
    }
  });
  function setDigit(cd, ch) {
    const cur = cd.querySelector('span:not(.out)');
    if (cur && cur.textContent === ch) return;
    if (cur) {
      cur.classList.add('out');
      setTimeout(() => cur.remove(), 750);
    }
    const sp = document.createElement('span');
    sp.className = 'in';
    sp.textContent = ch;
    cd.appendChild(sp);
    requestAnimationFrame(() => requestAnimationFrame(() => sp.classList.remove('in')));
  }
  const nowDigits = () => {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join('');
  };
  function renderClock() { [...nowDigits()].forEach((c, i) => setDigit(cells[i], c)); }
  renderClock();
  // tick exactly on each second boundary so the seconds change in step with the system clock
  (function tick() { renderClock(); setTimeout(tick, 1000 - (Date.now() % 1000) + 5); })();

  /* ---------- 5. step machine ---------- */
  let cur = -1, locked = false;

  function enterDelay(prev, next) {
    if (prev < 0) return .25;
    if (prev === 0 && next === 1) return 1.05;  // intro groups lift away first
    if (prev <= 3 && next === 4) return 1.6;    // panel expands → blurs → dark + card slide in, then copy
    if (prev === 4 && next === 3) return .75;
    if (next === 11) return 0;
    if (prev === 11) return .2;
    if (next >= 8 || prev >= 8) return .55;
    return .45;
  }

  /* v5: reservation-prompt colour follows the background actually behind it.
     Each scene declares its tone; the switch is delayed to the moment the
     incoming background reaches the top-right corner (wipes / slides). */
  // v6: moment 2 (grey vase wall behind the prompt, Figma 165:1282) is dark too
  const toneOf = s => s === 1 || s === 2 || (s >= 4 && s <= 7) || s === 11 ? 'dark' : 'light';   // 1 vase, 2 bed: white prompt
  function toneDelay(prev, next) {
    if (prev < 0) return 0;
    if (prev === 0 && next === 1) return 1.9;   // panel rises, then opens up to the top-right corner
    if (prev === 1 && next === 0) return .3;
    if (next === 2 && (prev === 1 || prev === 3)) return prev === 1 ? .35 : 1.05;  // image enters from the right (fast to the corner) / from the left (late)
    if (prev === 2 && (next === 1 || next === 3)) return next === 3 ? .35 : 1.05;
    if (prev <= 3 && next >= 4 && next <= 7) return prev === 0 ? .9 : .75;   // dark wipe enters from the right
    if (prev >= 4 && prev <= 7 && next <= 3) return .35;                     // dark wipe leaves
    if (prev >= 4 && prev <= 7 && next >= 8) return next === 11 ? 0 : .95;   // light page slides up, covers the top last
    if (prev >= 8 && next >= 4 && next <= 7) return .15;                     // page slides away, dark shows at the top first
    return 0;                                                                // footer dim / same-tone moves
  }
  function setTone(prev, next) {
    const dark = toneOf(next) === 'dark';
    if (dark === body.classList.contains('tone-dark')) return;
    root.style.setProperty('--tone-delay', toneDelay(prev, next) + 's');
    body.classList.toggle('tone-dark', dark);
  }

  function go(next) {
    next = Math.max(0, Math.min(TOTAL - 1, next));
    if (next === cur || locked) return;
    const prev = cur;
    cur = next;

    root.style.setProperty('--enter', enterDelay(prev, next) + 's');
    body.className = body.className.replace(/\b(s-\d+|g-\w+)\b/g, '').trim();
    body.classList.add('s-' + next,
      next === 0 ? 'g-intro' : next <= 3 ? 'g-moment' : next <= 7 ? 'g-brand' : 'g-pages');
    body.dataset.dir = next > prev ? 'down' : 'up';
    setTone(prev, next);
    document.dispatchEvent(new CustomEvent('step', { detail: { prev, next } }));
    // one-off entrance choreographies
    body.classList.toggle('enter-moment', prev === 0 && next === 1);
    body.classList.toggle('enter-brand', prev >= 0 && prev <= 3 && next === 4);
    // leaving the brand section back to the light scenes (scroll up or menu jump):
    // the card must exit with the dark wipe instead of lingering over the light page
    body.classList.toggle('leave-brand', prev >= 4 && prev <= 7 && next <= 3);

    const slidesOn = slides.map(el => el.classList.contains('on'));
    anims.forEach(({ el, steps }) => {
      if (steps.has(next)) { el.classList.remove('off'); el.classList.add('on'); }
      else if (el.classList.contains('on')) { el.classList.remove('on'); el.classList.add('off'); }
    });
    // v5: scrolling back mirrors the image change — the incoming image enters from the LEFT edge
    if (prev >= 0 && next < prev) slides.forEach((el, i) => {
      if (slidesOn[i] || !el.classList.contains('on')) return;
      el.style.transition = 'none';
      el.style.transform = 'translateX(-100%)';
      void el.offsetWidth;            // commit the left-hand start position
      el.style.transition = '';
      el.style.transform = '';
    });

    resetLists();

    const big = (prev === 3 && next === 4) || (prev === 4 && next === 3);
    locked = true;
    setTimeout(() => { locked = false; }, prev < 0 ? 600 : big ? 2100 : (prev === 0 && next === 1) ? 1900 : 1350);
  }
  const next = () => go(cur + 1);
  const prevStep = () => go(cur - 1);

  /* ---------- 6. input: wheel (one gesture = one step), touch, keys ---------- */
  let lastWheel = 0;
  const isMobile = () => body.classList.contains('is-mobile');
  window.addEventListener('wheel', e => {
    if (isMobile()) return; // mobile = native scroll page
    if (body.classList.contains('menu-open')) return;
    const list = e.target.closest && e.target.closest('.b-list');
    if (list && list.classList.contains('on') && list.scrollHeight > list.clientHeight + 2) {
      const atTop = list.scrollTop <= 0, atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) return; // let the hotel list scroll
    }
    e.preventDefault();
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (Math.abs(e.deltaY) < 4 || gap < 160) return; // inertia tail of the same gesture
    e.deltaY > 0 ? next() : prevStep();
  }, { passive: false });

  let ty = null, tx = null, tList = null;
  window.addEventListener('touchstart', e => {
    if (isMobile()) { ty = null; return; }
    ty = e.touches[0].clientY; tx = e.touches[0].clientX;
    const l = e.target.closest && e.target.closest('.b-list');
    tList = l && l.classList.contains('on') && l.scrollHeight > l.clientHeight + 2 ? l : null;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (isMobile()) return;
    if (!tList) e.preventDefault(); // stop pull-to-refresh / rubber-band
  }, { passive: false });
  window.addEventListener('touchend', e => {
    if (ty === null || body.classList.contains('menu-open')) { ty = null; return; }
    const dy = ty - e.changedTouches[0].clientY;
    const dx = tx - e.changedTouches[0].clientX;
    ty = null;
    if (tList) {
      // a swipe inside the hotel list scrolls the list; only page-turn once it hits its end
      const atTop = tList.scrollTop <= 0, atBottom = tList.scrollTop + tList.clientHeight >= tList.scrollHeight - 1;
      if ((dy > 0 && !atBottom) || (dy < 0 && !atTop)) return;
    }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && cur >= 4 && cur <= 7) {
      return dx > 0 ? go(Math.min(7, cur + 1)) : go(Math.max(4, cur - 1)); // swipe between brands
    }
    if (Math.abs(dy) > 50) dy > 0 ? next() : prevStep();
  }, { passive: true });

  window.addEventListener('keydown', e => {
    if (isMobile()) return;
    if (e.key === 'Escape') return toggleMenu(false);
    if (body.classList.contains('menu-open')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prevStep(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(TOTAL - 1);
    else if (cur >= 4 && cur <= 7 && e.key === 'ArrowRight') go(Math.min(7, cur + 1));
    else if (cur >= 4 && cur <= 7 && e.key === 'ArrowLeft') go(Math.max(4, cur - 1));
  });

  /* ---------- 7. UI bits ---------- */
  // v6: on the hotel-brand pages the arrow skips the remaining brands and goes straight to room package & offers
  document.querySelector('.down').addEventListener('click', () => (cur >= 4 && cur <= 7 ? go(8) : next()));
  document.querySelector('.b-prev').addEventListener('click', () => cur > 4 && go(cur - 1));
  document.querySelector('.b-next').addEventListener('click', () => go(cur < 7 ? cur + 1 : 8));
  document.querySelectorAll('a[href="#"]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

  // hotel list scroll indicator
  const thumb = document.querySelector('.b-scroll i');
  const lists = [...document.querySelectorAll('.b-list:not(.b-list--center)')];
  lists.forEach(list => list.addEventListener('scroll', () => {
    const max = list.scrollHeight - list.clientHeight;
    thumb.style.top = (30 + (max > 0 ? list.scrollTop / max : 0) * (458 - 36 - 30)) + 'px';
  }));
  function resetLists() { lists.forEach(l => { if (!l.classList.contains('on')) l.scrollTop = 0; }); thumb.style.top = '30px'; }

  // menu
  const ham = document.querySelector('.ham');
  const menu = document.querySelector('.menu');
  menu.querySelectorAll('li').forEach((li, i) => li.style.setProperty('--i', i));
  function toggleMenu(open = !body.classList.contains('menu-open')) {
    body.classList.toggle('menu-open', open);
    ham.setAttribute('aria-expanded', open);
    ham.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    menu.setAttribute('aria-hidden', !open);
  }
  ham.addEventListener('click', () => toggleMenu());
  menu.querySelector('.menu-dim').addEventListener('click', () => toggleMenu(false));
  document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    toggleMenu(false);
    locked = false;
    setTimeout(() => go(+a.dataset.go), body.classList.contains('menu-open') ? 350 : 0);
  }));

  /* ---------- 8. start once fonts are ready (no flash of fallback glyphs) ---------- */
  /* ---------- 8b. activity slider: cards loop, leaving card blurs out, arriving card blurs in ---------- */
  const xTrack = document.querySelector('.x-track');
  const X_STEP = 400 + 40;   // side card + gap (v6)
  const EASE = 'cubic-bezier(.65,0,.35,1)';
  const blurOut = [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(14px)' }];
  const blurIn = [{ opacity: 0, filter: 'blur(14px)', transform: 'translateX(40px)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }];
  let xBusy = false;
  function slideX(dir) {
    if (xBusy || cur !== 10) return;
    xBusy = true;
    // v6: the card moving into the middle widens to 510 while the old middle one narrows, in step with the slide
    const centre = xTrack.querySelector('.is-center');
    const incoming = dir > 0 ? centre.nextElementSibling : centre.previousElementSibling || xTrack.lastElementChild;
    const swapCentre = () => { centre.classList.remove('is-center'); incoming.classList.add('is-center'); };
    if (dir > 0) swapCentre();
    if (dir > 0) {
      const first = xTrack.firstElementChild;
      first.animate(blurOut, { duration: 500, fill: 'forwards' });
      xTrack.animate([{ transform: 'none' }, { transform: `translateX(-${X_STEP}px)` }], { duration: 900, easing: EASE })
        .onfinish = () => {
          xTrack.appendChild(first);
          first.getAnimations().forEach(a => a.cancel());
          first.animate(blurIn, { duration: 750, easing: 'ease-out' });
          xBusy = false;
        };
    } else {
      const last = xTrack.lastElementChild;
      last.animate(blurOut, { duration: 400, fill: 'forwards' }).onfinish = () => {
        xTrack.prepend(last);
        last.getAnimations().forEach(a => a.cancel());
        swapCentre();
        xTrack.animate([{ transform: `translateX(-${X_STEP}px)` }, { transform: 'none' }], { duration: 900, easing: EASE });
        last.animate(blurIn.map(k => ({ ...k, transform: k.transform === 'none' ? 'none' : 'translateX(-40px)' })), { duration: 900, easing: 'ease-out' })
          .onfinish = () => { xBusy = false; };
      };
    }
  }
  // v5: cards rotate on their own, one card per step; manual arrows / hover pause the rotation
  const X_AUTO = 3800;
  let xTimer = null, xHover = false;
  function scheduleX() {
    clearTimeout(xTimer);
    xTimer = setTimeout(() => {
      if (cur === 10 && !xHover && !document.hidden) slideX(1);
      scheduleX();
    }, X_AUTO);
  }
  scheduleX();
  // entering the activity page: show the design order again and give the entrance time before the first move
  const xOrder = [...xTrack.children];
  document.addEventListener('step', ({ detail: { prev, next } }) => {
    if (next !== 10) return;
    if (prev !== 11 && !xBusy) {
      xOrder.forEach(c => { xTrack.appendChild(c); c.classList.remove('is-center'); });
      xOrder[1].classList.add('is-center');
    }
    scheduleX();
  });
  const xView = document.querySelector('.x-view');
  xView.addEventListener('mouseenter', () => { xHover = true; });
  xView.addEventListener('mouseleave', () => { xHover = false; scheduleX(); });
  document.querySelector('.x-next').addEventListener('click', () => { slideX(1); scheduleX(); });
  document.querySelector('.x-prev').addEventListener('click', () => { slideX(-1); scheduleX(); });

  /* ---------- 9. MOBILE SITE (normal scroll page, Figma "mobile") ---------- */
  const ms = document.getElementById('msite');
  const on = el => { el.classList.remove('off'); el.classList.add('on'); };
  const off = el => { if (el.classList.contains('on')) { el.classList.remove('on'); el.classList.add('off'); } };

  // hero clock
  const mCells = [];
  ms.querySelectorAll('.m-clock .cg').forEach(g => {
    for (let k = 0; k < 2; k++) { const cd = document.createElement('span'); cd.className = 'cd'; g.appendChild(cd); mCells.push(cd); }
  });
  function renderMClock() { [...nowDigits()].forEach((c, i) => setDigit(mCells[i], c)); }
  renderMClock();
  (function mTick() { if (isMobile()) renderMClock(); setTimeout(mTick, 1000 - (Date.now() % 1000) + 5); })();

  // hero slideshow: image wipes in, kicker tense changes (한 → 하는 → 할)
  const heroSlides = [0, 1, 2].map(i => [...ms.querySelectorAll(`.m-hero [data-hs="${i}"]`)]);
  let hs = 0;
  function showHero(i) {
    heroSlides.forEach((els, k) => els.forEach(k === i ? on : off));
  }
  setInterval(() => { if (isMobile() && !document.hidden) { hs = (hs + 1) % 3; showHero(hs); } }, 5200);

  // brand slider
  const panels = [...ms.querySelectorAll('.mb-panel')];
  const bgs = [...ms.querySelectorAll('.mb-bg')];
  const arrows = ms.querySelector('.mb-arrows');
  let bp = -1;
  function showBrand(i) {
    i = (i + panels.length) % panels.length;
    if (i === bp) return;
    panels.forEach((p, k) => {
      p.classList.toggle('is-active', k === i);
      p.querySelectorAll('.anim').forEach(k === i ? on : off);
    });
    bgs.forEach((b, k) => (k === i ? on : off)(b));
    const p = panels[i], row = p.querySelector('.mb-row');
    arrows.style.top = (p.offsetTop + row.offsetTop + 12.5) + 'px'; // arrows sit on the button row
    bp = i;
  }
  ms.querySelector('.mb-prev').addEventListener('click', () => showBrand(bp - 1));
  ms.querySelector('.mb-next').addEventListener('click', () => showBrand(bp + 1));
  let sx = null, sy = null;
  const brand = ms.querySelector('.m-brand');
  brand.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  brand.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = sx - e.changedTouches[0].clientX, dy = sy - e.changedTouches[0].clientY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showBrand(bp + (dx > 0 ? 1 : -1));
    sx = null;
  }, { passive: true });

  // scroll reveal (blur in once, when the block enters the screen)
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target;
    const track = el.closest('.mx-track, .mp-track');
    if (el.classList.contains('m-brand')) { showBrand(Math.max(bp, 0)); el.querySelector('.mbox-d').classList.add('in'); }
    else if (track) [...track.children].forEach(c => { on(c); io.unobserve(c); }); // peeking cards come in with the visible one
    else on(el);
    io.unobserve(el);
  }), { threshold: .2 });
  ms.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
  io.observe(brand);

  // experience: start with the middle card centred, dim the side ones
  const xt = ms.querySelector('.mx-track');
  const xCards = [...xt.children];
  function centreCard(i) { const c = xCards[i]; xt.scrollLeft = c.offsetLeft - (xt.clientWidth - c.offsetWidth) / 2; }
  function dimSides() {
    const mid = xt.scrollLeft + xt.clientWidth / 2;
    xCards.forEach(c => c.classList.toggle('dim', Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) > 40));
  }
  xt.addEventListener('scroll', dimSides, { passive: true });

  // menu
  const mMenu = ms.querySelector('.m-menu');
  mMenu.querySelectorAll('li').forEach((li, i) => li.style.setProperty('--i', i));
  const mToggle = open => { body.classList.toggle('m-menu-open', open); mMenu.setAttribute('aria-hidden', !open); };
  ms.querySelector('.m-ham').addEventListener('click', () => mToggle(true));
  ms.querySelector('.m-close').addEventListener('click', () => mToggle(false));
  mMenu.querySelectorAll('.mm-main a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); mToggle(false);
    document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
  }));
  ms.querySelector('.mh-down').addEventListener('click', e => { e.preventDefault(); brand.scrollIntoView({ behavior: 'smooth' }); });

  function startMobile() {
    ms.querySelectorAll('[data-hero-title]').forEach(on);
    showHero(0);
    centreCard(1); dimSides();
    setTimeout(() => ms.querySelector('.m-hero-img').classList.add('ready'), 2600);
    setTimeout(() => ms.querySelectorAll('.m-hero .mbox').forEach(b => b.classList.add('in')), 1100);
  }

  const startAt = Math.max(0, Math.min(TOTAL - 1, parseInt(location.hash.slice(1), 10) || 0));
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))])
    .then(() => requestAnimationFrame(() => { go(startAt); startMobile(); }));
})();
