import { DATA } from "./data.js";
import { TRACK_COLORS, TRAIL_COLORS, esc, makeRng, svgBitmapText } from "./graphics.js";
import { renderHome } from "./home.js";
import {
  renderAgents,
  renderArchitecture,
  renderDocs,
  renderNotFound,
  renderQuickstart,
  renderSandbox
} from "./subpages.js";

function defaultStampGrid() {
  const g = new Array(256).fill("1");
  const art = [
    "111111100000",
    "110000110000",
    "110110011000",
    "110110011000",
    "110000110000",
    "111111100000",
    "000000000000",
    "111110011111",
    "111110011111",
    "000000000000"
  ];
  for (let r = 0; r < art.length; r++) {
    for (let c = 0; c < art[r].length; c++) {
      if (art[r][c] === "1") g[(r + 3) * 16 + (c + 2)] = r < 6 ? "2" : c < 6 ? "3" : "5";
    }
  }
  return g.join("");
}

function storageGet(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function storageSet(key, val) {
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

const prefersReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const savedMotion = storageGet("docseek.motion", null);
const state = {
  motionOn: savedMotion === null ? !prefersReduce : Boolean(savedMotion),
  stampGrid: defaultStampGrid(),
  routeCleanup: []
};

// Shared rAF scheduler
const motion = (() => {
  const subs = new Set();
  let rafId = 0;
  function tick(now) {
    rafId = 0;
    if (document.visibilityState === "hidden" || subs.size === 0) return;
    for (const fn of Array.from(subs)) {
      try { fn(now); } catch { subs.delete(fn); }
    }
    if (subs.size > 0 && document.visibilityState !== "hidden") {
      rafId = window.requestAnimationFrame(tick);
    }
  }
  function ensure() {
    if (!rafId && subs.size > 0 && document.visibilityState !== "hidden") {
      rafId = window.requestAnimationFrame(tick);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    } else {
      ensure();
    }
  });
  return {
    add(fn) { subs.add(fn); ensure(); },
    remove(fn) {
      subs.delete(fn);
      if (subs.size === 0 && rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    }
  };
})();

function setMotionState(on) {
  state.motionOn = Boolean(on);
  storageSet("docseek.motion", state.motionOn);
  document.documentElement.classList.toggle("motion-on", state.motionOn);
  const label = state.motionOn ? "(动效: 开)" : "(动效: 关)";
  ["motion-toggle-desktop", "motion-toggle-mobile"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.textContent = label;
      btn.setAttribute("aria-pressed", state.motionOn ? "true" : "false");
    }
  });
  window.dispatchEvent(new CustomEvent("docseek:motionchange", { detail: { on: state.motionOn } }));
}

// Tooltip
const tipEl = document.getElementById("tip");
let tipTimer = 0;
function showTip(rect, text, immediate) {
  window.clearTimeout(tipTimer);
  const place = () => {
    tipEl.textContent = text;
    tipEl.classList.add("is-visible");
    const tr = tipEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tr.width / 2;
    let top = rect.top - tr.height - 8;
    if (left < 8) left = 8;
    if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
    if (top < 64) top = rect.bottom + 8;
    tipEl.style.left = Math.round(left) + "px";
    tipEl.style.top = Math.round(top) + "px";
  };
  if (immediate) place();
  else tipTimer = window.setTimeout(place, 120);
}
function hideTip() {
  window.clearTimeout(tipTimer);
  tipEl.classList.remove("is-visible");
}

