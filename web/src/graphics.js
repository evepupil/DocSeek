import { DATA } from "./data.js";

export const TRACK_COLORS = [
  DATA.tokens.blue,
  DATA.tokens.pink,
  DATA.tokens.green,
  DATA.tokens.lavender
];

export const TRAIL_COLORS = [
  DATA.tokens.blue,
  DATA.tokens.pink,
  DATA.tokens.green,
  DATA.tokens.lavender,
  DATA.tokens.coral,
  DATA.tokens.mint,
  DATA.tokens.amber
];

export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function easeAssemble(t) {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

export function easeMorph(t) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function layoutGlyphLines(lines, gapRows = 2, bold = false) {
  const cells = [];
  let maxCols = 0;
  let rowOffset = 0;
  for (let l = 0; l < lines.length; l++) {
    const str = String(lines[l]).toUpperCase();
    let colOffset = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const g = (bold && DATA.boldGlyphs[ch]) || DATA.glyphs[ch] || DATA.glyphs[" "];
      const w = g[0].length;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < w; c++) {
          if (g[r][c] === "#") {
            cells.push({ x: colOffset + c, y: rowOffset + r });
          }
        }
      }
      colOffset += w + (i < str.length - 1 ? 1 : 0);
    }
    if (colOffset > maxCols) maxCols = colOffset;
    rowOffset += 9 + (l < lines.length - 1 ? gapRows : 0);
  }
  return { cols: maxCols, rows: rowOffset, cells };
}

export function svgBitmapText(str, cellH, fill, opts = {}) {
  const layout = layoutGlyphLines(Array.isArray(str) ? str : [str], 2, Boolean(opts.bold));
  const vbW = layout.cols * 5;
  const vbH = layout.rows * 4;
  const color = fill || "currentColor";
  let rects = "";
  if (opts.perCell) {
    for (let i = 0; i < layout.cells.length; i++) {
      const cell = layout.cells[i];
      rects += `<rect x="${cell.x * 5}" y="${cell.y * 4}" width="5" height="4" data-gx="${cell.x}" data-gy="${cell.y}"/>`;
    }
  } else {
    const rowMap = new Map();
    for (let i = 0; i < layout.cells.length; i++) {
      const cell = layout.cells[i];
      if (!rowMap.has(cell.y)) rowMap.set(cell.y, []);
      rowMap.get(cell.y).push(cell.x);
    }
    rowMap.forEach((xs, y) => {
      xs.sort((a, b) => a - b);
      let start = xs[0], prev = xs[0];
      for (let k = 1; k <= xs.length; k++) {
        if (k < xs.length && xs[k] === prev + 1) {
          prev = xs[k];
        } else {
          const span = prev - start + 1;
          rects += `<rect x="${start * 5}" y="${y * 4}" width="${span * 5}" height="4.04"/>`;
          if (k < xs.length) {
            start = xs[k];
            prev = xs[k];
          }
        }
      }
    });
  }
  const wAttr = opts.fluid ? `width="100%"` : `width="${layout.cols * cellH * 1.25}" height="${layout.rows * cellH}"`;
  const cls = opts.className ? ` class="${esc(opts.className)}"` : "";
  const aria = opts.ariaHidden ? ` aria-hidden="true"` : "";
  return `<svg${cls} viewBox="0 0 ${vbW} ${vbH}" ${wAttr} shape-rendering="crispEdges" fill="${color}"${aria}>${rects}</svg>`;
}

export function svgPixelIcon(name, size = 14) {
  const grids = {
    plus: ["..#..", "..#..", "#####", "..#..", "..#.."],
    minus: [".....", ".....", "#####", ".....", "....."],
    check: ["....#", "...#.", "#.#..", ".#...", "....."]
  };
  const g = grids[name] || grids.plus;
  let rects = "";
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (g[y][x] === "#") rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 5 5" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
}

export const WEAVES = {
  plus: (x, y, phase) => {
    const px = (x + phase) % 6;
    const py = (y + phase) % 6;
    const inA = (px === 1 && py <= 2) || (py === 1 && px <= 2);
    const inB = (px === 4 && py >= 3) || (py === 4 && px >= 3);
    return (inA || inB) ? 1 : 0;
  },
  cross: (x, y, phase) => {
    const px = (x + phase) % 4;
    const py = (y + phase) % 4;
    return (px === 1 || py === 1) ? 1 : 0;
  },
  tartan: (x, y, phase) => {
    const px = (x + phase) % 4;
    const py = (y + phase) % 4;
    return ((px < 2) !== (py < 2) || (px === 1 && py === 1)) ? 1 : 0;
  },
  basket: (x, y, phase) => {
    const px = (x + phase) % 4;
    const py = (y + phase) % 4;
    const block = ((Math.floor((x + phase) / 4) + Math.floor((y + phase) / 4)) % 2) === 0;
    return block ? (py % 2 === 0 ? 1 : 0) : (px % 2 === 0 ? 1 : 0);
  }
};

