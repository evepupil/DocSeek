import { DATA } from "./data.js";
import {
  TRACK_COLORS,
  WEAVES,
  buildAgentEmblemRows,
  copyText,
  easeAssemble,
  easeMorph,
  esc,
  hashStr,
  layoutGlyphLines,
  makeRng,
  svgBitmapText
} from "./graphics.js";

export function initEmblemCanvas(canvas, agent, runtime) {
  const rows = buildAgentEmblemRows(agent.id);
  const pal = agent.pal;
  let assembled = !runtime.state.motionOn;
  let assembleStart = 0;
  let waveStart = 0;
  let waveDir = 0;
  let swapped = false;
  let animActive = false;
  let lastSize = 0;

  const rng = makeRng(hashStr(agent.id));
  const fgIndices = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (rows[y][x] !== "0") fgIndices.push(y * 32 + x);
    }
  }
  for (let i = fgIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = fgIndices[i];
    fgIndices[i] = fgIndices[j];
    fgIndices[j] = tmp;
  }
  const orderRank = new Int16Array(1024).fill(-1);
  fgIndices.forEach((pos, idx) => { orderRank[pos] = idx; });

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const cssSize = Math.round(rect.width);
    if (cssSize <= 0 || cssSize === lastSize) return cssSize > 0;
    lastSize = cssSize;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function drawFrame(now) {
    const ctx = canvas.getContext("2d");
    if (!ctx || lastSize <= 0) return;
    const size = lastSize;
    const cell = Math.floor(size / 32);
    const gridPx = cell * 32;
    const ox = Math.floor((size - gridPx) / 2);
    const oy = Math.floor((size - gridPx) / 2);

    ctx.fillStyle = pal[0];
    ctx.fillRect(0, 0, size, size);

    let assembleLimit = fgIndices.length;
    if (!assembled) {
      const p = Math.min(1, Math.max(0, (now - assembleStart) / 560));
      assembleLimit = Math.floor(p * fgIndices.length);
      if (p >= 1) assembled = true;
    }

    let waveElapsed = -1;
    let waveDone = true;
    if (waveDir !== 0) {
      waveElapsed = now - waveStart;
      if (waveElapsed < 320) waveDone = false;
      else {
        swapped = waveDir === 1;
        waveDir = 0;
      }
    }

    for (let y = 0; y < 32; y++) {
      let runStart = 0;
      let runIdx = -1;
      for (let x = 0; x <= 32; x++) {
        let idx = 0;
        if (x < 32) {
          const raw = Number(rows[y][x]) || 0;
          if (!assembled && raw !== 0) {
            idx = orderRank[y * 32 + x] < assembleLimit ? raw : 0;
          } else {
            idx = raw;
          }
          let isSwapped = swapped;
          if (waveDir !== 0) {
            const threshold = ((x + y) / 62) * 320;
            isSwapped = waveDir === 1 ? waveElapsed >= threshold : waveElapsed < threshold;
          }
          if (isSwapped && (idx === 0 || idx === 1)) {
            idx = idx === 0 ? 1 : 0;
          }
        }
        if (x === 0) {
          runIdx = idx;
          runStart = 0;
        } else if (x === 32 || idx !== runIdx) {
          if (runIdx !== 0 || swapped || waveDir !== 0) {
            ctx.fillStyle = pal[runIdx];
            ctx.fillRect(ox + runStart * cell, oy + y * cell, (x - runStart) * cell, cell);
          }
          runStart = x;
          runIdx = idx;
        }
      }
    }

    if (assembled && waveDone) {
      animActive = false;
      runtime.motion.remove(drawFrame);
    }
  }

  function startAnim() {
    if (!animActive) {
      animActive = true;
      runtime.motion.add(drawFrame);
    }
  }

  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        io.disconnect();
        sizeCanvas();
        if (!runtime.state.motionOn) {
          assembled = true;
          drawFrame(performance.now());
        } else {
          assembled = false;
          assembleStart = performance.now();
          startAnim();
        }
      }
    }
  }, { threshold: 0.25 });
  io.observe(canvas);

  let rTimer = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(rTimer);
    rTimer = window.setTimeout(() => {
      const prev = lastSize;
      sizeCanvas();
      if (lastSize !== prev) drawFrame(performance.now());
    }, 150);
  });
  ro.observe(canvas);

  const onEnter = () => {
    if (!runtime.state.motionOn) return;
    waveDir = 1;
    waveStart = performance.now();
    startAnim();
  };
  const onLeave = () => {
    if (!runtime.state.motionOn) return;
    waveDir = -1;
    waveStart = performance.now();
    startAnim();
  };
  canvas.addEventListener("mouseenter", onEnter);
  canvas.addEventListener("mouseleave", onLeave);

  runtime.state.routeCleanup.push(() => {
    io.disconnect();
    ro.disconnect();
    window.clearTimeout(rTimer);
    runtime.motion.remove(drawFrame);
  });
}

