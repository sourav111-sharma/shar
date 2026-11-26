/* =========================================================================
   LUMINA — INTERACTIVE MIRRORS & LENSES STUDIO
   Interactive Optics Simulation, Ray-Tracing & Gamification Engine
   ========================================================================= */
(() => {
  'use strict';

  /* -----------------------------------------------------------------------
     1. SOUND SYNTHESIZER, XP/RANK SYSTEM & TOASTS
     ----------------------------------------------------------------------- */
  const state = {
    xp: 0,
    soundOn: true,
    heroMode: 'biconvex',
    heroOrb: { x: 150, y: 145, dragging: false },
    heroPulse: 0,
    ruleDevice: 'concave_mirror',
    rulePhotonAnim: [0, 0, 0],
    lab: {
      device: 'concave_mirror',
      objType: 'candle',
      u: 240,
      f: 100,
      h: 70,
      infinity: false,
      rainbow: false,
      wavefronts: false,
      draggingObj: false,
      draggingTip: false,
      draggingFocus: false
    },
    missionsDone: new Set(),
    puzzlesCleared: new Set(),
    puzzleLevel: 0
  };

  let audioCtx = null;
  function playTone(freq = 520, duration = 0.14, type = 'sine', gainVal = 0.08) {
    if (!state.soundOn) return;
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, audioCtx.currentTime + duration);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  const RANKS = [
    { min: 0, name: 'Novice' },
    { min: 100, name: 'Ray Tracer' },
    { min: 250, name: 'Lens Crafter' },
    { min: 450, name: 'Photon Master' },
    { min: 700, name: 'Grand Optician' }
  ];

  function showToast(title, body, color = '#00e5ff') {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const card = document.createElement('div');
    card.className = 'toast-card pointer-events-auto glass-card rounded-2xl px-4 py-3 max-w-xs border-l-4 shadow-xl';
    card.style.borderLeftColor = color;
    card.innerHTML = `
      <div class="font-extrabold text-xs sm:text-sm" style="color:${color}">${title}</div>
      <div class="text-xs text-slate-200 mt-0.5">${body}</div>
    `;
    stack.appendChild(card);
    setTimeout(() => {
      card.style.opacity = '0';
      card.style.transform = 'translateX(30px)';
      card.style.transition = 'all 0.3s ease';
      setTimeout(() => card.remove(), 320);
    }, 3200);
  }

  function addXP(amount, reason) {
    const prevRank = RANKS.filter(r => state.xp >= r.min).pop().name;
    state.xp += amount;
    const currRankObj = RANKS.filter(r => state.xp >= r.min).pop();
    const nextRankObj = RANKS.find(r => r.min > state.xp) || { min: 1000 };
    document.getElementById('xpCounter').textContent = state.xp;
    document.getElementById('rankTitle').textContent = currRankObj.name;
    const pct = Math.min(100, Math.max(8, ((state.xp - currRankObj.min) / (nextRankObj.min - currRankObj.min)) * 100));
    document.getElementById('rankBarFill').style.width = pct + '%';

    if (reason) {
      showToast(`+${amount} XP Earned!`, reason, '#fbbf24');
      playTone(620, 0.16, 'triangle', 0.08);
    }
    if (currRankObj.name !== prevRank) {
      launchConfetti();
      showToast('🏆 Rank Promoted!', `You are now a ${currRankObj.name}!`, '#00e5ff');
    }
  }

  /* -----------------------------------------------------------------------
     2. AMBIENT FLOATING LIGHT MOTES & CONFETTI CELEBRATION
     ----------------------------------------------------------------------- */
  const motesCanvas = document.getElementById('motesCanvas');
  const motesCtx = motesCanvas.getContext('2d');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const confettiCtx = confettiCanvas.getContext('2d');
  let motes = [];
  let confettiPieces = [];

  function resizeGlobalCanvases() {
    motesCanvas.width = window.innerWidth;
    motesCanvas.height = window.innerHeight;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeGlobalCanvases);
  resizeGlobalCanvases();

  const MOTE_COLORS = ['#00e5ff', '#fbbf24', '#ff2e93', '#10b981'];
  for (let i = 0; i < 42; i++) {
    motes.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1.2 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.15 - Math.random() * 0.35,
      color: MOTE_COLORS[i % MOTE_COLORS.length],
      alpha: 0.25 + Math.random() * 0.45
    });
  }

  function launchConfetti() {
    for (let i = 0; i < 95; i++) {
      confettiPieces.push({
        x: window.innerWidth * (0.25 + Math.random() * 0.5),
        y: window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 11,
        vy: -4 - Math.random() * 9,
        size: 5 + Math.random() * 6,
        color: MOTE_COLORS[i % MOTE_COLORS.length],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.25,
        life: 110
      });
    }
  }

  /* -----------------------------------------------------------------------
     3. HERO INTERACTIVE OPTICAL CAVITY CANVAS
     ----------------------------------------------------------------------- */
  const heroCanvas = document.getElementById('heroArrayCanvas');
  const heroCtx = heroCanvas.getContext('2d');

  function drawHeroCanvas(t) {
    const w = heroCanvas.width;
    const h = heroCanvas.height;
    heroCtx.clearRect(0, 0, w, h);

    heroCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    heroCtx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 32) {
      heroCtx.beginPath(); heroCtx.moveTo(gx, 0); heroCtx.lineTo(gx, h); heroCtx.stroke();
    }
    for (let gy = 0; gy < h; gy += 32) {
      heroCtx.beginPath(); heroCtx.moveTo(0, gy); heroCtx.lineTo(w, gy); heroCtx.stroke();
    }

    heroCtx.save();
    heroCtx.setLineDash([6, 6]);
    heroCtx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    heroCtx.beginPath();
    heroCtx.moveTo(20, h / 2);
    heroCtx.lineTo(w - 20, h / 2);
    heroCtx.stroke();
    heroCtx.restore();

    const lensX = w * 0.52;
    const orb = state.heroOrb;

    if (state.heroMode === 'biconvex' || state.heroMode === 'twin_focus') {
      const positions = state.heroMode === 'twin_focus' ? [w * 0.44, w * 0.64] : [lensX];
      positions.forEach((lx, idx) => {
        heroCtx.save();
        const grad = heroCtx.createLinearGradient(lx - 22, 0, lx + 22, 0);
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.14)');
        grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.34)');
        grad.addColorStop(1, 'rgba(0, 229, 255, 0.14)');
        heroCtx.fillStyle = grad;
        heroCtx.strokeStyle = idx === 0 ? '#00e5ff' : '#fbbf24';
        heroCtx.lineWidth = 2.5;
        heroCtx.beginPath();
        heroCtx.moveTo(lx, 48);
        heroCtx.quadraticCurveTo(lx + 34, h / 2, lx, h - 48);
        heroCtx.quadraticCurveTo(lx - 34, h / 2, lx, 48);
        heroCtx.fill();
        heroCtx.stroke();
        heroCtx.restore();
      });
    } else {
      heroCtx.save();
      heroCtx.fillStyle = 'rgba(255, 46, 147, 0.2)';
      heroCtx.strokeStyle = '#ff2e93';
      heroCtx.lineWidth = 2.5;
      heroCtx.beginPath();
      heroCtx.moveTo(lensX - 22, 52);
      heroCtx.lineTo(lensX + 22, 52);
      heroCtx.quadraticCurveTo(lensX + 6, h / 2, lensX + 22, h - 52);
      heroCtx.lineTo(lensX - 22, h - 52);
      heroCtx.quadraticCurveTo(lensX - 6, h / 2, lensX - 22, 52);
      heroCtx.fill();
      heroCtx.stroke();
      heroCtx.restore();
    }

    const rayCount = 7;
    const rainbow = ['#ff2e93', '#fb923c', '#fbbf24', '#10b981', '#00e5ff', '#38bdf8', '#a855f7'];
    const f = 140;
    const u = Math.max(45, lensX - orb.x);

    for (let i = 0; i < rayCount; i++) {
      const frac = (i / (rayCount - 1)) * 2 - 1;
      const hitY = h / 2 + frac * 115;
      const color = state.heroMode === 'diverging' ? rainbow[i] : (i % 2 === 0 ? '#00e5ff' : '#fbbf24');

      heroCtx.save();
      heroCtx.strokeStyle = color;
      heroCtx.shadowColor = color;
      heroCtx.shadowBlur = 10;
      heroCtx.lineWidth = 2.2;

      heroCtx.beginPath();
      heroCtx.moveTo(orb.x, orb.y);
      heroCtx.lineTo(lensX, hitY);

      if (state.heroMode === 'biconvex') {
        const v = (u * f) / (u - f);
        const imgX = lensX + (v > 0 ? Math.min(280, v) : 260);
        const imgY = h / 2 - ((orb.y - h / 2) * (v / u));
        const slope = (imgY - hitY) / (imgX - lensX);
        heroCtx.lineTo(w - 12, hitY + slope * (w - 12 - lensX));
      } else if (state.heroMode === 'twin_focus') {
        const l2 = w * 0.64;
        const midY = h / 2 + (hitY - h / 2) * 0.45;
        heroCtx.lineTo(l2, midY);
        heroCtx.lineTo(w - 15, h / 2 + (midY - h / 2) * -0.35);
      } else {
        const spread = (hitY - h / 2) * 1.65 + (hitY - orb.y) * 0.35;
        heroCtx.lineTo(w - 12, hitY + spread);
      }
      heroCtx.stroke();
      heroCtx.restore();
    }

    if (state.heroPulse > 0) {
      heroCtx.save();
      heroCtx.strokeStyle = `rgba(0, 229, 255, ${state.heroPulse / 60})`;
      heroCtx.lineWidth = 3;
      heroCtx.beginPath();
      heroCtx.arc(orb.x, orb.y, (60 - state.heroPulse) * 7.5, 0, Math.PI * 2);
      heroCtx.stroke();
      heroCtx.restore();
      state.heroPulse--;
    }

    const glow = heroCtx.createRadialGradient(orb.x, orb.y, 2, orb.x, orb.y, 26);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.35, '#fbbf24');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    heroCtx.fillStyle = glow;
    heroCtx.beginPath();
    heroCtx.arc(orb.x, orb.y, 26 + Math.sin(t * 0.006) * 2, 0, Math.PI * 2);
    heroCtx.fill();
  }

  heroCanvas.addEventListener('pointerdown', (e) => {
    const rect = heroCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (heroCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (heroCanvas.height / rect.height);
    state.heroOrb.dragging = true;
    state.heroOrb.x = Math.min(heroCanvas.width * 0.42, Math.max(30, sx));
    state.heroOrb.y = Math.min(heroCanvas.height - 30, Math.max(30, sy));
  });
  window.addEventListener('pointermove', (e) => {
    if (!state.heroOrb.dragging) return;
    const rect = heroCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (heroCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (heroCanvas.height / rect.height);
    state.heroOrb.x = Math.min(heroCanvas.width * 0.42, Math.max(30, sx));
    state.heroOrb.y = Math.min(heroCanvas.height - 30, Math.max(30, sy));
  });
  window.addEventListener('pointerup', () => { state.heroOrb.dragging = false; });

  document.querySelectorAll('.hero-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.heroMode = btn.dataset.heroMode;
      document.querySelectorAll('.hero-mode-btn').forEach(b => {
        b.className = 'hero-mode-btn px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white transition';
      });
      btn.className = 'hero-mode-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#00e5ff] text-[#050814] transition';
      playTone(540, 0.12);
    });
  });

  document.getElementById('pulseWaveBtn').addEventListener('click', () => {
    state.heroPulse = 60;
    playTone(740, 0.22, 'sine', 0.09);
    addXP(10, 'Triggered a Photon Pulse Wave!');
  });

  /* -----------------------------------------------------------------------
     4. SECTION 1: THE 3 GOLDEN RULES MINI-CANVASES
     ----------------------------------------------------------------------- */
  const RULE_COPY = {
    concave_mirror: {
      tag1: 'Pole (P) Bounce',
      t0: 'Travels <strong class="text-[#fbbf24]">parallel</strong> to the principal axis, then reflects straight through the real <strong class="text-[#00e5ff]">Focus (F)</strong>.',
      t1: 'Strikes the center <strong class="text-[#ff2e93]">Pole (P)</strong> and bounces off symmetrically at the exact same angle.',
      t2: 'Passes through the <strong class="text-[#00e5ff]">Focus (F)</strong> first, then reflects strictly <strong class="text-[#fbbf24]">parallel</strong> to the axis.'
    },
    convex_mirror: {
      tag1: 'Pole (P) Bounce',
      t0: 'Travels <strong class="text-[#fbbf24]">parallel</strong>, then diverges outward as if coming from the virtual <strong class="text-[#00e5ff]">Focus (F)</strong> behind the mirror.',
      t1: 'Strikes the center <strong class="text-[#ff2e93]">Pole (P)</strong> and reflects symmetrically at an equal angle.',
      t2: 'Heads toward the virtual <strong class="text-[#00e5ff]">Focus (F)</strong>, then bounces back strictly <strong class="text-[#fbbf24]">parallel</strong> to the axis.'
    },
    convex_lens: {
      tag1: 'Optical Center (O)',
      t0: 'Enters <strong class="text-[#fbbf24]">parallel</strong> to the axis and refracts straight through the far <strong class="text-[#00e5ff]">Focus (F₂)</strong>.',
      t1: 'Passes straight through the <strong class="text-[#ff2e93]">Optical Center (O)</strong> with zero deviation!',
      t2: 'Passes through the near <strong class="text-[#00e5ff]">Focus (F₁)</strong> first, then exits the lens <strong class="text-[#fbbf24]">parallel</strong>.'
    },
    concave_lens: {
      tag1: 'Optical Center (O)',
      t0: 'Enters <strong class="text-[#fbbf24]">parallel</strong> and bends outward so its dashed backward trace meets the near <strong class="text-[#00e5ff]">Focus (F₁)</strong>.',
      t1: 'Passes straight through the <strong class="text-[#ff2e93]">Optical Center (O)</strong> without bending!',
      t2: 'Aims toward the far <strong class="text-[#00e5ff]">Focus (F₂)</strong>, then refracts out strictly <strong class="text-[#fbbf24]">parallel</strong>.'
    }
  };

  function updateRuleCopy() {
    const cfg = RULE_COPY[state.ruleDevice];
    document.getElementById('ruleTag1').textContent = cfg.tag1;
    document.getElementById('ruleText0').innerHTML = cfg.t0;
    document.getElementById('ruleText1').innerHTML = cfg.t1;
    document.getElementById('ruleText2').innerHTML = cfg.t2;
  }

  document.querySelectorAll('.rule-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ruleDevice = btn.dataset.ruleDevice;
      document.querySelectorAll('.rule-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateRuleCopy();
      state.rulePhotonAnim = [1, 1, 1];
      playTone(580, 0.12);
    });
  });

  document.querySelectorAll('[data-fire-rule]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.fireRule);
      state.rulePhotonAnim[idx] = 1;
      playTone(500 + idx * 120, 0.18, 'triangle', 0.08);
      addXP(5);
    });
  });

  function drawRuleCard(idx) {
    const canvas = document.getElementById(`ruleCanvas${idx}`);
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const midY = h / 2;
    const dev = state.ruleDevice;
    const isMirror = dev.includes('mirror');
    const cx = isMirror ? 205 : 145;
    const fDist = 52;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(10, midY); ctx.lineTo(w - 10, midY); ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineWidth = 3;
    if (dev === 'concave_mirror') {
      ctx.strokeStyle = '#00e5ff';
      ctx.beginPath(); ctx.arc(cx - 75, midY, 80, -0.62, 0.62); ctx.stroke();
    } else if (dev === 'convex_mirror') {
      ctx.strokeStyle = '#ff2e93';
      ctx.beginPath(); ctx.arc(cx + 75, midY, 80, Math.PI - 0.62, Math.PI + 0.62); ctx.stroke();
    } else if (dev === 'convex_lens') {
      ctx.strokeStyle = '#fbbf24';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
      ctx.beginPath();
      ctx.moveTo(cx, 22);
      ctx.quadraticCurveTo(cx + 18, midY, cx, h - 22);
      ctx.quadraticCurveTo(cx - 18, midY, cx, 22);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.strokeStyle = '#10b981';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
      ctx.beginPath();
      ctx.moveTo(cx - 10, 22); ctx.lineTo(cx + 10, 22);
      ctx.quadraticCurveTo(cx + 3, midY, cx + 10, h - 22);
      ctx.lineTo(cx - 10, h - 22);
      ctx.quadraticCurveTo(cx - 3, midY, cx - 10, 22);
      ctx.fill(); ctx.stroke();
    }

    const drawDot = (x, label) => {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath(); ctx.arc(x, midY, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillText(label, x - 4, midY + 14);
    };
    if (dev === 'concave_mirror') drawDot(cx - fDist, 'F');
    else if (dev === 'convex_mirror') drawDot(cx + fDist, 'F');
    else { drawDot(cx - fDist, 'F₁'); drawDot(cx + fDist, 'F₂'); }

    const objX = 48;
    const topY = 44;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(objX, midY); ctx.lineTo(objX, topY); ctx.stroke();

    const colors = ['#fbbf24', '#ff2e93', '#00e5ff'];
    const col = colors[idx];
    let pts = [];
    let dashed = null;

    if (idx === 0) {
      pts.push([objX, topY], [cx, topY]);
      if (dev === 'concave_mirror') {
        const slope = (midY - topY) / (-fDist);
        pts.push([20, topY + slope * (20 - cx)]);
      } else if (dev === 'convex_mirror') {
        const slope = (topY - midY) / (-fDist);
        pts.push([20, topY + slope * (20 - cx)]);
        dashed = [[cx, topY], [cx + fDist, midY]];
      } else if (dev === 'convex_lens') {
        const slope = (midY - topY) / fDist;
        pts.push([w - 15, topY + slope * (w - 15 - cx)]);
      } else {
        const slope = (topY - midY) / fDist;
        pts.push([w - 15, topY + slope * (w - 15 - cx)]);
        dashed = [[cx, topY], [cx - fDist, midY]];
      }
    } else if (idx === 1) {
      pts.push([objX, topY], [cx, midY]);
      if (isMirror) {
        pts.push([objX, h - topY]);
      } else {
        const slope = (midY - topY) / (cx - objX);
        pts.push([w - 15, midY + slope * (w - 15 - cx)]);
      }
    } else {
      if (dev === 'concave_mirror') {
        const fX = cx - fDist;
        const slope = (midY - topY) / (fX - objX);
        const hitY = Math.min(h - 20, topY + slope * (cx - objX));
        pts.push([objX, topY], [cx, hitY], [20, hitY]);
      } else if (dev === 'convex_mirror') {
        const fX = cx + fDist;
        const slope = (midY - topY) / (fX - objX);
        const hitY = topY + slope * (cx - objX);
        pts.push([objX, topY], [cx, hitY], [20, hitY]);
        dashed = [[cx, hitY], [fX, midY]];
      } else if (dev === 'convex_lens') {
        const fX = cx - fDist;
        const slope = (midY - topY) / (fX - objX);
        const hitY = Math.min(h - 20, topY + slope * (cx - objX));
        pts.push([objX, topY], [cx, hitY], [w - 15, hitY]);
      } else {
        const fX = cx + fDist;
        const slope = (midY - topY) / (fX - objX);
        const hitY = topY + slope * (cx - objX);
        pts.push([objX, topY], [cx, hitY], [w - 15, hitY]);
        dashed = [[cx, hitY], [fX, midY]];
      }
    }

    if (dashed) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(dashed[0][0], dashed[0][1]);
      ctx.lineTo(dashed[1][0], dashed[1][1]);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.restore();

    if (state.rulePhotonAnim[idx] > 0) {
      const p = 1 - state.rulePhotonAnim[idx];
      const seg = p < 0.5 ? 0 : 1;
      const localT = (p % 0.5) * 2;
      const ax = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * localT;
      const ay = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * localT;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ax, ay, 5, 0, Math.PI * 2); ctx.fill();
      state.rulePhotonAnim[idx] = Math.max(0, state.rulePhotonAnim[idx] - 0.024);
    }
  }

  /* -----------------------------------------------------------------------
     5. SECTION 2: THE GIANT OPTICAL BENCH (1280x540 INTERACTIVE PHYSICS)
     ----------------------------------------------------------------------- */
  const benchCanvas = document.getElementById('benchCanvas');
  const benchCtx = benchCanvas.getContext('2d');

  const OBJ_EMOJIS = {
    candle: '🕯️',
    rocket: '🚀',
    duck: '🦆',
    pencil: '✏️',
    butterfly: '🦋',
    diamond: '💎'
  };

  function getOpticCenterX() {
    return state.lab.device.includes('mirror') ? 780 : 640;
  }

  function computeOptics() {
    const { device, u, f, h, infinity } = state.lab;
    const isMirror = device.includes('mirror');
    const isConverging = device === 'concave_mirror' || device === 'convex_lens';
    const fSigned = isConverging ? -f : f;
    const uSigned = infinity ? -1e6 : -u;

    let vSigned;
    let m;
    if (isMirror) {
      const denom = (1 / fSigned) - (1 / uSigned);
      vSigned = Math.abs(denom) < 1e-5 ? Infinity : 1 / denom;
      m = isFinite(vSigned) ? -vSigned / uSigned : Infinity;
    } else {
      const fLens = isConverging ? f : -f;
      const denom = (1 / fLens) + (1 / uSigned);
      vSigned = Math.abs(denom) < 1e-5 ? Infinity : 1 / denom;
      m = isFinite(vSigned) ? vSigned / uSigned : Infinity;
    }

    const isReal = isMirror ? (vSigned < 0 && isFinite(vSigned)) : (vSigned > 0 && isFinite(vSigned));
    const hi = isFinite(m) ? m * h : 0;
    return { isMirror, isConverging, fSigned, uSigned, vSigned, m, hi, isReal };
  }

  function updateBenchUI() {
    const { u, f, h, infinity, device } = state.lab;
    document.getElementById('uSlider').value = u;
    document.getElementById('fSlider').value = f;
    document.getElementById('hSlider').value = h;
    document.getElementById('uReadout').textContent = infinity ? '∞ (Solar)' : `${Math.round(u)} cm`;
    document.getElementById('fReadout').textContent = `${Math.round(f)} cm`;
    document.getElementById('hReadout').textContent = `${Math.round(h)} cm`;

    const res = computeOptics();
    const vfCard = document.getElementById('viewfinderCard');
    const vfBadge = document.getElementById('vfBadge');
    const solarBadge = document.getElementById('solarBadge');

    const isSolarSpark = infinity && res.isConverging;
    solarBadge.classList.toggle('hidden', !isSolarSpark);
    if (isSolarSpark) completeMission('solar');

    if (!isFinite(res.vSigned)) {
      vfCard.className = 'lg:col-span-5 rounded-2xl p-4 sm:p-5 border border-[#ff2e93]/55 vf-real-glow flex flex-col justify-between space-y-3 text-slate-100';
      vfBadge.className = 'px-3 py-1 rounded-full font-mono-code text-xs font-extrabold bg-[#ff2e93] text-white';
      vfBadge.textContent = '∞ PARALLEL BEAM (AT FOCUS)';
      document.getElementById('vfMagBadge').textContent = 'Mag: ∞';
      document.getElementById('vReadout').textContent = 'Infinity (∞)';
      document.getElementById('orientReadout').textContent = 'Collimated';
      document.getElementById('sizeReadout').textContent = 'Infinite';
      document.getElementById('vfSummary').textContent = 'Object sits right at the Focus (F)! Reflected or refracted rays exit strictly parallel—ideal for searchlights and lighthouse beams.';
      return;
    }

    const absM = Math.abs(res.m);
    const sizeWord = infinity ? 'Pinpoint Dot' : (Math.abs(absM - 1) < 0.06 ? 'Same Size (1:1)' : (absM > 1 ? 'Magnified' : 'Diminished'));
    const orientWord = res.m < 0 ? 'Upside-Down' : 'Upright';

    if (Math.abs(absM - 1) < 0.06 && res.isReal) completeMission('equal1to1');
    if (!res.isReal && absM > 1.3 && device === 'convex_lens') completeMission('magnifier');
    if (device === 'convex_mirror' && !res.isReal) completeMission('sidemirror');

    document.getElementById('vfMagBadge').textContent = infinity ? 'Mag: ~0×' : `Mag: ${absM.toFixed(2)}×`;
    document.getElementById('vReadout').textContent = `${Math.round(res.vSigned)} cm`;
    document.getElementById('orientReadout').textContent = orientWord;
    document.getElementById('sizeReadout').textContent = sizeWord;

    if (res.isReal) {
      vfCard.className = 'lg:col-span-5 rounded-2xl p-4 sm:p-5 border border-[#fbbf24]/55 vf-real-glow flex flex-col justify-between space-y-3 text-slate-100';
      vfBadge.className = 'px-3 py-1 rounded-full font-mono-code text-xs font-extrabold bg-[#fbbf24] text-[#050814]';
      vfBadge.textContent = isSolarSpark ? '🔥 REAL SOLAR HOTSPOT' : '🎬 REAL & INVERTED';
      document.getElementById('vfSummary').textContent = isSolarSpark
        ? 'Parallel solar rays converge onto a blazing focal hotspot! Concentrating sunlight at F generates intense thermal energy.'
        : 'Actual light rays physically intersect to form an inverted real image that can be captured on a projection screen.';
    } else {
      vfCard.className = 'lg:col-span-5 rounded-2xl p-4 sm:p-5 border border-[#00e5ff]/55 vf-virtual-glow flex flex-col justify-between space-y-3 text-slate-100';
      vfBadge.className = 'px-3 py-1 rounded-full font-mono-code text-xs font-extrabold bg-[#00e5ff] text-[#050814]';
      vfBadge.textContent = '🪞 VIRTUAL & UPRIGHT';
      document.getElementById('vfSummary').textContent = 'Outgoing rays diverge, so dashed backward extensions meet behind the optic to create an upright virtual image seen inside the glass.';
    }
  }

  function drawBenchCanvas(t) {
    const w = benchCanvas.width;
    const h = benchCanvas.height;
    const midY = h / 2;
    const cx = getOpticCenterX();
    const { device, u, f, h: objH, infinity, rainbow, wavefronts, objType } = state.lab;
    const res = computeOptics();

    benchCtx.clearRect(0, 0, w, h);

    benchCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    benchCtx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 40) {
      benchCtx.beginPath(); benchCtx.moveTo(gx, 0); benchCtx.lineTo(gx, h); benchCtx.stroke();
    }
    for (let gy = 0; gy < h; gy += 40) {
      benchCtx.beginPath(); benchCtx.moveTo(0, gy); benchCtx.lineTo(w, gy); benchCtx.stroke();
    }

    benchCtx.save();
    benchCtx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    benchCtx.lineWidth = 1.6;
    benchCtx.setLineDash([8, 6]);
    benchCtx.beginPath(); benchCtx.moveTo(24, midY); benchCtx.lineTo(w - 24, midY); benchCtx.stroke();
    benchCtx.restore();

    benchCtx.save();
    if (device === 'concave_mirror') {
      const R = f * 2;
      const arcSpan = Math.min(0.65, 210 / R);
      benchCtx.strokeStyle = '#00e5ff';
      benchCtx.shadowColor = '#00e5ff';
      benchCtx.shadowBlur = 14;
      benchCtx.lineWidth = 5;
      benchCtx.beginPath();
      benchCtx.arc(cx - R, midY, R, -arcSpan, arcSpan);
      benchCtx.stroke();
    } else if (device === 'convex_mirror') {
      const R = f * 2;
      const arcSpan = Math.min(0.65, 210 / R);
      benchCtx.strokeStyle = '#ff2e93';
      benchCtx.shadowColor = '#ff2e93';
      benchCtx.shadowBlur = 14;
      benchCtx.lineWidth = 5;
      benchCtx.beginPath();
      benchCtx.arc(cx + R, midY, R, Math.PI - arcSpan, Math.PI + arcSpan);
      benchCtx.stroke();
    } else if (device === 'convex_lens') {
      const bulge = Math.max(24, 58 - f * 0.2);
      const grad = benchCtx.createLinearGradient(cx - bulge, 0, cx + bulge, 0);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.14)');
      grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.34)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0.14)');
      benchCtx.fillStyle = grad;
      benchCtx.strokeStyle = '#fbbf24';
      benchCtx.lineWidth = 3.5;
      benchCtx.beginPath();
      benchCtx.moveTo(cx, 55);
      benchCtx.quadraticCurveTo(cx + bulge, midY, cx, h - 55);
      benchCtx.quadraticCurveTo(cx - bulge, midY, cx, 55);
      benchCtx.fill(); benchCtx.stroke();
    } else {
      const pinch = Math.max(6, 22 - f * 0.08);
      benchCtx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      benchCtx.strokeStyle = '#10b981';
      benchCtx.lineWidth = 3.5;
      benchCtx.beginPath();
      benchCtx.moveTo(cx - 24, 55); benchCtx.lineTo(cx + 24, 55);
      benchCtx.quadraticCurveTo(cx + pinch, midY, cx + 24, h - 55);
      benchCtx.lineTo(cx - 24, h - 55);
      benchCtx.quadraticCurveTo(cx - pinch, midY, cx - 24, 55);
      benchCtx.fill(); benchCtx.stroke();
    }
    benchCtx.restore();

    const drawMarker = (mx, label, color) => {
      if (mx < 20 || mx > w - 20) return;
      benchCtx.fillStyle = color;
      benchCtx.beginPath(); benchCtx.arc(mx, midY, 5.5, 0, Math.PI * 2); benchCtx.fill();
      benchCtx.font = 'bold 13px JetBrains Mono';
      benchCtx.fillText(label, mx - 8, midY + 22);
    };

    if (device === 'concave_mirror') {
      drawMarker(cx - f, 'F', '#00e5ff');
      drawMarker(cx - 2 * f, 'C', '#94a3b8');
    } else if (device === 'convex_mirror') {
      drawMarker(cx + f, 'F', '#00e5ff');
      drawMarker(cx + 2 * f, 'C', '#94a3b8');
    } else {
      drawMarker(cx - f, 'F₁', '#00e5ff');
      drawMarker(cx - 2 * f, '2F₁', '#94a3b8');
      drawMarker(cx + f, 'F₂', '#fbbf24');
      drawMarker(cx + 2 * f, '2F₂', '#94a3b8');
    }

    if (infinity) {
      const beamYs = [-140, -90, -45, 45, 90, 140];
      const spectrum = ['#ff2e93', '#fb923c', '#fbbf24', '#10b981', '#00e5ff', '#a855f7'];
      const focusX = (device === 'concave_mirror' || device === 'concave_lens') ? cx - f : cx + f;

      beamYs.forEach((dy, idx) => {
        const col = rainbow ? spectrum[idx] : '#fbbf24';
        benchCtx.save();
        benchCtx.strokeStyle = col;
        benchCtx.shadowColor = col;
        benchCtx.shadowBlur = 10;
        benchCtx.lineWidth = 2.6;
        benchCtx.beginPath();
        benchCtx.moveTo(20, midY + dy);
        benchCtx.lineTo(cx, midY + dy);

        if (res.isConverging) {
          const slope = (midY - (midY + dy)) / (focusX - cx);
          const endX = res.isMirror ? 20 : w - 20;
          benchCtx.lineTo(endX, midY + dy + slope * (endX - cx));
        } else {
          const slope = ((midY + dy) - midY) / (cx - focusX);
          const endX = res.isMirror ? 20 : w - 20;
          benchCtx.lineTo(endX, midY + dy + slope * (endX - cx));
        }
        benchCtx.stroke();

        if (!res.isConverging) {
          benchCtx.setLineDash([5, 5]);
          benchCtx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
          benchCtx.beginPath();
          benchCtx.moveTo(cx, midY + dy);
          benchCtx.lineTo(focusX, midY);
          benchCtx.stroke();
        }
        benchCtx.restore();
      });

      if (res.isConverging) {
        const pulse = 18 + Math.sin(t * 0.015) * 6;
        const spark = benchCtx.createRadialGradient(focusX, midY, 2, focusX, midY, pulse * 1.8);
        spark.addColorStop(0, '#ffffff');
        spark.addColorStop(0.35, '#fbbf24');
        spark.addColorStop(1, 'rgba(255, 46, 147, 0)');
        benchCtx.fillStyle = spark;
        benchCtx.beginPath();
        benchCtx.arc(focusX, midY, pulse * 1.8, 0, Math.PI * 2);
        benchCtx.fill();
      }
      return;
    }

    const objX = cx - u;
    const topY = midY - objH;

    if (wavefronts) {
      benchCtx.save();
      benchCtx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
      benchCtx.lineWidth = 1.5;
      const phase = (t * 0.06) % 36;
      for (let r = phase; r < u; r += 36) {
        benchCtx.beginPath();
        benchCtx.arc(objX, topY, r, -0.55, 0.55);
        benchCtx.stroke();
      }
      benchCtx.restore();
    }

    const imgX = isFinite(res.vSigned) ? cx + res.vSigned : null;
    const imgTopY = isFinite(res.hi) ? midY - res.hi : null;

    const raySpecs = [
      { color: rainbow ? '#ff2e93' : '#fbbf24', hitY: topY },
      { color: rainbow ? '#10b981' : '#ff2e93', hitY: midY },
      {
        color: rainbow ? '#00e5ff' : '#00e5ff',
        hitY: (() => {
          const nearF = device === 'convex_lens' ? cx - f : (device === 'concave_mirror' ? cx - f : cx + f);
          if (Math.abs(nearF - objX) < 6) return midY + 40;
          const s = (midY - topY) / (nearF - objX);
          return Math.max(65, Math.min(h - 65, topY + s * (cx - objX)));
        })()
      }
    ];

    raySpecs.forEach(ray => {
      benchCtx.save();
      benchCtx.strokeStyle = ray.color;
      benchCtx.shadowColor = ray.color;
      benchCtx.shadowBlur = 9;
      benchCtx.lineWidth = 2.6;

      benchCtx.beginPath();
      benchCtx.moveTo(objX, topY);
      benchCtx.lineTo(cx, ray.hitY);

      const outDir = res.isMirror ? -1 : 1;
      const farX = outDir === -1 ? 15 : w - 15;
      let slopeOut;
      if (!isFinite(res.vSigned)) {
        slopeOut = (ray.hitY - midY) / (cx - objX);
        if (ray.hitY === topY) slopeOut = res.isConverging ? (midY - topY) / (outDir * f) : (topY - midY) / (-outDir * f);
      } else {
        slopeOut = (imgTopY - ray.hitY) / (imgX - cx);
      }

      const farY = ray.hitY + slopeOut * (farX - cx);
      benchCtx.lineTo(farX, farY);
      benchCtx.stroke();

      if (!res.isReal && imgX !== null && isFinite(imgX)) {
        benchCtx.setLineDash([6, 6]);
        benchCtx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
        benchCtx.lineWidth = 1.8;
        benchCtx.beginPath();
        benchCtx.moveTo(cx, ray.hitY);
        benchCtx.lineTo(imgX, imgTopY);
        benchCtx.stroke();
      }
      benchCtx.restore();
    });

    benchCtx.save();
    benchCtx.strokeStyle = '#fbbf24';
    benchCtx.lineWidth = 4;
    benchCtx.beginPath(); benchCtx.moveTo(objX, midY); benchCtx.lineTo(objX, topY); benchCtx.stroke();
    benchCtx.font = '28px sans-serif';
    benchCtx.textAlign = 'center';
    benchCtx.fillText(OBJ_EMOJIS[objType], objX, topY - 8);
    benchCtx.font = 'bold 11px JetBrains Mono';
    benchCtx.fillStyle = '#fbbf24';
    benchCtx.fillText('OBJECT', objX, midY + 18);
    benchCtx.restore();

    if (imgX !== null && isFinite(imgX) && imgX > -600 && imgX < w + 600) {
      benchCtx.save();
      benchCtx.strokeStyle = res.isReal ? '#fbbf24' : '#00e5ff';
      benchCtx.lineWidth = 4;
      if (!res.isReal) benchCtx.setLineDash([6, 4]);
      benchCtx.beginPath();
      benchCtx.moveTo(imgX, midY);
      benchCtx.lineTo(imgX, imgTopY);
      benchCtx.stroke();
      benchCtx.setLineDash([]);

      benchCtx.translate(imgX, imgTopY + (res.hi < 0 ? 18 : -8));
      if (res.hi < 0) benchCtx.scale(1, -1);
      benchCtx.font = `${Math.max(18, Math.min(44, Math.abs(res.hi) * 0.42))}px sans-serif`;
      benchCtx.textAlign = 'center';
      benchCtx.fillText(OBJ_EMOJIS[objType], 0, 0);
      benchCtx.restore();

      benchCtx.font = 'bold 11px JetBrains Mono';
      benchCtx.fillStyle = res.isReal ? '#fbbf24' : '#00e5ff';
      benchCtx.textAlign = 'center';
      benchCtx.fillText(res.isReal ? 'REAL IMAGE' : 'VIRTUAL IMAGE', imgX, midY + (res.hi < 0 ? -12 : 18));
    }
  }

  benchCanvas.addEventListener('pointerdown', (e) => {
    const rect = benchCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (benchCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (benchCanvas.height / rect.height);
    const cx = getOpticCenterX();
    const midY = benchCanvas.height / 2;
    const objX = cx - state.lab.u;
    const topY = midY - state.lab.h;

    if (!state.lab.infinity && Math.hypot(sx - objX, sy - topY) < 28) {
      state.lab.draggingTip = true;
    } else if (!state.lab.infinity && Math.abs(sx - objX) < 34) {
      state.lab.draggingObj = true;
    } else if (Math.abs(Math.abs(sx - cx) - state.lab.f) < 24 && Math.abs(sy - midY) < 28) {
      state.lab.draggingFocus = true;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!state.lab.draggingObj && !state.lab.draggingTip && !state.lab.draggingFocus) return;
    const rect = benchCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (benchCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (benchCanvas.height / rect.height);
    const cx = getOpticCenterX();
    const midY = benchCanvas.height / 2;

    if (state.lab.draggingObj) {
      state.lab.infinity = false;
      state.lab.u = Math.max(40, Math.min(420, cx - sx));
      updateBenchUI();
    } else if (state.lab.draggingTip) {
      state.lab.h = Math.max(30, Math.min(115, midY - sy));
      updateBenchUI();
    } else if (state.lab.draggingFocus) {
      state.lab.f = Math.max(60, Math.min(170, Math.abs(sx - cx)));
      updateBenchUI();
    }
  });

  window.addEventListener('pointerup', () => {
    state.lab.draggingObj = false;
    state.lab.draggingTip = false;
    state.lab.draggingFocus = false;
  });

  function setLabDevice(dev) {
    state.lab.device = dev;
    document.querySelectorAll('.device-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.labDevice === dev);
    });
    updateBenchUI();
    playTone(500, 0.12);
  }

  document.querySelectorAll('.device-tab').forEach(tab => {
    tab.addEventListener('click', () => setLabDevice(tab.dataset.labDevice));
  });

  document.querySelectorAll('.obj-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      state.lab.objType = pill.dataset.obj;
      document.querySelectorAll('.obj-pill').forEach(p => {
        p.className = 'obj-pill px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 border border-transparent transition';
      });
      pill.className = 'obj-pill px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#fbbf24]/25 text-[#fbbf24] border border-[#fbbf24]/50 transition';
      playTone(640, 0.1);
    });
  });

  document.getElementById('rainbowPill').addEventListener('click', (e) => {
    state.lab.rainbow = !state.lab.rainbow;
    e.currentTarget.textContent = `🌈 Rainbow Rays: ${state.lab.rainbow ? 'ON' : 'OFF'}`;
    e.currentTarget.classList.toggle('border-[#ff2e93]', state.lab.rainbow);
    playTone(680, 0.12);
  });

  document.getElementById('wavefrontsPill').addEventListener('click', (e) => {
    state.lab.wavefronts = !state.lab.wavefronts;
    e.currentTarget.textContent = `〰️ Wavefronts: ${state.lab.wavefronts ? 'ON' : 'OFF'}`;
    e.currentTarget.classList.toggle('border-[#00e5ff]', state.lab.wavefronts);
    playTone(560, 0.12);
  });

  document.getElementById('fullscreenBenchBtn').addEventListener('click', () => {
    const wrap = document.getElementById('benchWrapper');
    if (!document.fullscreenElement) wrap.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.preset;
      const f = state.lab.f;
      state.lab.infinity = (p === 'infinity');
      if (p === 'beyond_2f') state.lab.u = Math.min(410, f * 2.6);
      else if (p === 'at_2f') state.lab.u = f * 2;
      else if (p === 'between_f_2f') state.lab.u = f * 1.45;
      else if (p === 'at_f') state.lab.u = f;
      else if (p === 'inside_f') state.lab.u = Math.max(42, f * 0.58);
      updateBenchUI();
      playTone(600, 0.14);
    });
  });

  document.getElementById('uSlider').addEventListener('input', (e) => {
    state.lab.infinity = false;
    state.lab.u = Number(e.target.value);
    updateBenchUI();
  });
  document.getElementById('fSlider').addEventListener('input', (e) => {
    state.lab.f = Number(e.target.value);
    updateBenchUI();
  });
  document.getElementById('hSlider').addEventListener('input', (e) => {
    state.lab.h = Number(e.target.value);
    updateBenchUI();
  });

  /* -----------------------------------------------------------------------
     6. SECTION 3: LASER BOUNCE & FOCUS PUZZLE ARENA
     ----------------------------------------------------------------------- */
  const puzzleCanvas = document.getElementById('puzzleCanvas');
  const puzzleCtx = puzzleCanvas.getContext('2d');

  const PUZZLE_LEVELS = [
    {
      desc: 'Level 1 — Click the cyan mirror to rotate it 45° and bounce the laser into the Emerald Target!',
      emitter: { x: 80, y: 110, angle: 0 },
      target: { x: 520, y: 330, r: 24 },
      mirrors: [{ x: 520, y: 110, angle: 0.25, len: 76 }],
      blockers: [{ x: 260, y: 220, w: 150, h: 24 }]
    },
    {
      desc: 'Level 2 — Chain two mirrors around the central obsidian wall to reach the upper-right sensor!',
      emitter: { x: 75, y: 310, angle: 0 },
      target: { x: 890, y: 95, r: 24 },
      mirrors: [
        { x: 340, y: 310, angle: -0.35, len: 74 },
        { x: 340, y: 95, angle: 0.35, len: 74 }
      ],
      blockers: [{ x: 480, y: 165, w: 32, h: 210 }]
    },
    {
      desc: 'Level 3 — Thread the needle through the double-slit barrier using two angled reflectors!',
      emitter: { x: 80, y: 90, angle: 0 },
      target: { x: 910, y: 310, r: 24 },
      mirrors: [
        { x: 450, y: 90, angle: 0.4, len: 72 },
        { x: 450, y: 310, angle: -0.3, len: 72 }
      ],
      blockers: [
        { x: 650, y: 20, w: 28, h: 220 },
        { x: 220, y: 180, w: 28, h: 200 }
      ]
    },
    {
      desc: 'Level 4 — Grand Zig-Zag Finale: Align all 3 mirrors to energize the core!',
      emitter: { x: 70, y: 200, angle: 0 },
      target: { x: 920, y: 200, r: 24 },
      mirrors: [
        { x: 270, y: 200, angle: -0.4, len: 70 },
        { x: 270, y: 70, angle: 0.2, len: 70 },
        { x: 730, y: 70, angle: 0.5, len: 70 }
      ],
      blockers: [{ x: 420, y: 140, w: 180, h: 120 }]
    }
  ];

  let activeMirrors = JSON.parse(JSON.stringify(PUZZLE_LEVELS[0].mirrors));

  function loadPuzzleLevel(idx) {
    state.puzzleLevel = idx;
    activeMirrors = JSON.parse(JSON.stringify(PUZZLE_LEVELS[idx].mirrors));
    document.getElementById('puzzleObjective').textContent = PUZZLE_LEVELS[idx].desc;
    document.querySelectorAll('.puzzle-level-btn').forEach((b, i) => {
      b.classList.toggle('active', i === idx);
      b.classList.toggle('cleared', state.puzzlesCleared.has(i));
    });
  }

  document.querySelectorAll('.puzzle-level-btn').forEach(btn => {
    btn.addEventListener('click', () => loadPuzzleLevel(Number(btn.dataset.puzzleLvl)));
  });
  document.getElementById('resetPuzzleBtn').addEventListener('click', () => loadPuzzleLevel(state.puzzleLevel));

  puzzleCanvas.addEventListener('pointerdown', (e) => {
    const rect = puzzleCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (puzzleCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (puzzleCanvas.height / rect.height);
    for (const m of activeMirrors) {
      if (Math.hypot(sx - m.x, sy - m.y) < 55) {
        m.angle += Math.PI / 8;
        playTone(660, 0.1, 'sine', 0.07);
        break;
      }
    }
  });

  function intersectSegment(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-6) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    if (t > 0.001 && t <= 1 && u >= 0 && u <= 1) {
      return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), t };
    }
    return null;
  }

  function drawPuzzleCanvas(t) {
    const w = puzzleCanvas.width;
    const h = puzzleCanvas.height;
    const lvl = PUZZLE_LEVELS[state.puzzleLevel];
    puzzleCtx.clearRect(0, 0, w, h);

    lvl.blockers.forEach(b => {
      puzzleCtx.fillStyle = '#1e293b';
      puzzleCtx.strokeStyle = '#ff2e93';
      puzzleCtx.lineWidth = 2;
      puzzleCtx.fillRect(b.x, b.y, b.w, b.h);
      puzzleCtx.strokeRect(b.x, b.y, b.w, b.h);
    });

    activeMirrors.forEach(m => {
      const dx = Math.cos(m.angle) * (m.len / 2);
      const dy = Math.sin(m.angle) * (m.len / 2);
      puzzleCtx.save();
      puzzleCtx.strokeStyle = '#00e5ff';
      puzzleCtx.shadowColor = '#00e5ff';
      puzzleCtx.shadowBlur = 12;
      puzzleCtx.lineWidth = 6;
      puzzleCtx.lineCap = 'round';
      puzzleCtx.beginPath();
      puzzleCtx.moveTo(m.x - dx, m.y - dy);
      puzzleCtx.lineTo(m.x + dx, m.y + dy);
      puzzleCtx.stroke();
      puzzleCtx.fillStyle = '#ffffff';
      puzzleCtx.beginPath(); puzzleCtx.arc(m.x, m.y, 4, 0, Math.PI * 2); puzzleCtx.fill();
      puzzleCtx.restore();
    });

    let rx = lvl.emitter.x;
    let ry = lvl.emitter.y;
    let dirX = Math.cos(lvl.emitter.angle);
    let dirY = Math.sin(lvl.emitter.angle);
    let hitTarget = false;

    puzzleCtx.save();
    puzzleCtx.strokeStyle = '#ff2e93';
    puzzleCtx.shadowColor = '#ff2e93';
    puzzleCtx.shadowBlur = 14;
    puzzleCtx.lineWidth = 3.5;

    for (let bounce = 0; bounce < 6; bounce++) {
      const farX = rx + dirX * 1400;
      const farY = ry + dirY * 1400;
      let best = { t: 1, x: farX, y: farY, type: 'wall' };

      const walls = [
        [0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]
      ];
      walls.forEach(wl => {
        const hit = intersectSegment(rx, ry, farX, farY, wl[0], wl[1], wl[2], wl[3]);
        if (hit && hit.t < best.t) best = { ...hit, type: 'wall' };
      });

      lvl.blockers.forEach(b => {
        const edges = [
          [b.x, b.y, b.x + b.w, b.y],
          [b.x + b.w, b.y, b.x + b.w, b.y + b.h],
          [b.x + b.w, b.y + b.h, b.x, b.y + b.h],
          [b.x, b.y + b.h, b.x, b.y]
        ];
        edges.forEach(ed => {
          const hit = intersectSegment(rx, ry, farX, farY, ed[0], ed[1], ed[2], ed[3]);
          if (hit && hit.t < best.t) best = { ...hit, type: 'blocker' };
        });
      });

      activeMirrors.forEach(m => {
        const dx = Math.cos(m.angle) * (m.len / 2);
        const dy = Math.sin(m.angle) * (m.len / 2);
        const hit = intersectSegment(rx, ry, farX, farY, m.x - dx, m.y - dy, m.x + dx, m.y + dy);
        if (hit && hit.t < best.t) {
          best = { ...hit, type: 'mirror', mirror: m };
        }
      });

      const toTargetX = lvl.target.x - rx;
      const toTargetY = lvl.target.y - ry;
      const segLen = Math.hypot(best.x - rx, best.y - ry);
      const proj = toTargetX * dirX + toTargetY * dirY;
      if (proj > 0 && proj < segLen) {
        const perp = Math.hypot(toTargetX - proj * dirX, toTargetY - proj * dirY);
        if (perp <= lvl.target.r) {
          best = { x: lvl.target.x, y: lvl.target.y, type: 'target' };
          hitTarget = true;
        }
      }

      puzzleCtx.beginPath();
      puzzleCtx.moveTo(rx, ry);
      puzzleCtx.lineTo(best.x, best.y);
      puzzleCtx.stroke();

      if (best.type === 'mirror') {
        const nx = -Math.sin(best.mirror.angle);
        const ny = Math.cos(best.mirror.angle);
        const dot = dirX * nx + dirY * ny;
        dirX = dirX - 2 * dot * nx;
        dirY = dirY - 2 * dot * ny;
        rx = best.x;
        ry = best.y;
      } else {
        break;
      }
    }
    puzzleCtx.restore();

    puzzleCtx.fillStyle = '#ff2e93';
    puzzleCtx.beginPath(); puzzleCtx.arc(lvl.emitter.x, lvl.emitter.y, 14, 0, Math.PI * 2); puzzleCtx.fill();

    const targetCol = hitTarget ? '#10b981' : '#334155';
    puzzleCtx.save();
    puzzleCtx.fillStyle = targetCol;
    puzzleCtx.strokeStyle = '#10b981';
    puzzleCtx.shadowColor = '#10b981';
    puzzleCtx.shadowBlur = hitTarget ? 22 : 6;
    puzzleCtx.lineWidth = 3;
    puzzleCtx.beginPath();
    puzzleCtx.arc(lvl.target.x, lvl.target.y, lvl.target.r + (hitTarget ? Math.sin(t * 0.02) * 3 : 0), 0, Math.PI * 2);
    puzzleCtx.fill(); puzzleCtx.stroke();
    puzzleCtx.restore();

    const badge = document.getElementById('puzzleStatusBadge');
    if (hitTarget) {
      badge.textContent = '✅ TARGET CHARGED!';
      badge.className = 'px-3 py-1 rounded-full font-mono-code font-bold bg-[#10b981]/25 text-[#10b981] border border-[#10b981]';
      if (!state.puzzlesCleared.has(state.puzzleLevel)) {
        state.puzzlesCleared.add(state.puzzleLevel);
        document.querySelectorAll('.puzzle-level-btn')[state.puzzleLevel].classList.add('cleared');
        addXP(60, `Solved Laser Puzzle Level ${state.puzzleLevel + 1}!`);
        if (state.puzzlesCleared.size >= 2) completeMission('puzzles');
      }
    } else {
      badge.textContent = '⚡ CLICK MIRRORS TO ROTATE';
      badge.className = 'px-3 py-1 rounded-full font-mono-code font-bold bg-slate-800 text-slate-300';
    }
  }

  /* -----------------------------------------------------------------------
     7. SECTION 4: MISSIONS & SECTION 5: REAL-WORLD PRESETS
     ----------------------------------------------------------------------- */
  const MISSIONS = [
    { id: 'solar', icon: '🔥', title: 'Solar Spark Ignition', desc: 'Select Very Far (∞) on a Concave Mirror or Convex Lens to ignite a focal hotspot.', xp: 50 },
    { id: 'equal1to1', icon: '⚖️', title: '1:1 Inversion Point', desc: 'Place an object at 2F / C on a converging optic so the real image matches object size.', xp: 50 },
    { id: 'magnifier', icon: '🔍', title: 'Jeweler’s Loupe', desc: 'Move an object closer than F on a Convex Lens to create a giant upright virtual image.', xp: 50 },
    { id: 'sidemirror', icon: '🚗', title: 'Wide-View Traffic Mirror', desc: 'Inspect how a Convex Mirror always forms a diminished, upright virtual image.', xp: 40 },
    { id: 'puzzles', icon: '🔦', title: 'Laser Circuit Architect', desc: 'Charge the emerald receiver in at least 2 levels of the Laser Bounce Arena.', xp: 75 }
  ];

  function renderMissions() {
    const grid = document.getElementById('missionsGrid');
    grid.innerHTML = MISSIONS.map(m => {
      const done = state.missionsDone.has(m.id);
      return `
        <div class="glass-card rounded-2xl p-4 flex items-start justify-between gap-3 ${done ? 'border-[#10b981]' : ''}">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl ${done ? 'bg-[#10b981]/25' : 'bg-white/5'} flex items-center justify-center text-xl shrink-0">
              ${done ? '✅' : m.icon}
            </div>
            <div>
              <div class="font-extrabold text-sm ${done ? 'text-[#10b981]' : ''}">${m.title}</div>
              <p class="text-xs text-muted mt-0.5 leading-relaxed">${m.desc}</p>
            </div>
          </div>
          <span class="font-mono-code text-[11px] font-bold px-2.5 py-1 rounded-full ${done ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#fbbf24]/15 text-[#fbbf24]'} shrink-0">
            ${done ? 'DONE' : `+${m.xp} XP`}
          </span>
        </div>
      `;
    }).join('');
    document.getElementById('missionsDoneCount').textContent = state.missionsDone.size;
  }

  function completeMission(id) {
    if (state.missionsDone.has(id)) return;
    const mission = MISSIONS.find(m => m.id === id);
    if (!mission) return;
    state.missionsDone.add(id);
    renderMissions();
    addXP(mission.xp, `Mission Complete: ${mission.title}`);
  }

  document.querySelectorAll('[data-wonder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.dataset.wonder;
      if (w === 'telescope') { setLabDevice('concave_mirror'); state.lab.infinity = true; }
      else if (w === 'sidemirror') { setLabDevice('convex_mirror'); state.lab.infinity = false; state.lab.u = 220; }
      else if (w === 'magnifier') { setLabDevice('convex_lens'); state.lab.infinity = false; state.lab.u = 58; }
      else if (w === 'eyeglass') { setLabDevice('concave_lens'); state.lab.infinity = false; state.lab.u = 210; }
      updateBenchUI();
      document.getElementById('big-lab').scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* -----------------------------------------------------------------------
     8. SECTION 6: PRACTICE QUIZ ENGINE
     ----------------------------------------------------------------------- */
  const QUIZ = [
    {
      q: '1. A light ray enters a Convex Lens strictly parallel to the principal axis. Where does it go after passing through the lens?',
      opts: ['Through the far Focus (F₂)', 'Straight through without bending', 'Back toward the object', 'Parallel to the vertical edge'],
      ans: 0,
      exp: 'By Golden Rule 1, parallel incoming rays refract through the far Focus (F₂) on a converging convex lens.'
    },
    {
      q: '2. Why are passenger-side car mirrors always Convex Mirrors?',
      opts: ['They magnify distant license plates', 'They form a wide-angle, upright, diminished virtual image', 'They project real images onto the windshield', 'They block all high-beam glare'],
      ans: 1,
      exp: 'Convex mirrors diverge rays, giving drivers a wide field of view with an upright (though smaller) virtual image.'
    },
    {
      q: '3. Where must you place an object in front of a Concave Mirror to produce a Real, Inverted image of the EXACT same size (1:1)?',
      opts: ['Closer than Focus (F)', 'At the Center of Curvature (C = 2F)', 'At Infinity (∞)', 'Right on the Pole (P)'],
      ans: 1,
      exp: 'At u = 2F (Center of Curvature), rays converge directly beneath the object with magnification m = -1.'
    },
    {
      q: '4. What is the key difference between a Real Image and a Virtual Image?',
      opts: ['Real images are always upright', 'Real images can be caught on a screen because actual rays intersect', 'Virtual images only occur in mirrors', 'Virtual images are always upside-down'],
      ans: 1,
      exp: 'Real images occur where physical light rays cross (always inverted), whereas virtual images form along dashed backward extensions (always upright).'
    },
    {
      q: '5. Which optical element is thinner in the middle than at its edges and corrects nearsightedness (myopia)?',
      opts: ['Biconvex Lens', 'Concave Mirror', 'Concave (Diverging) Lens', 'Plane Mirror'],
      ans: 2,
      exp: 'A concave lens diverges incoming light slightly before it enters the eye so the image lands sharply on the retina.'
    }
  ];

  let quizIdx = 0;
  let quizScore = 0;
  let quizAnswered = false;

  function renderQuiz() {
    const item = QUIZ[quizIdx];
    quizAnswered = false;
    document.getElementById('quizIndexLabel').textContent = quizIdx + 1;
    document.getElementById('quizTotalLabel').textContent = QUIZ.length;
    document.getElementById('quizPrompt').textContent = item.q;
    document.getElementById('quizFeedback').classList.add('hidden');
    document.getElementById('nextQuizBtn').classList.add('hidden');

    const box = document.getElementById('quizOptions');
    box.innerHTML = item.opts.map((opt, idx) => `
      <button type="button" data-qopt="${idx}"
        class="quiz-opt text-left p-4 rounded-2xl glass-inset hover:border-[#00e5ff] text-sm font-semibold transition">
        ${opt}
      </button>
    `).join('');

    box.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (quizAnswered) return;
        quizAnswered = true;
        const chosen = Number(btn.dataset.qopt);
        const correct = chosen === item.ans;
        if (correct) {
          quizScore++;
          btn.classList.add('border-[#10b981]', 'bg-[#10b981]/20');
          addXP(30, 'Correct Optics Answer!');
        } else {
          btn.classList.add('border-[#ff2e93]', 'bg-[#ff2e93]/20');
          box.querySelectorAll('.quiz-opt')[item.ans].classList.add('border-[#10b981]', 'bg-[#10b981]/20');
          playTone(260, 0.2, 'sawtooth', 0.06);
        }
        document.getElementById('quizScoreText').textContent = `Score: ${quizScore} / ${QUIZ.length}`;
        const fb = document.getElementById('quizFeedback');
        fb.className = `rounded-2xl p-4 text-sm leading-relaxed border ${correct ? 'bg-[#10b981]/15 border-[#10b981]/50 text-[#10b981]' : 'bg-[#ff2e93]/15 border-[#ff2e93]/50 text-slate-200'}`;
        fb.textContent = (correct ? '✅ Spot on! ' : '💡 Not quite — ') + item.exp;
        fb.classList.remove('hidden');

        const nextBtn = document.getElementById('nextQuizBtn');
        nextBtn.textContent = quizIdx < QUIZ.length - 1 ? 'Next Question →' : '↺ Restart Quiz';
        nextBtn.classList.remove('hidden');
      });
    });
  }

  document.getElementById('nextQuizBtn').addEventListener('click', () => {
    if (quizIdx < QUIZ.length - 1) quizIdx++;
    else { quizIdx = 0; quizScore = 0; document.getElementById('quizScoreText').textContent = `Score: 0 / ${QUIZ.length}`; }
    renderQuiz();
  });

  /* -----------------------------------------------------------------------
     9. THEME, SOUND & EXPORT FOLDER MODAL
     ----------------------------------------------------------------------- */
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('museum-light');
    playTone(520, 0.1);
  });

  document.getElementById('soundToggle').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    document.getElementById('soundStatusText').textContent = state.soundOn ? '🔊 Sound' : '🔇 Muted';
    if (state.soundOn) playTone(600, 0.12);
  });

  let currentExportTab = 'html';
  async function loadProjectSource(tab) {
    if (tab === 'html') return document.documentElement.outerHTML;
    const fileMap = { css: 'styles.css', js: 'app.js' };
    try {
      const res = await fetch(fileMap[tab]);
      if (res.ok) return await res.text();
    } catch (_) {}
    return `/* Open ${fileMap[tab]} directly from your lumina-optics-studio project folder! */`;
  }

  async function renderExportTab() {
    document.querySelectorAll('.export-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.exportTab === currentExportTab);
    });
    document.getElementById('exportCodePreview').textContent = await loadProjectSource(currentExportTab);
  }

  document.getElementById('exportFolderBtn').addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('hidden');
    renderExportTab();
  });
  document.getElementById('closeExportModal').addEventListener('click', () => {
    document.getElementById('exportModal').classList.add('hidden');
  });
  document.querySelectorAll('.export-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentExportTab = tab.dataset.exportTab;
      renderExportTab();
    });
  });
  document.getElementById('copyExportBtn').addEventListener('click', () => {
    navigator.clipboard?.writeText(document.getElementById('exportCodePreview').textContent);
    showToast('📋 Copied!', `Copied ${currentExportTab.toUpperCase()} source to clipboard.`);
  });
  document.getElementById('downloadExportBtn').addEventListener('click', () => {
    const names = { html: 'index.html', css: 'styles.css', js: 'app.js' };
    const blob = new Blob([document.getElementById('exportCodePreview').textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = names[currentExportTab];
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* -----------------------------------------------------------------------
     10. MASTER ANIMATION LOOP & BOOTSTRAP
     ----------------------------------------------------------------------- */
  function animate(t) {
    motesCtx.clearRect(0, 0, motesCanvas.width, motesCanvas.height);
    motes.forEach(m => {
      m.x += m.vx;
      m.y += m.vy;
      if (m.y < -10) m.y = motesCanvas.height + 10;
      if (m.x < -10) m.x = motesCanvas.width + 10;
      if (m.x > motesCanvas.width + 10) m.x = -10;
      motesCtx.fillStyle = m.color;
      motesCtx.globalAlpha = m.alpha;
      motesCtx.beginPath();
      motesCtx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      motesCtx.fill();
    });
    motesCtx.globalAlpha = 1;

    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces = confettiPieces.filter(p => p.life > 0);
    confettiPieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28;
      p.rot += p.vrot;
      p.life--;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    });

    drawHeroCanvas(t);
    drawRuleCard(0);
    drawRuleCard(1);
    drawRuleCard(2);
    drawBenchCanvas(t);
    drawPuzzleCanvas(t);

    requestAnimationFrame(animate);
  }

  updateRuleCopy();
  updateBenchUI();
  loadPuzzleLevel(0);
  renderMissions();
  renderQuiz();
  requestAnimationFrame(animate);
})();