// Pixel Cursor Trail
function initTrail() {
  if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;
  const canvas = document.getElementById("trail-canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = 12;
  const cells = [];
  let lastX = -999, lastY = -999, colIdx = 0, running = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function tick(now) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const age = now - c.born;
      if (age < 380) {
        const alpha = 1 - Math.floor((age / 380) * 4) / 4;
        ctx.globalAlpha = Math.max(0.15, alpha);
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, size, size);
        cells[alive++] = c;
      }
    }
    cells.length = alive;
    ctx.globalAlpha = 1;
    if (alive === 0) {
      running = false;
      motion.remove(tick);
    }
  }

  window.addEventListener("pointermove", e => {
    if (!state.motionOn) return;
    const gx = Math.floor(e.clientX / size) * size;
    const gy = Math.floor(e.clientY / size) * size;
    if (gx === lastX && gy === lastY) return;
    lastX = gx; lastY = gy;
    cells.push({ x: gx, y: gy, color: TRAIL_COLORS[colIdx++ % TRAIL_COLORS.length], born: performance.now() });
    if (cells.length > 18) cells.shift();
    if (!running) { running = true; motion.add(tick); }
  }, { passive: true });
}

// Page Transition Pixel Wipe
function playWipe(onMidpoint) {
  if (!state.motionOn) { onMidpoint(); return; }
  const canvas = document.getElementById("wipe-canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) { onMidpoint(); return; }
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.classList.add("is-active");
  const block = w < 768 ? 28 : 40;
  const cols = Math.ceil(w / block), rows = Math.ceil(h / block);
  const total = cols * rows;
  const order = Array.from({ length: total }, (_, i) => i);
  const rng = makeRng(Date.now());
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  const start = performance.now();
  let swapped = false;
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, w, h);
    if (elapsed < 180) {
      const count = Math.floor((elapsed / 180) * total);
      ctx.fillStyle = DATA.tokens.ink;
      for (let i = 0; i < count; i++) {
        const idx = order[i];
        ctx.fillRect((idx % cols) * block, Math.floor(idx / cols) * block, block + 0.5, block + 0.5);
      }
    } else if (elapsed < 380) {
      if (!swapped) { swapped = true; onMidpoint(); }
      const remain = total - Math.floor(((elapsed - 180) / 200) * total);
      ctx.fillStyle = DATA.tokens.ink;
      for (let i = total - remain; i < total; i++) {
        const idx = order[i];
        ctx.fillRect((idx % cols) * block, Math.floor(idx / cols) * block, block + 0.5, block + 0.5);
      }
    } else {
      if (!swapped) onMidpoint();
      canvas.classList.remove("is-active");
      motion.remove(frame);
    }
  }
  motion.add(frame);
}