function initHeroCanvas(canvas, captionEl, runtime) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let cssW = 0, cssH = 0, dpr = 1;
  let cycleIdx = 0;
  let particles = [];
  let morphStart = 0;
  let morphDuration = 1100;
  let isAssembling = true;
  let holdTimer = 0;
  let inView = true;
  let running = false;
  let pointerX = -9999, pointerY = -9999;

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    cssW = Math.round(r.width);
    cssH = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getTargetLayout(idx) {
    const item = DATA.copy.heroCycle[idx % DATA.copy.heroCycle.length];
    const isDesktop = window.innerWidth >= 768;
    const lines = isDesktop ? [item.desktop] : item.mobile;
    const layout = layoutGlyphLines(lines, 2, true);
    const totalCols = Math.max(layout.cols + 2, isDesktop ? 56 : 30);
    const totalRows = Math.max(layout.rows + 2, isDesktop ? 11 : 22);
    const ox = Math.floor((totalCols - layout.cols) / 2);
    const oy = Math.floor((totalRows - layout.rows) / 2);
    return {
      totalCols,
      totalRows,
      cells: layout.cells.map(c => ({ x: c.x + ox, y: c.y + oy }))
    };
  }

  function buildParticlesForTarget(idx, assembleFromRandom) {
    const t = getTargetLayout(idx);
    const rng = makeRng(hashStr("docseek-hero-" + idx + "-" + Date.now()));
    const next = [];
    const targetCells = t.cells;
    const oldParticles = particles;
    if (assembleFromRandom || oldParticles.length === 0) {
      for (let i = 0; i < targetCells.length; i++) {
        const tc = targetCells[i];
        next.push({
          sx: assembleFromRandom ? rng() * t.totalCols : tc.x,
          sy: assembleFromRandom ? rng() * t.totalRows : tc.y,
          tx: tc.x, ty: tc.y, x: tc.x, y: tc.y, vx: 0, vy: 0,
          delay: assembleFromRandom ? rng() * 380 : 0,
          color: DATA.tokens.ink, sparkle: false
        });
      }
      isAssembling = assembleFromRandom;
      morphDuration = 1100;
    } else {
      const count = Math.max(oldParticles.length, targetCells.length);
      for (let i = 0; i < count; i++) {
        const src = oldParticles[i % oldParticles.length];
        const dst = targetCells[i % targetCells.length];
        const isSparkle = rng() < 0.14;
        next.push({
          sx: src.x, sy: src.y, tx: dst.x, ty: dst.y, x: src.x, y: src.y, vx: 0, vy: 0,
          delay: (dst.x / t.totalCols) * 280,
          color: isSparkle ? TRACK_COLORS[Math.floor(rng() * 4)] : DATA.tokens.ink,
          sparkle: isSparkle
        });
      }
      isAssembling = false;
      morphDuration = 850;
    }
    particles = next;
    morphStart = performance.now();
    captionEl.textContent = DATA.copy.heroCycle[idx].caption;
  }

  function drawStatic() {
    sizeCanvas();
    if (cssW <= 0) return;
    const t = getTargetLayout(0);
    const cellW = cssW / t.totalCols;
    const cellH = Math.min(cellW / 1.2, cssH / t.totalRows);
    const oy = (cssH - cellH * t.totalRows) / 2;
    ctx.fillStyle = DATA.tokens.sodium;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = DATA.tokens.ink;
    for (let i = 0; i < t.cells.length; i++) {
      const c = t.cells[i];
      ctx.fillRect(Math.floor(c.x * cellW), Math.floor(oy + c.y * cellH), Math.ceil(cellW), Math.ceil(cellH));
    }
    captionEl.textContent = DATA.copy.heroCycle[0].caption;
  }

  function step(now) {
    if (!runtime.state.motionOn) {
      running = false;
      runtime.motion.remove(step);
      drawStatic();
      return;
    }
    if (cssW <= 0) sizeCanvas();
    if (cssW <= 0) return;
    const t = getTargetLayout(cycleIdx);
    const cellW = cssW / t.totalCols;
    const cellH = Math.min(cellW / 1.2, cssH / t.totalRows);
    const oy = (cssH - cellH * t.totalRows) / 2;
    const elapsed = now - morphStart;
    const easeFn = isAssembling ? easeAssemble : easeMorph;
    const repelRadius = cellW * 3;
    const maxDisp = 1.4;

    ctx.fillStyle = DATA.tokens.sodium;
    ctx.fillRect(0, 0, cssW, cssH);

    const buckets = new Map();
    buckets.set(DATA.tokens.ink, []);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const localT = Math.min(1, Math.max(0, (elapsed - p.delay) / morphDuration));
      const e = easeFn(localT);
      const baseX = p.sx + (p.tx - p.sx) * e;
      const baseY = p.sy + (p.ty - p.sy) * e;
      let targetDx = 0, targetDy = 0;
      if (pointerX > -5000) {
        const px = (baseX + 0.5) * cellW;
        const py = oy + (baseY + 0.5) * cellH;
        const dx = px - pointerX;
        const dy = py - pointerY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001 && dist < repelRadius) {
          const push = (1 - dist / repelRadius) * maxDisp;
          targetDx = (dx / dist) * push;
          targetDy = (dy / dist) * push;
        }
      }
      if (localT >= 1 && pointerX < -5000) {
        p.vx = 0; p.vy = 0; p.x = p.tx; p.y = p.ty;
      } else {
        p.vx = (p.vx + (targetDx - (p.x - baseX)) * 0.12) * 0.8;
        p.vy = (p.vy + (targetDy - (p.y - baseY)) * 0.12) * 0.8;
        p.x = baseX + (p.x - baseX) + p.vx;
        p.y = baseY + (p.y - baseY) + p.vy;
      }
      const col = (p.sparkle && elapsed < 420) ? p.color : DATA.tokens.ink;
      if (!buckets.has(col)) buckets.set(col, []);
      buckets.get(col).push(p);
    }
    buckets.forEach((list, col) => {
      ctx.fillStyle = col;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const x0 = Math.round(p.x * cellW * dpr) / dpr;
        const y0 = Math.round((oy + p.y * cellH) * dpr) / dpr;
        const x1 = Math.round((p.x + 1) * cellW * dpr) / dpr;
        const y1 = Math.round((oy + (p.y + 1) * cellH) * dpr) / dpr;
        ctx.fillRect(x0, y0, x1 - x0 + 0.3, y1 - y0 + 0.3);
      }
    });
  }

  function scheduleNext() {
    window.clearTimeout(holdTimer);
    if (!runtime.state.motionOn || !inView) return;
    holdTimer = window.setTimeout(() => {
      if (!runtime.state.motionOn || !inView || document.hidden) return;
      cycleIdx = (cycleIdx + 1) % DATA.copy.heroCycle.length;
      buildParticlesForTarget(cycleIdx, false);
      scheduleNext();
    }, 3400 + morphDuration);
  }

  function startLoop() {
    if (!runtime.state.motionOn) { drawStatic(); return; }
    if (!running) { running = true; runtime.motion.add(step); }
    scheduleNext();
  }

  function stopLoop() {
    window.clearTimeout(holdTimer);
    if (running) { running = false; runtime.motion.remove(step); }
  }

  sizeCanvas();
  if (runtime.state.motionOn) { buildParticlesForTarget(0, true); startLoop(); }
  else { drawStatic(); }

  canvas.addEventListener("click", () => {
    if (!runtime.state.motionOn) return;
    cycleIdx = (cycleIdx + 1) % DATA.copy.heroCycle.length;
    buildParticlesForTarget(cycleIdx, false);
    scheduleNext();
  });

  if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    canvas.addEventListener("pointermove", e => {
      const r = canvas.getBoundingClientRect();
      pointerX = e.clientX - r.left;
      pointerY = e.clientY - r.top;
    }, { passive: true });
    canvas.addEventListener("pointerleave", () => { pointerX = -9999; pointerY = -9999; });
  }

  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      inView = entry.isIntersecting;
      if (inView) startLoop(); else stopLoop();
    }
  }, { threshold: 0.05 });
  io.observe(canvas);

  let rTimer = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(rTimer);
    rTimer = window.setTimeout(() => {
      sizeCanvas();
      if (!runtime.state.motionOn) drawStatic();
      else buildParticlesForTarget(cycleIdx, false);
    }, 150);
  });
  ro.observe(canvas);

  const onMotionChange = () => {
    if (runtime.state.motionOn) { buildParticlesForTarget(cycleIdx, false); startLoop(); }
    else { stopLoop(); drawStatic(); }
  };
  window.addEventListener("docseek:motionchange", onMotionChange);

  runtime.state.routeCleanup.push(() => {
    stopLoop();
    io.disconnect();
    ro.disconnect();
    window.clearTimeout(rTimer);
    window.removeEventListener("docseek:motionchange", onMotionChange);
  });
}

