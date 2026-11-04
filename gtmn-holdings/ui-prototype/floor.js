/* GTMN Floor: 16-bit pixel office. One themed room per firm: desks, War Room (kickoff), Partners Room (review). */
(() => {
  const W = 320, H = 224, CY = 198, PH_MS = 11000;
  const FONT = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
    G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
    M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101",
    S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
    Y: "101101010010010", Z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
    4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001110",
    "-": "000000111000000", ".": "000000000000010", "+": "000010111010000", "!": "010010010000010", "&": "010101010101011", "/": "001001010100100", ":": "000010000010000", " ": "000000000000000"
  };
  const SHORT = { "ogc-dg": "OGC", "alliance-house": "ALLIANCE", "plan-house": "PLAN", "dg-ib": "DG-IB", "cio-ic-memo": "CIO", "spc-deal-team": "SPC", "zencredit-firm": "ZEN", "gtmn-cto": "CTO", dani: "DANI" };
  const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"], HAIR = ["#2b1b12", "#5a3825", "#a5612b", "#d9b45a", "#1a1a1a", "#8a8a8a"];
  const TH = {
    "ogc-dg": { fl: ["parquet", "#8a5a34", "#74492a"], wall: "#33241b", trim: "#c9a24a", desk: ["#6b4426", "#4e301b"], chair: "#5a1620", acc: "lamp", deco: ["books", "scales", "frame", "books"], lounge: [["sofa", 8, 200, "#5a1620"], ["globe", 150, 196]], rug: ["#7a1f2b", "#c9a24a"] },
    "alliance-house": { fl: ["checker", "#d9d1bd", "#cbc2ab"], wall: "#0f5e58", trim: "#e8d9a0", desk: ["#d8bf92", "#b39a6c"], chair: "#0f5e58", acc: "flag", deco: ["map", "flags", "clock", "map"], lounge: [["sofa", 8, 200, "#0f766e"], ["plant", 150, 196]], rug: ["#14b8a6", "#e8d9a0"] },
    "plan-house": { fl: ["carpet", "#dcd9f1", "#cfcbea"], wall: "#e6e4f5", trim: "#4F46E5", desk: ["#f4f2eb", "#bcb7d9"], chair: "#4F46E5", acc: "roll", deco: ["blueprint", "board", "window", "blueprint"], lounge: [["sofa", 8, 200, "#4F46E5"], ["plant", 150, 196]], rug: ["#8b85f0", "#ffffff"] },
    "dg-ib": { fl: ["checker", "#dad6cc", "#c5c0b3"], wall: "#14233f", trim: "#e0a030", desk: ["#2b4068", "#1c2c4a"], chair: "#111827", acc: "mug", deco: ["ticker", "bell", "ticker", "clock"], lounge: [["sofa", 8, 200, "#1f2937"], ["plant", 150, 196]], rug: ["#1e3a8a", "#e0a030"] },
    "cio-ic-memo": { fl: ["wood", "#b99466", "#ab8758"], wall: "#e8dfca", trim: "#1D4ED8", desk: ["#8a6a45", "#6a4f31"], chair: "#1e3a8a", acc: "pot", deco: ["window", "books", "clock", "window"], lounge: [["sofa", 8, 200, "#1e3a8a"], ["globe", 150, 196]], rug: ["#3b5bdb", "#e8dfca"] },
    "spc-deal-team": { fl: ["concrete", "#9b9ca3", "#8c8d94"], wall: "#8a4036", trim: "#BE123C", desk: ["#dcb67e", "#b68f58"], chair: "#2b2d38", acc: "sticker", deco: ["neon", "board", "neon", "board"], lounge: [["bean", 10, 204, "#BE123C"], ["bean", 34, 210, "#f59e0b"], ["kegs", 148, 196]], rug: ["#2b2d38", "#BE123C"], brick: 1 },
    "zencredit-firm": { fl: ["tech", "#1d2b27", "#25362f"], wall: "#0e1d17", trim: "#15803D", desk: ["#46544e", "#2f3b36"], chair: "#0e1d17", acc: "mug", deco: ["chart", "chart", "chart", "chart"], lounge: [["sofa", 8, 200, "#14532d"], ["plant", 150, 196]], rug: ["#15803d", "#0e1d17"] },
    "gtmn-cto": { fl: ["tech", "#1a2233", "#222c42"], wall: "#0e1526", trim: "#2F6FED", desk: ["#2a3248", "#1b2133"], chair: "#0e1526", acc: "can", deco: ["rack", "rack", "rack", "board"], lounge: [["bean", 10, 204, "#2F6FED"], ["bean", 34, 210, "#6b7280"], ["plant", 150, 196]], rug: ["#2F6FED", "#0e1526"] },
    dani: { fl: ["wood", "#c49a6c", "#b58b5c"], wall: "#4a2c4a", trim: "#C026D3", desk: ["#e8c9a0", "#c3a27a"], chair: "#C026D3", acc: "mug", deco: ["shelf", "frame", "window", "shelf"], lounge: [["sofa", 8, 200, "#C026D3"], ["plant", 150, 196]], rug: ["#C026D3", "#f5d0fe"] }
  };
  const DECO_X = [6, 38, 142, 174];
  const BOARD_TH = { fl: ["checker", "#2a2d36", "#252831"], wall: "#16181D", trim: "#c9a24a", desk: ["#3b2a1d", "#2a1d13"], chair: "#111", deco: [], rug: ["#7a1f2b", "#c9a24a"] };
  let raf = 0, room = "plenary", g = null;

  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const tw = s => s.length * 4 - 1;
  const T = (s, x, y, c, sc = 1) => {
    g.fillStyle = c; s = String(s).toUpperCase();
    for (let i = 0; i < s.length; i++) { const gl = FONT[s[i]] || FONT[" "]; for (let k = 0; k < 15; k++) if (gl[k] === "1") g.fillRect((x + i * 4 * sc + (k % 3) * sc) | 0, (y + ((k / 3) | 0) * sc) | 0, sc, sc); }
  };
  const pill = (s, cx, y, bg, fg) => { const w = tw(s) + 4; R(cx - w / 2, y, w, 7, bg); T(s, cx - w / 2 + 2, y + 1, fg); };

  /* ---------- static background ---------- */
  function floorTiles(th, x0, y0, x1, y1) {
    const [kind, c1, c2] = th.fl;
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
      const x = tx * 16, y = ty * 16, odd = (tx + ty) % 2;
      if (kind === "parquet") { R(x, y, 16, 16, c1); R(x, y + 7, 16, 1, c2); R(x, y + 15, 16, 1, c2); R(x + (odd ? 4 : 12), y, 1, 7, c2); R(x + (odd ? 12 : 4), y + 8, 1, 7, c2); }
      else if (kind === "checker") R(x, y, 16, 16, odd ? c1 : c2);
      else if (kind === "wood") { R(x, y, 16, 16, c1); for (let k = 0; k < 4; k++) R(x, y + k * 4 + 3, 16, 1, c2); R(x + ((ty * 5 + tx * 3) % 3) * 5 + 2, y, 1, 3, c2); }
      else if (kind === "concrete") { R(x, y, 16, 16, c1); R(x, y, 16, 1, c2); R(x, y, 1, 16, c2); for (let k = 0; k < 4; k++) R(x + ((tx * 7 + k * 5 + ty) % 15), y + ((ty * 3 + k * 7) % 15), 1, 1, c2); }
      else if (kind === "tech") { R(x, y, 16, 16, c1); R(x, y, 16, 1, c2); R(x, y, 1, 16, c2); R(x + 7, y + 7, 2, 2, c2); }
      else { R(x, y, 16, 16, c1); for (let k = 0; k < 5; k++) R(x + ((tx * 11 + k * 7 + ty * 3) % 15), y + ((ty * 13 + k * 5 + tx) % 15), 1, 1, c2); }
    }
  }
  function wallBase(th) {
    R(0, 0, W, 48, th.wall);
    if (th.brick) { for (let r = 0; r < 12; r++) { R(0, r * 4 + 3, W, 1, "#5c2a24"); for (let c = 0; c < 41; c++) R(c * 8 + (r % 2 ? 4 : 0), r * 4, 1, 3, "#5c2a24"); } }
    else for (let c = 0; c < 20; c++) R(c * 16, 8, 1, 32, mix(th.wall, "#000000", .12));
    R(0, 0, W, 4, mix(th.wall, "#000000", .35)); R(0, 40, W, 8, mix(th.wall, "#000000", .3)); R(0, 40, W, 1, th.trim);
  }
  function rugAt(th, x, y, w, h) { R(x, y, w, h, th.rug[0]); R(x + 2, y + 2, w - 4, h - 4, th.rug[1]); R(x + 4, y + 4, w - 8, h - 8, th.rug[0]); }
  function paintFirmBg(f, th) {
    floorTiles(th, 0, 3, 20, 14); wallBase(th);
    rugAt(th, 60, 202, 100, 22);
    const dark = mix(f.accent, "#101216", .6);
    // war room carpet + partners room carpet
    R(212, 48, 108, 96, dark); for (let y = 52; y < 144; y += 8) R(212, y, 108, 1, mix(dark, "#ffffff", .06));
    R(212, 148, 108, 76, "#23242c"); R(214, 150, 104, 72, "#2b2c35"); R(214, 150, 104, 1, th.trim); R(214, 221, 104, 1, th.trim);
    // dividers with doors
    const wallC = "#3a3f4b";
    [[48, 4], [76, 100], [212, 12]].forEach(([y, h]) => R(208, y, 4, h, wallC));
    R(208, 76, 4, 68, "#9fd3e6"); R(209, 76, 1, 68, "#d9f2fb");
    R(212, 144, 108, 4, wallC);
    R(206, 50, 8, 2, f.accent); R(206, 76, 8, 2, f.accent); R(206, 174, 8, 2, f.accent); R(206, 212, 8, 2, f.accent);
    // wall sign + war room banner
    const nm = f.name.toUpperCase().slice(0, 17), sw = tw(nm) + 12;
    R(104 - sw / 2 - 1, 9, sw + 2, 15, "#0b0c10"); R(104 - sw / 2, 10, sw, 13, f.accent); T(nm, 104 - tw(nm) / 2, 14, "#fff");
    R(104 - sw / 2, 25, sw, 1, th.trim);
    R(214, 4, 106, 36, mix(f.accent, "#101216", .35)); R(214, 40, 106, 1, f.accent);
    pill("WAR ROOM", 250, 41, f.accent, "#fff");
    pill("PARTNERS", 235, 151, "#c9a24a", "#1b1305");
    // door mats
    R(194, 56, 12, 16, mix(f.accent, "#000000", .1)); R(194, 180, 12, 28, mix(f.accent, "#000000", .1));
    // lounge furniture backgrounds (rug already drawn)
  }
  function paintBoardBg() {
    floorTiles(BOARD_TH, 0, 3, 20, 14); wallBase(BOARD_TH);
    R(60, 80, 200, 90, "#3a1017"); R(62, 82, 196, 86, "#541a24");
    R(120, 218, 80, 6, "#7a1f2b");
  }

  /* ---------- wall decor (animated) ---------- */
  const D = {
    books(x) { R(x, 8, 28, 31, "#3b2515"); const cs = ["#8a2b3a", "#2b4a8a", "#2b6a4a", "#c9a24a", "#5a3a8a", "#8a5a2b"]; for (let s = 0; s < 3; s++) { R(x + 1, 9 + s * 10, 26, 9, "#1d130b"); for (let i = 0; i < 9; i++) R(x + 2 + ((i * 2.7) | 0), 17 + s * 10 - (4 + (i * 3 + s) % 4), 2, 4 + (i * 3 + s) % 4, cs[(i + s * 2) % 6]); } },
    scales(x) { const c = "#d8b04a"; R(x + 13, 12, 2, 22, c); R(x + 4, 14, 20, 2, c); R(x + 2, 24, 8, 2, c); R(x + 18, 24, 8, 2, c); R(x + 5, 16, 1, 8, c); R(x + 22, 16, 1, 8, c); R(x + 9, 34, 10, 3, c); },
    frame(x) { R(x + 4, 10, 20, 24, "#d8b04a"); R(x + 6, 12, 16, 20, "#1d2a3a"); R(x + 8, 18, 12, 8, "#c9a24a"); R(x + 10, 14, 8, 3, "#8a2b3a"); },
    window(x) { R(x + 1, 8, 26, 30, "#6b4e33"); R(x + 3, 10, 22, 26, "#bfe0f2"); R(x + 13, 10, 2, 26, "#6b4e33"); R(x + 3, 22, 22, 2, "#6b4e33"); R(x + 5, 13, 6, 2, "#fff"); R(x + 17, 28, 6, 2, "#fff"); },
    map(x, t) { R(x, 9, 28, 28, "#0c3a52"); R(x + 1, 10, 26, 26, "#2f6f8f"); R(x + 3, 14, 7, 7, "#6aa36a"); R(x + 11, 18, 8, 9, "#6aa36a"); R(x + 20, 13, 6, 6, "#6aa36a"); R(x + 8, 17, 2, 2, ((t / 400) | 0) % 2 ? "#ff4d4d" : "#ffd0d0"); R(x + 15, 21, 2, 2, "#ff4d4d"); },
    flags(x, t) { const cs = ["#d94a4a", "#f2c14e", "#4a8fd9"]; for (let i = 0; i < 3; i++) { R(x + 3 + i * 9, 10, 1, 28, "#ccc"); R(x + 4 + i * 9, 11, 7, 5 + ((t / 300 + i) % 2 | 0), cs[i]); } },
    clock(x, t) { R(x + 7, 11, 14, 14, "#5a4a30"); R(x + 8, 12, 12, 12, "#f4efe2"); const a = t / 4000; R(x + 14, 14, 1, 5, "#222"); R(x + 14 + Math.round(Math.cos(a) * 3), 18 + Math.round(Math.sin(a) * 3), 2, 1, "#222"); },
    ticker(x, t) { R(x, 10, 28, 20, "#050805"); g.save(); g.beginPath(); g.rect(x + 1, 11, 26, 18); g.clip(); const o = -((t / 70) % 70); ["AAPL+1.2 MSFT-0.4 GS+0.8 ", "BRL-0.6 SPX+0.3 DXY-0.1 "].forEach((s, r) => { T(s + s, x + 1 + o + (r ? 20 : 0), 13 + r * 8, r ? "#ff5a5a" : "#3cff7a"); T(s + s, x + 1 + o + 70 + (r ? 20 : 0), 13 + r * 8, r ? "#ff5a5a" : "#3cff7a"); }); g.restore(); },
    bell(x) { const c = "#e0a030"; R(x + 10, 12, 8, 3, c); R(x + 8, 15, 12, 7, c); R(x + 6, 22, 16, 3, c); R(x + 13, 26, 2, 3, "#8a5a10"); R(x + 4, 32, 20, 3, "#5a3a10"); },
    blueprint(x) { R(x + 1, 10, 26, 22, "#1f3f94"); R(x + 2, 11, 24, 20, "#2a54b8"); for (let i = 0; i < 4; i++) R(x + 2, 15 + i * 5, 24, 1, "#4f78d8"); R(x + 7, 17, 10, 8, "#e8f0ff"); R(x + 9, 19, 6, 4, "#2a54b8"); R(x + 19, 16, 5, 1, "#e8f0ff"); },
    board(x) { R(x, 9, 28, 24, "#9aa0aa"); R(x + 1, 10, 26, 22, "#f4f4f4"); R(x + 3, 13, 5, 5, "#ffd54a"); R(x + 10, 13, 5, 5, "#ff8fa3"); R(x + 17, 13, 5, 5, "#7fd6ff"); R(x + 6, 21, 5, 5, "#b8f08a"); R(x + 14, 23, 10, 1, "#444"); R(x + 14, 26, 7, 1, "#444"); },
    chart(x, t) { R(x, 10, 28, 24, "#041009"); R(x + 1, 11, 26, 22, "#08130f"); for (let i = 0; i < 6; i++) { const h = 3 + (((Math.sin(t / 700 + i * 1.3) + 1) * 6) | 0); R(x + 3 + i * 4, 31 - h, 3, h, "#37d67a"); } R(x + 2, 31, 24, 1, "#1d5a3a"); },
    rack(x, t) { R(x + 6, 7, 16, 32, "#0b0e14"); for (let k = 0; k < 5; k++) { R(x + 8, 10 + k * 6, 12, 4, "#232a36"); R(x + 9, 11 + k * 6, 1, 1, (((t / 250) | 0) + k) % 3 ? "#3cff7a" : "#ff5a3c"); R(x + 12, 11 + k * 6, 6, 1, "#394255"); } },
    neon(x, t) { R(x, 10, 28, 24, "#1d0a16"); const on = ((t / 900) | 0) % 7 !== 0; if (on) { R(x + 2, 13, 24, 1, "#ff4fa3"); R(x + 2, 31, 24, 1, "#ff4fa3"); } T("GO!", x + 3, 18, on ? "#ff7ac0" : "#5a2a45", 2); },
    shelf(x) { R(x + 2, 26, 24, 2, "#6b4e33"); R(x + 4, 20, 6, 6, "#c3623a"); R(x + 6, 14, 2, 6, "#3a8a4a"); R(x + 11, 19, 3, 7, "#2b4a8a"); R(x + 14, 17, 3, 9, "#c9a24a"); R(x + 19, 21, 5, 5, "#e5e5e5"); }
  };
  const tvDraw = (f, t) => { R(236, 8, 62, 30, "#0b0c10"); R(237, 9, 60, 28, mix(f.accent, "#000000", .55)); for (let i = 0; i < 9; i++) { const h = 3 + (((Math.sin(t / 650 + i) + 1) * 7) | 0); R(240 + i * 6, 34 - h, 4, h, f.accent); } T("MANDATE", 241, 12, "#fff"); };

  /* ---------- props ---------- */
  const P = {
    plant(o) { R(o.x + 2, o.y + 10, 10, 8, "#b0643a"); R(o.x + 2, o.y + 10, 10, 2, "#c97c4e"); R(o.x + 3, o.y + 2, 8, 9, "#2f8a4a"); R(o.x, o.y + 5, 14, 5, "#3aa35a"); R(o.x + 5, o.y - 2, 4, 5, "#3aa35a"); },
    cooler(o) { R(o.x + 3, o.y, 10, 8, "#9bd3ea"); R(o.x + 4, o.y + 1, 3, 5, "#d9f2fb"); R(o.x + 2, o.y + 8, 12, 12, "#e5e7eb"); R(o.x + 2, o.y + 8, 12, 2, "#c7cbd2"); R(o.x + 5, o.y + 12, 2, 2, "#3b82f6"); R(o.x + 9, o.y + 12, 2, 2, "#ef4444"); },
    sofa(o) { const c = o.c, d = mix(c, "#000000", .3); R(o.x, o.y, 48, 8, d); R(o.x + 2, o.y + 2, 44, 6, c); R(o.x, o.y + 8, 48, 8, c); R(o.x, o.y + 8, 5, 10, d); R(o.x + 43, o.y + 8, 5, 10, d); R(o.x + 5, o.y + 8, 38, 1, d); R(o.x + 5, o.y + 16, 38, 2, d); },
    bean(o) { R(o.x, o.y + 2, 22, 14, mix(o.c, "#000000", .3)); R(o.x + 1, o.y, 20, 14, o.c); R(o.x + 5, o.y + 3, 6, 2, mix(o.c, "#fff", .35)); },
    kegs(o) { R(o.x, o.y + 2, 16, 20, "#8c8f96"); R(o.x + 1, o.y + 3, 14, 18, "#c7cbd2"); R(o.x + 1, o.y + 8, 14, 2, "#8c8f96"); R(o.x + 12, o.y, 3, 4, "#f59e0b"); R(o.x + 3, o.y + 12, 8, 4, "#BE123C"); },
    globe(o) { R(o.x + 3, o.y + 14, 8, 3, "#6b4e33"); R(o.x + 6, o.y + 10, 2, 5, "#6b4e33"); R(o.x + 1, o.y + 1, 12, 11, "#3a7ab8"); R(o.x + 3, o.y + 3, 4, 4, "#6aa36a"); R(o.x + 8, o.y + 6, 3, 4, "#6aa36a"); R(o.x + 1, o.y + 1, 2, 11, "#5a98d0"); }
  };
  const ACC = {
    lamp(x, y) { R(x + 23, y - 5, 3, 3, "#1f7a4a"); R(x + 24, y - 2, 1, 3, "#c9a24a"); }, flag(x, y) { R(x + 24, y - 7, 1, 8, "#ccc"); R(x + 25, y - 7, 4, 3, "#d94a4a"); },
    roll(x, y) { R(x + 21, y - 2, 6, 3, "#e8f0ff"); R(x + 21, y - 2, 1, 3, "#4F46E5"); }, mug(x, y) { R(x + 24, y - 1, 3, 3, "#fff"); R(x + 24, y - 1, 3, 1, "#c9a24a"); },
    pot(x, y) { R(x + 23, y - 1, 4, 3, "#b0643a"); R(x + 23, y - 4, 4, 3, "#3aa35a"); }, sticker(x, y) { R(x + 21, y - 1, 6, 4, "#d1d5db"); R(x + 23, y, 2, 2, "#BE123C"); }, can(x, y) { R(x + 24, y - 3, 3, 5, "#22c55e"); R(x + 24, y - 3, 3, 1, "#e5e7eb"); }
  };

  /* ---------- agent sprite ---------- */
  function sprite(a, t, sel) {
    const x = a.x | 0, y = a.y | 0, w = a.moving ? ((t / 140) | 0) % 2 : 0, T0 = y - 16 - (a.moving && w ? 1 : 0);
    if (!a.sit) R(x - 5, y - 1, 10, 3, "rgba(0,0,0,.28)");
    if (!a.sit) { R(x - 3, T0 + 12, 3, 4 - (w ? 1 : 0), "#2b2d38"); R(x, T0 + 12, 3, 4 - (w ? 0 : 1), "#2b2d38"); R(x - 3, y - 1, 3, 1, "#0c0d11"); R(x, y - 1, 3, 1, "#0c0d11"); }
    R(x - 4, T0 + 7, 8, 5, a.col); R(x - 5, T0 + 8, 1, 4, a.col); R(x + 4, T0 + 8, 1, 4, a.col); R(x - 4, T0 + 11, 8, 1, mix(a.col, "#000000", .25));
    R(x - 5, T0 + 12, 1, 1, a.skin); R(x + 4, T0 + 12, 1, 1, a.skin);
    R(x - 3, T0 + 1, 6, 6, a.skin);
    if (a.dir === "u") R(x - 3, T0, 6, 5, a.hair);
    else if (a.dir === "d") { R(x - 3, T0, 6, 2, a.hair); R(x - 3, T0 + 2, 1, 2, a.hair); R(x + 2, T0 + 2, 1, 2, a.hair); R(x - 2, T0 + 4, 1, 1, "#111"); R(x + 1, T0 + 4, 1, 1, "#111"); R(x - 1, T0 + 8, 2, 2, "#fff"); }
    else { const r = a.dir === "r"; R(x - 3, T0, 6, 2, a.hair); R(r ? x - 3 : x, T0 + 2, 3, 3, a.hair); R(r ? x + 1 : x - 2, T0 + 4, 1, 1, "#111"); }
    R(x - 3, T0 + 6, 6, 1, mix(a.skin, "#000000", .1));
  }
  function bubble(a, t) {
    const x = (a.x | 0) + 4, y = (a.y | 0) - 33 + (a.ask ? ((t / 220) % 2 | 0) : 0);
    R(x, y, 11, 9, "#16181D"); R(x + 1, y + 1, 9, 7, "#fff"); R(x + 2, y + 9, 2, 2, "#16181D"); R(x + 2, y + 8, 2, 1, "#fff");
    if (a.ask) T("!", x + 4, y + 2, "#c2410c"); else { const n = ((t / 280) | 0) % 3; for (let i = 0; i < 3; i++) R(x + 2 + i * 3, y + 4, 2, 2, i <= n ? "#16181D" : "#c9ccd3"); }
  }

  function mount(host, api) {
    cancelAnimationFrame(raf);
    host.innerHTML = `<div class="fl-bar" id="flbar"></div>
      <div class="fl-hud" id="flhud"></div>
      <div class="fl-wrap" id="flwrap"><div class="fl-stage" id="flstage"><canvas id="flcv" width="${W}" height="${H}" aria-label="Pixel office floor"></canvas><i class="fl-crt"></i></div><div class="fl-tip" id="fltip" hidden></div></div>
      <p class="fl-legend"><b>!</b> asking you &nbsp;·&nbsp; <b>…</b> working &nbsp;·&nbsp; <b>WAR ROOM</b> kickoff &nbsp;·&nbsp; <b>PARTNERS</b> review &nbsp;·&nbsp; tap any character</p>`;
    const cv = host.querySelector("#flcv"), wrap = host.querySelector("#flwrap"), stage = host.querySelector("#flstage"), tip = host.querySelector("#fltip"), bar = host.querySelector("#flbar"), hud = host.querySelector("#flhud");
    const main = cv.getContext("2d"); main.imageSmoothingEnabled = false;
    let scale = 2, sel = null, cur = null, last = performance.now(), lastSync = -1e9, t0 = performance.now();
    const bgCache = {};

    const firmById = id => api.byId[id];
    const rooms = {};

    /* ----- room construction ----- */
    function makeFirmRoom(f) {
      const th = TH[f.id] || TH.dani, desks = [], objs = [], meet = [], part = [], idle = [];
      for (let i = 0; i < 12; i++) {
        const c = i % 4, r = (i / 4) | 0, dx = 10 + 48 * c, dy = 64 + 48 * r, ax = 48 + 48 * c, sy = dy + 4;
        const spot = { x: dx + 20, y: sy, sit: 1, dir: "d", out: [{ x: dx + 20, y: sy }, { x: ax, y: sy }, { x: ax, y: CY }] };
        desks.push({ x: dx, y: dy, i, spot, on: 0 });
      }
      [[242, 98, 1], [258, 98, 1], [274, 98, 1], [290, 98, 1]].forEach(([x, y]) => meet.push({ x, y, sit: 1, dir: "d", chair: 1, out: [{ x, y }, { x, y: 64 }, { x: 192, y: 64 }, { x: 192, y: CY }] }));
      [242, 258, 274, 290].forEach(x => meet.push({ x, y: 140, sit: 1, dir: "u", chair: 1, out: [{ x, y: 140 }, { x: 226, y: 140 }, { x: 226, y: 64 }, { x: 192, y: 64 }, { x: 192, y: CY }] }));
      [[252, 158], [270, 158], [288, 158]].forEach(([x, y]) => part.push({ x, y, sit: 1, dir: "d", chair: 1, out: [{ x, y }, { x: 226, y }, { x: 226, y: CY }, { x: 192, y: CY }] }));
      part.push({ x: 232, y: 176, sit: 1, dir: "r", chair: 1, out: [{ x: 232, y: 176 }, { x: 226, y: 176 }, { x: 226, y: CY }, { x: 192, y: CY }] });
      part.push({ x: 308, y: 176, sit: 1, dir: "l", chair: 1, out: [{ x: 308, y: 176 }, { x: 308, y: CY }, { x: 192, y: CY }] });
      for (let i = 0; i < 5; i++) idle.push({ x: 68 + i * 20, y: 208, dir: "d", out: [{ x: 68 + i * 20, y: 208 }, { x: 68 + i * 20, y: CY }] });
      for (let i = 0; i < 4; i++) idle.push({ x: 78 + i * 20, y: 219, dir: "d", out: [{ x: 78 + i * 20, y: 219 }, { x: 78 + i * 20, y: CY }] });
      th.lounge.forEach(([k, x, y, c]) => objs.push({ k: y + 18, d: () => P[k]({ x, y, c }) }));
      objs.push({ k: 140, d: () => { R(234, 96, 64, 26, mix(f.accent, "#000000", .2)); R(234, 96, 64, 2, mix(f.accent, "#ffffff", .25)); R(234, 122, 64, 4, mix(f.accent, "#000000", .5)); } });
      objs.push({ k: 71, d: () => P.plant({ x: 300, y: 54 }) });
      objs.push({ k: 186, d: () => { R(240, 160, 62, 20, "#3b2a1d"); R(240, 160, 62, 2, "#c9a24a"); R(240, 180, 62, 4, "#1c140d"); R(262, 166, 18, 8, mix(f.accent, "#000000", .1)); } });
      objs.push({ k: 222, d: () => P.plant({ x: 302, y: 204 }) });
      return { id: f.id, firm: f, th, desks, meet, part, idle, objs, agents: new Map(), phase: 0, counts: {} };
    }
    function makeBoard() {
      const seats = [];
      for (let i = 0; i < 5; i++) { const x = 106 + i * 27; seats.push({ x, y: 98, sit: 1, dir: "d", chair: 1, out: [{ x, y: 98 }, { x: 62, y: 98 }, { x: 62, y: 190 }, { x: 160, y: 190 }] }); }
      for (let i = 0; i < 5; i++) { const x = 106 + i * 27; seats.push({ x, y: 168, sit: 1, dir: "u", chair: 1, out: [{ x, y: 168 }, { x, y: 190 }, { x: 160, y: 190 }] }); }
      return { id: "plenary", firm: { id: "plenary", name: "Plenary boardroom", accent: "#16181D" }, th: BOARD_TH, seats, objs: [], agents: new Map(), isBoard: 1 };
    }

    /* ----- agents ----- */
    function newAgent(f, ag, spot, spawn) {
      const h = hash(ag.name + f.id);
      const a = { id: ag.id, fid: f.id, name: ag.name, col: f.accent, skin: SKIN[h % 5], hair: HAIR[(h >> 3) % 6], x: (spawn || spot).x, y: (spawn || spot).y, dir: spot.dir || "d", sit: !spawn && !!spot.sit, moving: false, path: [], spot, want: spot, st: "working", seed: h };
      if (spawn) { a.spot = { x: spawn.x, y: spawn.y, out: [] }; a.sit = false; go(a, spot); }
      return a;
    }
    function go(a, spot) {
      const A = a.spot.out && a.spot.out.length ? a.spot.out.slice() : [{ x: a.x, y: a.y }];
      const B = spot.out.slice().reverse();
      const hubA = A[A.length - 1], hubB = B[0], pts = [];
      A.slice(1).forEach(p => pts.push(p));
      pts.push({ x: hubB.x, y: hubA.y });
      B.slice(1).forEach(p => pts.push(p));
      const dedupe = []; let px = a.x, py = a.y;
      pts.forEach(p => { if (p.x !== px || p.y !== py) { dedupe.push(p); px = p.x; py = p.y; } });
      a.path = dedupe; a.spot = spot; a.sit = false; a.moving = a.path.length > 0; if (!a.moving) { a.sit = !!spot.sit; a.dir = spot.dir || "d"; }
    }
    function step(a, dt) {
      if (!a.path.length) return;
      const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.abs(dx) + Math.abs(dy), sp = 46 * dt;
      if (d <= sp) { a.x = p.x; a.y = p.y; a.path.shift(); }
      else { if (Math.abs(dx) >= Math.abs(dy)) { a.x += Math.sign(dx) * sp; a.dir = dx > 0 ? "r" : "l"; } else { a.y += Math.sign(dy) * sp; a.dir = dy > 0 ? "d" : "u"; } }
      if (!a.path.length) { a.moving = false; a.sit = !!a.spot.sit; a.dir = a.spot.dir || "d"; if (a.pending) { const s = a.pending; a.pending = null; if (s !== a.spot) go(a, s); } }
    }

    /* ----- assignment from live state ----- */
    function sync(r, t) {
      const f = r.firm;
      if (r.isBoard) {
        const ids = api.convened();
        ids.slice(0, 10).forEach((id, i) => {
          const fm = firmById(id); if (!fm) return; let a = r.agents.get(id);
          if (!a) { a = newAgent({ id, accent: fm.accent }, { id, name: fm.name }, r.seats[i], { x: 160, y: 236 }); a.st = "working"; r.agents.set(id, a); }
          a.rep = fm; a.task = "Writing a blind position for the mandate";
        });
        [...r.agents.keys()].forEach(id => { if (!ids.includes(id)) r.agents.delete(id); });
        r.counts = { board: ids.length };
        return;
      }
      const ph = r.phase = Math.floor((t - t0) / PH_MS) % 3;
      const all = f.agents.map(a => ({ a, st: api.state(f.id, a.id) }));
      const work = all.filter(o => o.st !== "idle"), bench = all.filter(o => o.st === "idle");
      const want = new Map(); let m = 0, p = 0, desk = 0;
      r.desks.forEach(d => d.on = 0);
      work.slice(0, 12).forEach((o, i) => {
        let spot = r.desks[i].spot; r.desks[i].on = 1;
        if (o.st !== "asking") { if (ph === 0 && m < 8) spot = r.meet[m++]; else if (ph === 2 && p < 3 && m === 0) spot = r.part[p++]; }
        if (spot === r.desks[i].spot) desk++;
        want.set(o.a.id, { o, spot });
      });
      bench.slice(0, 9).forEach((o, i) => want.set(o.a.id, { o, spot: r.idle[i] }));
      [...r.agents.keys()].forEach(id => { if (!want.has(id)) r.agents.delete(id); });
      want.forEach(({ o, spot }, id) => {
        let a = r.agents.get(id);
        if (!a) { a = newAgent(f, o.a, spot); r.agents.set(id, a); }
        a.st = o.st; a.task = api.task(f.id, id);
        if (spot !== a.spot && spot !== a.pending) { if (a.moving) a.pending = spot; else go(a, spot); }
      });
      r.counts = { war: m, par: p, desk, bench: bench.length, work: work.length, more: Math.max(0, work.length - 12), benchMore: Math.max(0, bench.length - 9) };
    }

    /* ----- drawing ----- */
    function bgFor(r) {
      if (bgCache[r.id]) return bgCache[r.id];
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const og = c.getContext("2d"), prev = g; g = og;
      if (r.isBoard) paintBoardBg(); else paintFirmBg(r.firm, r.th);
      g = prev; bgCache[r.id] = c; return c;
    }
    function drawDesk(r, d, t) {
      const th = r.th, x = d.x, y = d.y;
      R(x + 15, y - 4, 10, 9, th.chair); R(x + 15, y - 4, 10, 2, mix(th.chair, "#ffffff", .2));
      R(x, y, 28, 8, th.desk[0]); R(x, y, 28, 1, mix(th.desk[0], "#ffffff", .25)); R(x, y + 8, 28, 4, th.desk[1]);
      R(x + 3, y - 6, 9, 7, "#15171c"); R(x + 4, y - 5, 7, 5, d.on ? "#1e3550" : "#2b2f3a");
      if (d.on) { R(x + 5, y - 4, 2 + (((t / 220) + d.i) % 4 | 0), 1, "#7be3ff"); R(x + 5, y - 2, 3 + (((t / 310) + d.i) % 3 | 0), 1, "#a5f3a0"); R(x + 4, y - 5, 7, 1, "#2b5a85"); }
      R(x + 7, y + 1, 1, 1, "#15171c"); R(x + 4, y + 3, 9, 2, "#c9c9c9");
      (ACC[r.th.acc] || ACC.mug)(x, y);
    }
    function drawChairs(spots) { spots.forEach(s => { if (s.chair) { R(s.x - 5, s.y - 10, 10, 9, "#2b2d38"); R(s.x - 5, s.y - 10, 10, 2, "#4a4f5c"); } }); }
    function drawBoardTable() {
      R(82, 100, 156, 52, "#2a1d13"); R(80, 104, 160, 44, "#2a1d13"); R(84, 102, 152, 48, "#5a3a22"); R(84, 102, 152, 2, "#8a5a34"); R(84, 148, 152, 4, "#1c140d");
      R(150, 120, 20, 10, "#c9a24a"); T("GTMN", 153, 123, "#1b1305");
    }
    function bannersAndLedger(r, t) {
      const ids = api.convened();
      ids.slice(0, 6).forEach((id, i) => { const fm = firmById(id); if (!fm) return; const x = 8 + i * 22 + (i > 2 ? 0 : 0); const bx = i < 3 ? 14 + i * 24 : 240 + (i - 3) * 24; R(bx, 6, 18, 30, fm.accent); R(bx, 36, 18, 3, mix(fm.accent, "#000000", .4)); R(bx + 2, 38, 14, 2, fm.accent); T((SHORT[id] || fm.name).slice(0, 4), bx + 9 - tw((SHORT[id] || fm.name).slice(0, 4)) / 2, 18, "#fff"); });
      R(94, 8, 132, 30, "#0b0c10"); R(95, 9, 130, 28, "#14201a"); T("FACT LEDGER", 100, 12, "#7be3a0");
      for (let i = 0; i < 4; i++) { const w = 20 + ((hash("f" + i) % 70)); R(100, 20 + i * 4, Math.min(w, ((t / 60 + i * 30) % 110)), 2, i % 2 ? "#37d67a" : "#a5f3a0"); }
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const r = rooms[room]; if (!r) return;
      if (now - lastSync > 700) { lastSync = now; sync(r, now); updateHud(r); }
      r.agents.forEach(a => step(a, dt));
      g = main; g.clearRect(0, 0, W, H); g.drawImage(bgFor(r), 0, 0);
      const t = now;
      if (r.isBoard) bannersAndLedger(r, t);
      else {
        r.th.deco.forEach((k, i) => D[k](DECO_X[i], t)); tvDraw(r.firm, t);
        R(0, 0, 0, 0, "#000");
      }
      const list = [];
      if (r.isBoard) { list.push({ k: 152, d: drawBoardTable }); }
      else { r.desks.forEach(d => list.push({ k: d.y + 12, d: () => drawDesk(r, d, t) })); list.push(...r.objs); }
      const spots = r.isBoard ? r.seats : [...r.meet, ...r.part];
      list.push({ k: 0, d: () => drawChairs(spots) });
      r.agents.forEach(a => list.push({ k: a.y, d: () => { sprite(a, t, a === sel); if (a.st === "asking") { a.ask = 1; bubble(a, t); } else if (a.sit || a.st !== "idle") { a.ask = 0; if (a.sit) bubble(a, t); } } }));
      list.sort((a, b) => a.k - b.k).forEach(o => o.d());
      r.agents.forEach(a => {
        if (a !== sel && !(scale >= 2 && a.st !== "idle")) return;
        const lbl = r.isBoard ? (SHORT[a.fid] || a.name).toUpperCase().slice(0, 9) : a.name.split(/\s+/).pop().toUpperCase().replace(/[^A-Z0-9&.-]/g, "").slice(0, 8) || "AGENT";
        const cx = Math.max(tw(lbl) / 2 + 3, Math.min(W - tw(lbl) / 2 - 3, a.x | 0)), y0 = (a.y | 0) - 25;
        pill(lbl, cx, y0, a.col, "#fff"); if (a === sel) { R(cx - 1, y0 - 4, 3, 1, "#fff"); R(cx, y0 - 3, 1, 2, "#fff"); }
      });
      main.drawImage = main.drawImage; raf = requestAnimationFrame(frame);
    }

    /* ----- HUD, chips, resize ----- */
    function updateHud(r) {
      const f = r.firm, c = r.counts, names = ["Kickoff", "Drafting", "Review"];
      if (r.isBoard) { hud.innerHTML = `<span class="fl-tag" style="--a:#16181D">PLENARY</span><span>${c.board} firms at the table</span><span>one fact ledger · blind positions</span>`; }
      else hud.innerHTML = `<span class="fl-tag" style="--a:${f.accent}">${f.name.toUpperCase()}</span><span class="fl-ph">${c.work ? names[r.phase] : "Quiet"}</span><span>WAR ROOM <b>${c.war || 0}</b></span><span>PARTNERS <b>${c.par || 0}</b></span><span>DESKS <b>${c.desk || 0}</b></span><span>BENCH <b>${c.bench || 0}</b></span>${c.more || c.benchMore ? `<span class="fl-more">+${(c.more || 0) + (c.benchMore || 0)} more off-screen</span>` : ""}`;
      drawBar();
    }
    function drawBar() {
      const chip = (id, name, n, a) => `<button class="chip" data-room="${id}" aria-pressed="${room === id}" style="--a:${a}"><i></i>${name}${n ? ` · ${n}` : ""}</button>`;
      bar.innerHTML = chip("plenary", "Boardroom", api.convened().length, "#16181D") + api.firms.map(f => chip(f.id, f.name, f.agents.filter(a => api.state(f.id, a.id) !== "idle").length, f.accent)).join("");
    }
    function resize() {
      const avail = wrap.clientWidth - 8; scale = avail >= 640 ? Math.floor(avail / W) : avail / W;
      cv.style.width = W * scale + "px"; cv.style.height = H * scale + "px"; stage.style.width = W * scale + "px"; stage.style.height = H * scale + "px";
      wrap.style.height = "auto";
      requestAnimationFrame(() => { wrap.scrollLeft = Math.max(0, (W * scale + 8 - wrap.clientWidth) / 2); });
    }
    function pick(ev) {
      const b = cv.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width * W, y = (ev.clientY - b.top) / b.height * H; let best = null, bd = 1e9;
      rooms[room].agents.forEach(a => { const dx = Math.abs(x - a.x), dy = y - (a.y - 8); if (dx < 8 && Math.abs(dy) < 11) { const d = dx + Math.abs(dy); if (d < bd) { bd = d; best = a; } } });
      return best;
    }
    cv.addEventListener("click", ev => {
      const a = pick(ev); sel = a;
      if (!a) { tip.hidden = true; return; }
      const r = rooms[room], fm = r.isBoard ? a.rep : r.firm, where = r.isBoard ? "at the boardroom table" : a.sit ? (a.spot.dir === "u" || r.meet.includes(a.spot) ? "in the war room" : r.part.includes(a.spot) ? "in the partners room" : "at their desk") : a.st === "idle" ? "on the bench" : "on the way";
      const s = a.st === "asking" ? "asking you" : a.st === "idle" ? "on the bench" : "working";
      tip.innerHTML = `<b>${a.name}</b><small>${fm.name} · ${s} · ${where}</small><p>${a.task && a.st !== "idle" ? a.task : "Nothing right now."}</p>${a.st === "asking" ? '<button class="send" data-go="needs">Answer</button>' : ""}${!r.isBoard ? '<button class="ghost" data-go="agent">Open in Office</button>' : ""}`;
      tip.hidden = false; tip.dataset.f = fm.id; tip.dataset.a = a.id;
      const px = Math.min(Math.max(4, a.x * scale - 115), W * scale - 234), py = Math.max(4, (a.y - 40) * scale);
      tip.style.left = px + wrap.scrollLeft * 0 + "px"; tip.style.top = Math.min(py + 40, H * scale - 120) + "px";
      const wb = wrap.getBoundingClientRect(); void wb;
    });
    tip.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (!b) return; if (b.dataset.go === "needs") api.goNeeds(); else api.openAgent(tip.dataset.f, tip.dataset.a); });
    bar.addEventListener("click", e => { const b = e.target.closest("[data-room]"); if (!b) return; room = b.dataset.room; sel = null; tip.hidden = true; lastSync = -1e9; drawBar(); });
    window.addEventListener("resize", resize);

    rooms.plenary = makeBoard(); api.firms.forEach(f => rooms[f.id] = makeFirmRoom(f));
    if (!rooms[room]) room = "plenary";
    drawBar(); resize(); raf = requestAnimationFrame(frame);
  }
  window.Floor = { mount };
})();