// Header & Footer Chrome
function initChrome() {
  const logoLink = document.getElementById("header-logo-link");
  logoLink.innerHTML = svgBitmapText(DATA.meta.name, 4, "currentColor", {
    className: "logo-svg", perCell: true, ariaHidden: true, bold: true
  });

  const logoSvg = logoLink.querySelector("svg");
  if (logoSvg) {
    let jitterTimer = 0;
    logoLink.addEventListener("mouseenter", () => {
      if (!state.motionOn) return;
      const rects = Array.from(logoSvg.querySelectorAll("rect[data-gx]"));
      const rng = makeRng(Date.now());
      const dirs = [[0, 0], [5, 0], [-5, 0], [0, 4], [0, -4]];
      let step = 0;
      window.clearInterval(jitterTimer);
      const apply = () => {
        step++;
        if (step >= 5) {
          rects.forEach(r => {
            r.setAttribute("x", String(Number(r.dataset.gx) * 5));
            r.setAttribute("y", String(Number(r.dataset.gy) * 4));
          });
          window.clearInterval(jitterTimer);
          return;
        }
        rects.forEach(r => {
          const bx = Number(r.dataset.gx) * 5, by = Number(r.dataset.gy) * 4;
          if (step === 3) { r.setAttribute("x", String(bx)); r.setAttribute("y", String(by)); }
          else { const d = dirs[Math.floor(rng() * dirs.length)]; r.setAttribute("x", String(bx + d[0])); r.setAttribute("y", String(by + d[1])); }
        });
      };
      apply();
      jitterTimer = window.setInterval(apply, 60);
    });
  }

  document.getElementById("header-nav").innerHTML = DATA.nav.map(n =>
    `<a class="nav-link t-micro u-anim" href="${esc(n.href)}">(${esc(n.label)})</a>`
  ).join("");
  document.getElementById("menu-nav").innerHTML = DATA.nav.map(n =>
    `<a class="t-h1" href="${esc(n.href)}">${esc(n.label)}</a>`
  ).join("");

  const footer = document.getElementById("site-footer");
  const stairCells = 96;
  let stairRects = "";
  for (let i = 0; i < stairCells; i++) {
    stairRects += `<rect x="${i}" y="0" width="1" height="1" fill="${TRACK_COLORS[Math.floor(i / 4) % 4]}"/>`;
  }
  footer.innerHTML = `
    <div class="grid">
      <div class="col-full">
        ${svgBitmapText(DATA.meta.name, 10, DATA.tokens.sodium, { fluid: true, className: "footer-logo-svg", ariaHidden: true, bold: true })}
      </div>
    </div>
    <div class="grid footer-cols">
      <div class="footer-block">
        <p class="t-micro footer-block-head">(项目仓库)</p>
        <p class="t-small"><a class="u-anim" href="${esc(DATA.meta.repoUrl)}" target="_blank" rel="noopener noreferrer">github.com/evepupil/DocSeek</a><br>Node.js &gt;= 22 · TypeScript Strict<br>SQLite + sqlite-vec + FTS5</p>
      </div>
      <div class="footer-block">
        <p class="t-micro footer-block-head">(本地检索核心)</p>
        <p class="t-small">Xenova/multilingual-e5-small q8<br>RRF k=8 (Vec 0.45 + FTS 0.55)<br>紧凑导航树 (-80% 字符)</p>
      </div>
      <div class="footer-block">
        <p class="t-micro footer-block-head">(页面导航)</p>
        <ul class="footer-nav-list">
          <li><a class="btn-text t-small u-anim" href="#/">(首页)</a></li>
          ${DATA.nav.map(n => `<li><a class="btn-text t-small u-anim" href="${esc(n.href)}">(${esc(n.label)})</a></li>`).join("")}
        </ul>
      </div>
      <div class="footer-block">
        <p class="t-micro footer-block-head">(开源许可)</p>
        <p class="t-small">基于 MIT License 开源。欢迎通过 GitHub Issue 或 Pull Request 参与评测集扩充与特性贡献。</p>
      </div>
    </div>
    <div class="grid footer-bottom">
      <p class="footer-honesty t-small">DocSeek — Semantic Documentation Locator for AI Coding Agents. 检索是导航，而不是塞满上下文：纯本地单进程 CLI，无后台守护与 MCP 负担。</p>
      <p class="footer-ver t-micro t-mono">${esc(DATA.meta.version)} · MIT License</p>
    </div>
    <svg class="footer-staircase" viewBox="0 0 ${stairCells} 1" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${stairRects}</svg>
  `;

  document.getElementById("motion-toggle-desktop").addEventListener("click", () => setMotionState(!state.motionOn));
  document.getElementById("motion-toggle-mobile").addEventListener("click", () => setMotionState(!state.motionOn));
  setMotionState(state.motionOn);

  const menuEl = document.getElementById("menu");
  const openBtn = document.getElementById("menu-open-btn");
  const closeBtn = document.getElementById("menu-close-btn");
  const closeMenu = (returnFocus) => {
    menuEl.classList.remove("is-open");
    document.documentElement.classList.remove("menu-open");
    openBtn.setAttribute("aria-expanded", "false");
    if (returnFocus) openBtn.focus();
  };
  openBtn.addEventListener("click", () => playWipe(() => {
    menuEl.classList.add("is-open");
    document.documentElement.classList.add("menu-open");
    openBtn.setAttribute("aria-expanded", "true");
    closeBtn.focus();
  }));
  closeBtn.addEventListener("click", () => closeMenu(true));
  menuEl.addEventListener("click", e => { if (e.target.closest("a")) closeMenu(false); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      hideTip();
      if (menuEl.classList.contains("is-open")) closeMenu(true);
    }
  });

  document.getElementById("top-btn").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: state.motionOn ? "smooth" : "auto" });
  });
}