function initCompressionGrid(container, runtime) {
  const cols = 20, rows = 5;
  const cells = [];
  for (const b of DATA.compressionBreakdown) {
    for (let i = 0; i < b.units; i++) {
      cells.push({ key: b.key, color: b.color, label: b.label, desc: b.desc });
    }
  }
  const cellW = 12, cellH = 12, gap = 2;
  const vbW = cols * (cellW + gap) - gap;
  const vbH = rows * (cellH + gap) - gap;

  let rects = "";
  for (let i = 0; i < cells.length; i++) {
    const x = (i % cols) * (cellW + gap);
    const y = Math.floor(i / cols) * (cellH + gap);
    rects += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${cells[i].color}" stroke="#0A0A0A" stroke-width="0.6" data-cell="${i}"/>`;
  }

  container.innerHTML = `
    <div class="capacity-svg-wrap" id="comp-svg-wrap" tabindex="0" role="img" aria-label="100 格上下文字符压缩对比矩阵：紧凑导航树仅占 20%，节省约 80% 字符">
      <svg class="capacity-svg" viewBox="0 0 ${vbW} ${vbH}" shape-rendering="crispEdges">${rects}</svg>
    </div>
    <div class="capacity-legend">
      ${DATA.compressionBreakdown.map(b => `
        <span class="legend-item t-micro">
          <span class="legend-swatch" style="background-color:${b.color};"></span>
          <span>${esc(b.label)}</span>
        </span>
      `).join("")}
    </div>
    <p class="t-small" id="comp-detail" style="margin-top:16px;">悬停或点击任意色块查看 InferForge 99 命中实测（4,374 字符 vs 21,582 字符 JSON）拆解。</p>
  `;

  const svg = container.querySelector("svg");
  const detailEl = container.querySelector("#comp-detail");

  svg.addEventListener("pointermove", e => {
    const rect = e.target.closest("[data-cell]");
    if (!rect) return;
    const info = cells[Number(rect.dataset.cell)];
    if (info) {
      runtime.showTip(rect.getBoundingClientRect(), info.label, false);
    }
  });
  svg.addEventListener("pointerleave", () => runtime.hideTip());
  svg.addEventListener("click", e => {
    const rect = e.target.closest("[data-cell]");
    if (!rect) return;
    const info = cells[Number(rect.dataset.cell)];
    if (info) {
      detailEl.textContent = `${info.label}：${info.desc}`;
    }
  });
}