// Deterministic 32x32 pixel emblems for coding agents & CLI environments
export function buildAgentEmblemRows(agentId) {
  const rows = [];
  for (let y = 0; y < 32; y++) {
    let row = "";
    for (let x = 0; x < 32; x++) {
      const dx = x - 15.5;
      const dy = y - 15.5;
      const dist = Math.hypot(dx, dy);
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      let c = "0";
      if (agentId === "claude") {
        const ang = Math.atan2(dy, dx);
        const ray = Math.abs(Math.sin(ang * 4));
        if (dist < 12 && (ray < 0.28 || dist < 4.5)) c = "1";
        if (dist < 13 && dist > 11 && (x + y) % 2 === 0) c = "2";
        if (dist < 2.2) c = "3";
      } else if (agentId === "codex") {
        if (ax >= 11 && ax <= 12.5 && ay <= 12.5) c = "2";
        if (ay >= 11 && ay <= 12.5 && ax <= 12.5) c = "2";
        if (x >= 7 && x <= 14 && Math.abs((x - 7) - Math.abs(y - 14)) <= 1.2) c = "1";
        if (y >= 19 && y <= 21 && x >= 15 && x <= 23) c = "3";
      } else if (agentId === "cursor") {
        if (ax + ay <= 12) c = "1";
        if (ax + ay <= 12 && dx > 0 && dy > -ax * 0.4) c = "2";
        if (ax + ay <= 6 && dy < 0) c = "3";
      } else if (agentId === "gemini") {
        const star = Math.pow(ax / 12.5, 0.55) + Math.pow(ay / 12.5, 0.55);
        if (star <= 1.0) c = "1";
        if (star <= 0.58) c = "2";
        if (ax < 1.8 && ay < 1.8) c = "3";
      } else if (agentId === "opencode") {
        if (ay <= 11 && ((x >= 5 && x <= 8) || (x >= 23 && x <= 26))) c = "1";
        if ((y >= 5 && y <= 7 || y >= 24 && y <= 26) && ((x >= 5 && x <= 12) || (x >= 19 && x <= 26))) c = "1";
        if (ax <= 3.5 && ay <= 3.5) c = "2";
        if (ax <= 1.5 && ay <= 1.5) c = "3";
      } else if (agentId === "windsurf") {
        const wave1 = Math.sin(x * 0.35) * 3 + 11;
        const wave2 = Math.sin(x * 0.35 + 1.2) * 3 + 18;
        if (Math.abs(y - wave1) < 2.2) c = "1";
        if (Math.abs(y - wave2) < 2.2) c = "2";
        if (y > 23 && y < 26 && x > 5 && x < 26) c = "3";
      } else if (agentId === "aider") {
        // Tree-branch search locator emblem
        if (x >= 6 && x <= 8 && y >= 5 && y <= 26) c = "1";
        if ((y >= 9 && y <= 11 || y >= 17 && y <= 19 || y >= 24 && y <= 26) && x >= 8 && x <= 20) c = "1";
        if ((y >= 8 && y <= 12 || y >= 16 && y <= 20 || y >= 23 && y <= 27) && x >= 21 && x <= 25) c = "2";
        if (x >= 22 && x <= 24 && (y === 10 || y === 18 || y === 25)) c = "3";
      } else {
        // CI / JSON braces { } + pulse bar
        if (ay <= 11 && ((x >= 6 && x <= 8) || (x >= 23 && x <= 25))) c = "1";
        if (ay <= 2 && (x === 4 || x === 5 || x === 26 || x === 27)) c = "2";
        if ((y >= 5 && y <= 7 || y >= 24 && y <= 26) && (x >= 8 && x <= 11 || x >= 20 && x <= 23)) c = "1";
        if (ay <= 2 && x >= 12 && x <= 19) c = "3";
      }
      row += c;
    }
    rows.push(row);
  }
  return rows;
}

export async function copyText(text, btn) {
  const prev = btn ? btn.textContent : "";
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  if (btn) {
    btn.textContent = "已复制";
    window.setTimeout(() => {
      btn.textContent = prev;
    }, 1500);
  }
}