// Surface & Reveal Observers
let revealIO = null;
function setupObservers() {
  if (revealIO) revealIO.disconnect();
  const header = document.getElementById("site-header");
  const topBtn = document.getElementById("top-btn");
  const surfaceEls = Array.from(document.querySelectorAll("[data-surface]")).filter(
    el => el.id !== "site-header" && el.id !== "menu" && el.id !== "top-btn"
  );
  const syncSurfaces = () => {
    const hh = header.getBoundingClientRect().height || 64;
    const topY = hh + 4;
    const botY = window.innerHeight - 20;
    for (const el of surfaceEls) {
      const r = el.getBoundingClientRect();
      if (r.top <= topY && r.bottom >= topY) header.setAttribute("data-surface", el.getAttribute("data-surface"));
      if (r.top <= botY && r.bottom >= botY) topBtn.setAttribute("data-surface", el.getAttribute("data-surface"));
    }
    topBtn.classList.toggle("is-visible", window.scrollY >= window.innerHeight * 0.8);
  };
  window.addEventListener("scroll", syncSurfaces, { passive: true });
  state.routeCleanup.push(() => window.removeEventListener("scroll", syncSurfaces));
  syncSurfaces();

  const revealEls = Array.from(document.querySelectorAll(".reveal-text, .reveal-block"));
  if (!state.motionOn) {
    revealEls.forEach(el => { el.classList.remove("is-pending"); el.classList.add("is-shown"); });
  } else {
    revealEls.forEach(el => el.classList.add("is-pending"));
    revealIO = new IntersectionObserver(entries => {
      let batch = 0;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target;
          window.setTimeout(() => { el.classList.remove("is-pending"); el.classList.add("is-shown"); }, Math.min(batch++, 6) * 40);
          revealIO.unobserve(el);
        }
      }
    }, { threshold: 0.12 });
    revealEls.forEach(el => revealIO.observe(el));
  }
}

// Hash Router
const runtime = { state, motion, showTip, hideTip };
let currentRouteKey = null;

function parseRoute(hash) {
  const clean = (hash || "#/").replace(/^#/, "");
  if (clean === "" || clean === "/") return { view: "home", key: "home" };
  const seg = clean.split("/").filter(Boolean)[0];
  if (["agents", "architecture", "docs", "quickstart", "sandbox"].includes(seg)) {
    return { view: seg, key: seg };
  }
  return { view: "404", key: "404" };
}

function updateActiveNav(route) {
  const href = route.view === "home" ? "" : `#/${route.view}`;
  document.querySelectorAll("#header-nav a, #menu-nav a").forEach(a => {
    if (a.getAttribute("href") === href) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function mountRoute(route, skipWipe) {
  const main = document.getElementById("main");
  const doSwap = () => {
    while (state.routeCleanup.length > 0) {
      try { state.routeCleanup.pop()(); } catch {}
    }
    hideTip();
    if (route.view === "home") renderHome(main, runtime);
    else if (route.view === "agents") renderAgents(main, runtime);
    else if (route.view === "architecture") renderArchitecture(main);
    else if (route.view === "docs") renderDocs(main);
    else if (route.view === "quickstart") renderQuickstart(main);
    else if (route.view === "sandbox") renderSandbox(main, runtime);
    else renderNotFound(main);
    updateActiveNav(route);
    setupObservers();
    window.scrollTo(0, 0);
  };
  if (skipWipe) doSwap();
  else playWipe(doSwap);
}

function init() {
  initChrome();
  initTrail();
  const initial = parseRoute(window.location.hash);
  currentRouteKey = initial.key;
  mountRoute(initial, true);
  window.addEventListener("hashchange", () => {
    const next = parseRoute(window.location.hash);
    if (next.key === currentRouteKey) return;
    currentRouteKey = next.key;
    mountRoute(next, false);
  });
}

document.addEventListener("DOMContentLoaded", init);