export function renderHome(main, runtime) {
  document.title = DATA.copy.homeTitle;
  const splitHtml = DATA.copy.heroSplit.map(row => {
    if (!row.left && row.right) return `<div class="split-line only-right"><span class="frag-right t-h2">${esc(row.right)}</span></div>`;
    if (row.left && !row.right) return `<div class="split-line"><span class="frag-left t-h2">${esc(row.left)}</span></div>`;
    return `<div class="split-line"><span class="frag-left t-h2">${esc(row.left)}</span><span class="frag-right t-h2">${esc(row.right)}</span></div>`;
  }).join("");

  main.innerHTML = `
    <section class="hero-sec" data-surface="sodium">
      <h1 class="visually-hidden">${esc(DATA.copy.heroH1)}</h1>
      <div class="grid" style="padding-inline:0;">
        <div class="hero-top-meta t-micro">
          ${DATA.copy.heroMeta.map(line => `<div>${esc(line)}</div>`).join("")}
        </div>
        <div class="hero-top-date t-micro t-mono">${esc(DATA.copy.heroBadge)}</div>
      </div>

      <div class="hero-display-wrap">
        <canvas class="hero-canvas" id="hero-canvas" role="img" aria-label="DocSeek 像素矩阵主视觉，点击切换核心指标"></canvas>
        <div class="grid hero-sub-row" style="padding-inline:0;">
          <p class="hero-caption t-micro" id="hero-caption">${esc(DATA.copy.heroCycle[0].caption)}</p>
          <div class="hero-cmd-strip">
            <div class="cmd-inline">
              <span>$ ${esc(DATA.meta.npmCmd)}</span>
              <button type="button" class="cmd-copy-btn" id="hero-copy-cmd">复制</button>
            </div>
            <a class="hero-repo-link t-micro" href="${esc(DATA.meta.repoUrl)}" target="_blank" rel="noopener noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.09.73-.28.73-.55v-1.84c-3.03.64-3.67-1.46-3.67-1.46-.55-1.29-1.28-1.65-1.28-1.65-.92-.65.1-.65.1-.65 1.1 0 1.73 1.1 1.73 1.1.92 1.65 2.57 1.2 3.21.92a2 2 0 0 1 .64-1.47c-2.47-.27-5.04-1.19-5.04-5.5 0-1.1.46-2.1 1.2-2.84a3.76 3.76 0 0 1 0-2.93s.91-.28 3.11 1.1c1.8-.49 3.7-.49 5.5 0 2.1-1.38 3.02-1.1 3.02-1.1a3.76 3.76 0 0 1 0 2.93c.83.74 1.2 1.74 1.2 2.94 0 4.21-2.57 5.13-5.04 5.4.45.37.82.92.82 2.02v3.03c0 .27.1.64.73.55A11 11 0 0 0 12 1.27Z"/></svg>
              <span>GitHub 仓库</span>
            </a>
          </div>
        </div>
      </div>

      <div class="grid hero-bottom-row" style="padding-inline:0;">
        <div class="hero-cta-col">
          <a class="btn-primary t-small" href="#/quickstart"><span>快速开始</span></a>
          <a class="btn-outline t-small" href="#/sandbox"><span>在线检索沙盒</span></a>
        </div>
        <div class="hero-split-wrap">${splitHtml}</div>
      </div>
    </section>

    <section class="sec" data-surface="paper">
      <div class="grid">
        <p class="col-1-3 t-micro">(为什么需要 DOCSEEK)</p>
        <h2 class="col-5-12 t-h2 reveal-text">${esc(DATA.copy.aboutLead)}</h2>
      </div>
      <div class="grid about-paras">
        <p class="about-para-1 t-body">${esc(DATA.copy.aboutP1)}</p>
        <p class="about-para-2 t-body">${esc(DATA.copy.aboutP2)}</p>
      </div>
      <div class="grid">
        <div class="col-full pain-list">
          ${DATA.pains.map(p => `
            <div class="pain-row">
              <div class="t-micro t-mono fw-600">${esc(p.label)}</div>
              <div class="t-small"><strong>痛点：</strong>${esc(p.problem)}</div>
              <div class="t-small"><strong>DocSeek 解法：</strong>${esc(p.solution)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <section class="sec" data-surface="ink">
      <div class="grid">
        <p class="col-1-3 t-micro">(实测量化指标)</p>
        <div class="col-5-12">
          <h2 class="t-h2 t-paper reveal-text">单进程本地运行，真实语料可复现。</h2>
        </div>
      </div>
      <div class="grid stats-grid-row">
        <div class="stats-items">
          ${DATA.stats.map(st => `
            <div class="reveal-block">
              ${svgBitmapText(st.val, 6, DATA.tokens.sodium, { className: "stat-svg", ariaHidden: true, bold: true })}
              <p class="t-small t-paper fw-600 stat-label">${esc(st.label)}</p>
              <p class="t-micro t-mono" style="opacity:0.8;margin-top:2px;">${esc(st.sub)}</p>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="grid">
        <div class="col-full relay-block">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px;">
            <div>
              <p class="t-micro">(真实终端输出演示)</p>
              <h3 class="t-h2 t-paper" style="margin-top:6px;">发散词进入，紧凑树形坐标返回</h3>
            </div>
            <p class="t-micro t-mono">×N .平均分 · › 单支折叠 · L起-止 .得分</p>
          </div>
          <div class="relay-controls" id="scenario-tabs" role="tablist" aria-label="检索演示场景">
            ${DATA.searchScenarios.map((sc, idx) => `
              <button type="button" class="chip-toggle t-small" role="tab" data-sc="${esc(sc.id)}" aria-selected="${idx === 0 ? "true" : "false"}" aria-pressed="${idx === 0 ? "true" : "false"}">${esc(sc.step)} · ${esc(sc.mode)}</button>
            `).join("")}
          </div>
          <div class="relay-stage" id="scenario-stage"></div>
        </div>
      </div>
    </section>

    <section class="sec" data-surface="sodium">
      <div class="grid">
        <p class="col-1-3 t-micro">(四大架构支柱)</p>
        <h2 class="col-5-12 t-h2 reveal-text">${esc(DATA.copy.pillarsLead)}</h2>
      </div>
      <div class="grid tracks-grid" id="tracks-grid"></div>
    </section>

    <section class="sec" data-surface="paper">
      <div class="grid">
        <p class="col-1-3 t-micro">(Agent 检索闭环)</p>
        <h2 class="col-5-12 t-h2 reveal-text">${esc(DATA.copy.workflowLead)}</h2>
      </div>
      <div class="grid days-cols" id="days-cols"></div>
    </section>

    <section class="sec" data-surface="sodium">
      <div class="grid">
        <p class="col-1-3 t-micro">(Coding Agent 生态)</p>
        <h2 class="col-5-12 t-h2 reveal-text">${esc(DATA.copy.agentsLead)}</h2>
      </div>
      <div class="grid">
        <div class="col-full speakers-preview-grid" id="agents-preview-grid"></div>
        <div class="col-full speakers-footer-link">
          <a class="btn-text t-lead u-anim" href="#/agents">(查看全部 8 种 Agent 接入指南 →)</a>
        </div>
      </div>
    </section>

    <section class="sec" data-surface="paper">
      <div class="grid">
        <div class="poster-head-left">
          ${DATA.copy.posterLeftHead.map(line => `<div class="t-lead fw-600">${esc(line)}</div>`).join("")}
        </div>
        <div class="poster-head-right">
          ${DATA.copy.posterRightHead.map(line => `<div class="t-small t-mono" style="margin-bottom:4px;">${esc(line)}</div>`).join("")}
        </div>
        <div class="col-full poster-wall-wrap" id="poster-wall"></div>
        <p class="col-full t-micro poster-caption">(Fig. 1 — 点击任意织纹模块切换配色，展示 DocSeek 六项核心设计约束。)</p>
      </div>
    </section>

    <section class="sec" data-surface="sodium">
      <div class="grid">
        <p class="col-1-3 t-micro">(上下文压缩实测)</p>
        <div class="col-5-12">
          <h2 class="t-h2 reveal-text">99 处命中：从 21,582 字符压到 4,374 字符。</h2>
          <p class="t-body" style="margin-top:16px;">在 InferForge 真实索引（126 份 Markdown、1,598 章节）的 99 命中查询中，默认紧凑树相比同批 JSON 减少约 <strong>80% 字符</strong>与 <strong>88% 行数</strong>，且保留全部文件路径、标题层级、行区间与检索分数。</p>
          <figure class="capacity-fig" id="home-comp-wrap"></figure>
          <div class="passes-cta-row">
            <a class="btn-primary t-small" href="#/sandbox"><span>在检索沙盒里实测压缩率</span></a>
            <a class="btn-text t-small u-anim" href="#/docs">(查看完整 CLI 命令与评测手册 →)</a>
          </div>
        </div>
      </div>
    </section>
  `;

  // Hero canvas & copy
  initHeroCanvas(document.getElementById("hero-canvas"), document.getElementById("hero-caption"), runtime);
  document.getElementById("hero-copy-cmd").addEventListener("click", e => copyText(DATA.meta.npmCmd, e.currentTarget));

  // Interactive Search Scenarios
  const scTabs = Array.from(document.querySelectorAll("#scenario-tabs [data-sc]"));
  const scStage = document.getElementById("scenario-stage");
  function showScenario(id) {
    const sc = DATA.searchScenarios.find(x => x.id === id) || DATA.searchScenarios[0];
    scTabs.forEach(b => {
      const active = b.dataset.sc === sc.id;
      b.setAttribute("aria-selected", active ? "true" : "false");
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    scStage.innerHTML = `
      <div>
        <p class="t-micro t-mono">${esc(sc.channel)}</p>
        <h4 class="t-lead t-paper" style="margin-top:8px;">${esc(sc.mode)}</h4>
        <div class="cmd-inline" style="margin-top:16px;max-width:100%;overflow-x:auto;">
          <span>$ ${esc(sc.cmd)}</span>
          <button type="button" class="cmd-copy-btn" id="sc-copy-cmd">复制</button>
        </div>
        <p class="t-small t-paper" style="margin-top:16px;opacity:0.88;"><strong>管线动作：</strong>${esc(sc.action)}</p>
        <p class="t-micro t-mono" style="margin-top:12px;">输出通道：${esc(sc.file)}</p>
      </div>
      <div>
        <pre class="relay-code">${esc(sc.output)}</pre>
      </div>
    `;
    document.getElementById("sc-copy-cmd").addEventListener("click", e => copyText(sc.cmd, e.currentTarget));
  }
  scTabs.forEach(b => b.addEventListener("click", () => showScenario(b.dataset.sc)));
  showScenario(DATA.searchScenarios[0].id);

  // 4 Animated Pixel-Weave Pillars
  const tracksGrid = document.getElementById("tracks-grid");
  const weaveKeys = ["plus", "cross", "tartan", "basket"];
  tracksGrid.innerHTML = DATA.pillars.map(p => `
    <figure class="track-fig">
      <button type="button" class="track-panel-btn" data-pillar="${esc(p.id)}" style="--track-band:${p.color};">
        <svg class="track-panel-svg" viewBox="0 0 80 68" shape-rendering="crispEdges" aria-hidden="true"></svg>
        <div class="track-card-body">
          <div>
            <p class="t-micro t-mono">${esc(p.en)}</p>
            <h3 class="track-card-title" style="margin-top:6px;">${esc(p.label)}</h3>
            <p class="t-small track-card-desc">${esc(p.desc)}</p>
          </div>
          <div class="track-card-foot">
            <span class="t-micro t-mono fw-600">${esc(p.metric)}</span>
            <span class="track-card-arrow t-small" aria-hidden="true">↗</span>
          </div>
        </div>
      </button>
    </figure>
  `).join("");

  DATA.pillars.forEach((p, idx) => {
    const btn = tracksGrid.querySelector(`[data-pillar="${p.id}"]`);
    const svg = btn.querySelector(".track-panel-svg");
    const weave = WEAVES[weaveKeys[idx % 4]];
    let timer = 0, busy = false;
    function drawGrid(phase) {
      let out = `<rect x="0" y="0" width="80" height="68" fill="${p.color}"/>`;
      for (let y = 0; y < 17; y++) {
        for (let x = 0; x < 20; x++) {
          if (weave(x, y, phase) === 1) {
            out += `<rect x="${x * 4}" y="${y * 4}" width="4" height="4" fill="${p.fg}"/>`;
          }
        }
      }
      svg.innerHTML = out;
    }
    drawGrid(0);
    const play = () => {
      if (!runtime.state.motionOn || busy) return;
      busy = true;
      let step = 0;
      timer = window.setInterval(() => {
        step++;
        drawGrid(step % 6);
        if (step >= 6) { window.clearInterval(timer); drawGrid(0); busy = false; }
      }, 85);
    };
    btn.addEventListener("mouseenter", play);
    btn.addEventListener("click", () => { window.location.hash = p.route; });
    runtime.state.routeCleanup.push(() => window.clearInterval(timer));
  });

  // 3-Step Workflow Columns
  const daysCols = document.getElementById("days-cols");
  const tagClassMap = { hybrid: "tag-pink", tree: "tag-green", index: "tag-lavender", agent: "tag-blue" };
  daysCols.innerHTML = DATA.workflowSteps.map(step => `
    <div class="day-col">
      ${svgBitmapText(step.num, 8, DATA.tokens.ink, { className: "day-num-svg", ariaHidden: true, bold: true })}
      <h3 class="t-lead">${esc(step.title)}</h3>
      <p class="t-micro t-mono day-doors">${esc(step.sub)}</p>
      <div class="day-session-list">
        ${step.items.map(it => `
          <a class="day-session-row" href="#/docs" data-cat="${esc(it.cat)}">
            <div class="t-micro t-mono">${esc(it.time)}</div>
            <div class="t-small day-session-title">${esc(it.title)}</div>
            <p class="t-micro" style="margin-top:6px;line-height:1.5;">${esc(it.desc)}</p>
            <div class="day-session-meta">
              <span class="tag-inline t-micro ${tagClassMap[it.cat] || "tag-pink"}">${esc(it.tag)}</span>
            </div>
          </a>
        `).join("")}
      </div>
    </div>
  `).join("");

  // 8 Agents Pixel Grid
  const agentsGrid = document.getElementById("agents-preview-grid");
  agentsGrid.innerHTML = DATA.agents.map(ag => `
    <figure class="speaker-card">
      <a class="speaker-card-link" href="#/agents">
        <canvas class="portrait-canvas" data-agid="${esc(ag.id)}" role="img" aria-label="${esc(ag.name)} 像素徽标"></canvas>
        <figcaption class="speaker-card-figcap">
          <h3 class="t-lead speaker-card-name">${esc(ag.name)}</h3>
          <p class="t-micro speaker-card-role">${esc(ag.mode)}</p>
          <p class="t-micro t-mono speaker-card-talk">${ag.autoInject ? "postinstall 自动注入" : "通用 CLI / Rules"}</p>
        </figcaption>
      </a>
    </figure>
  `).join("");
  DATA.agents.forEach(ag => {
    const canvas = agentsGrid.querySelector(`canvas[data-agid="${ag.id}"]`);
    if (canvas) initEmblemCanvas(canvas, ag, runtime);
  });

  // Interactive Poster Wall
  const wall = document.getElementById("poster-wall");
  const CHIPS_LEFT = {
    tl: [
      { text: "DOCSEEK v0.2 · NAVIGATION FIRST", indent: 0 },
      { text: "自然语言与发散词进入", indent: 1 },
      { text: "文件 · 章节 · 行号返回", indent: 0 },
      { text: "正文留在项目中由 Agent 按需 Read", indent: 2 }
    ],
    mr: [
      { text: "HYBRID RECALL ENGINE", indent: 1 },
      { text: "sqlite-vec 0.45 + FTS5 0.55 (RRF k=8)", indent: 0 },
      { text: "绝对检索分 0–1 · 无答案自动过滤为空", indent: 2 }
    ],
    bl: [
      { text: "COMPACT TREE OUTPUT", indent: 1 },
      { text: "99 命中仅 4,374 字符 (vs JSON 21,582)", indent: 0 },
      { text: "单分支 / 与 › 折叠 · 省 80% 上下文", indent: 2 }
    ]
  };
  const CHIPS_RIGHT = {
    tl: [
      { text: "LOCAL FIRST · ZERO DAEMON", indent: 0 },
      { text: "Xenova/multilingual-e5-small q8 (118MB)", indent: 1 },
      { text: "单文件 .docseek/index.db (自动 gitignore)", indent: 0 },
      { text: "模型缓存后全程本地离线运行", indent: 2 }
    ],
    mr: [
      { text: "MDAST + HASH DELTA", indent: 1 },
      { text: "按标题层级与块边界切分，行号精准", indent: 0 },
      { text: "内容哈希增量更新 · 跨文件长度分桶", indent: 2 }
    ],
    bl: [
      { text: "ZERO-MCP AGENT ENTRY", indent: 1 },
      { text: "自动维护 Codex AGENTS.md & Claude CLAUDE.md", indent: 0 },
      { text: "索引时屏蔽自身规则区块，绝不自匹配", indent: 2 }
    ]
  };
  const chipsHTML = data => `
    <div class="poster-chips-layer" aria-hidden="true">
      <div class="chip-group chip-group-tl">${data.tl.map(x => `<span class="poster-chip-line t-small chip-indent-${x.indent}">${esc(x.text)}</span>`).join("")}</div>
      <div class="chip-group chip-group-mr">${data.mr.map(x => `<span class="poster-chip-line t-small chip-rindent-${x.indent}">${esc(x.text)}</span>`).join("")}</div>
      <div class="chip-group chip-group-bl">${data.bl.map(x => `<span class="poster-chip-line t-small chip-indent-${x.indent}">${esc(x.text)}</span>`).join("")}</div>
    </div>
  `;
  wall.innerHTML = `
    <div class="poster-stack poster-stack-left" id="poster-left">
      <button type="button" class="poster-mod" id="mod-m1" aria-label="切换织纹配色 1"></button>
      <button type="button" class="poster-mod" id="mod-m3" aria-label="切换织纹配色 2"></button>
      <button type="button" class="poster-mod" id="mod-m4" aria-label="切换织纹配色 3"></button>
      ${chipsHTML(CHIPS_LEFT)}
    </div>
    <div class="poster-stack poster-stack-right" id="poster-right">
      <button type="button" class="poster-mod" id="mod-m6" aria-label="切换织纹配色 4"></button>
      <button type="button" class="poster-mod" id="mod-m2" aria-label="切换织纹配色 5"></button>
      <button type="button" class="poster-mod" id="mod-m5" aria-label="切换织纹配色 6"></button>
      ${chipsHTML(CHIPS_RIGHT)}
    </div>
  `;
  const PALETTES = [
    ["#F3ACF0", "#FF5A36"], ["#2370E8", "#18B47E"], ["#F5B700", "#FF5A36"],
    ["#F3ACF0", "#2370E8"], ["#18B47E", "#F5B700"], ["#A98BF7", "#FF5A36"]
  ];
  const MODULES = [
    { id: "mod-m1", cols: 20, rows: 22, paletteIdx: 0, weave: WEAVES.plus, solidMask: (x, y) => (y < 6 ? 0 : -1) },
    { id: "mod-m2", cols: 20, rows: 22, paletteIdx: 1, weave: WEAVES.cross, solidMask: (x, y) => (x >= 13 ? 1 : -1) },
    { id: "mod-m3", cols: 20, rows: 18, paletteIdx: 2, weave: WEAVES.basket, solidMask: (x, y) => (y >= 12 ? 0 : -1) },
    { id: "mod-m4", cols: 20, rows: 18, paletteIdx: 3, weave: WEAVES.tartan, solidMask: (x, y) => (y >= 14 ? 1 : -1) },
    { id: "mod-m5", cols: 20, rows: 18, paletteIdx: 4, weave: WEAVES.basket, solidMask: (x, y) => (x < 4 ? 0 : -1) },
    { id: "mod-m6", cols: 20, rows: 18, paletteIdx: 5, weave: WEAVES.tartan, solidMask: (x, y) => (y < 4 ? 0 : -1) }
  ];
  MODULES.forEach(mod => {
    const btn = document.getElementById(mod.id);
    if (!btn) return;
    let palIdx = mod.paletteIdx, phase = 0, timer = 0;
    const draw = () => {
      const [colA, colB] = PALETTES[palIdx];
      let rects = `<rect x="0" y="0" width="${mod.cols * 4}" height="${mod.rows * 4}" fill="${colA}"/>`;
      for (let y = 0; y < mod.rows; y++) {
        for (let x = 0; x < mod.cols; x++) {
          const mask = mod.solidMask(x, y);
          const tone = mask !== -1 ? mask : mod.weave(x, y, phase);
          if (tone === 1) rects += `<rect x="${x * 4}" y="${y * 4}" width="4" height="4" fill="${colB}"/>`;
        }
      }
      btn.innerHTML = `<svg viewBox="0 0 ${mod.cols * 4} ${mod.rows * 4}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
    };
    draw();
    btn.addEventListener("click", () => {
      palIdx = (palIdx + 1) % PALETTES.length;
      if (!runtime.state.motionOn) { phase = (phase + 1) % 6; draw(); return; }
      window.clearInterval(timer);
      let steps = 0;
      draw();
      timer = window.setInterval(() => {
        phase = (phase + 1) % 6; draw(); steps++;
        if (steps >= 4) window.clearInterval(timer);
      }, 70);
    });
    runtime.state.routeCleanup.push(() => window.clearInterval(timer));
  });

  // 100-cell Compression Matrix
  initCompressionGrid(document.getElementById("home-comp-wrap"), runtime);
}
