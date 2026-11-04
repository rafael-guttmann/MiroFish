/* GTMN Floor: illustrated office. One themed room per firm: open-plan desks, a meeting room and a partners room. */
(() => {
  const W = 320, H = 224, CY = 198, K = 4;
  const SHORT = { "ogc-dg": "OGC", "alliance-house": "ALLIANCE", "plan-house": "PLAN", "dg-ib": "DG-IB", "cio-ic-memo": "CIO", "spc-deal-team": "SPC", "zencredit-firm": "ZEN", "gtmn-cto": "CTO", "marketing-house": "MKT", dani: "DANI" };
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
    "marketing-house": { fl: ["carpet", "#f6e7d4", "#ecd7bd"], wall: "#fff3e6", trim: "#EA580C", desk: ["#fffaf2", "#d9c3a5"], chair: "#EA580C", acc: "roll", deco: ["board", "frame", "neon", "board"], lounge: [["bean", 10, 204, "#EA580C"], ["bean", 34, 210, "#0EA5E9"], ["plant", 150, 196]], rug: ["#EA580C", "#fde68a"] },
    dani: { fl: ["wood", "#c49a6c", "#b58b5c"], wall: "#4a2c4a", trim: "#C026D3", desk: ["#e8c9a0", "#c3a27a"], chair: "#C026D3", acc: "mug", deco: ["shelf", "frame", "window", "shelf"], lounge: [["sofa", 8, 200, "#C026D3"], ["plant", 150, 196]], rug: ["#C026D3", "#f5d0fe"] }
  };
  TH.shared = { fl: ["carpet", "#d6d8de", "#caccd4"], wall: "#2a2f3a", trim: "#c9a24a", desk: ["#e4e6ea", "#b4b8c2"], chair: "#2a2f3a", acc: "mug", deco: ["board", "clock", "window", "board"], lounge: [["sofa", 8, 200, "#475569"], ["plant", 150, 196]], rug: ["#2a2f3a", "#c9a24a"] };
  const MIN_AGENTS = 10;
  const PARTNERS = new Set("ogc-eizirik ogc-laster ogc-demarest ogc-lipton ah-bamford ah-schwarzman ah-lemann bp-rumelt bp-sahlman dgib-rohatyn dgib-quattrone dgib-wasserstein cio-marks cio-swensen cio-ellis spc-thiel spc-wilson managing-partner cto-larson dani mh-ogilvy mh-olivetto mh-vignelli".split(" "));
  const DECO_X = [6, 38, 142, 174];
  const BOARD_TH = { fl: ["checker", "#2a2d36", "#252831"], wall: "#16181D", trim: "#c9a24a", desk: ["#3b2a1d", "#2a1d13"], chair: "#111", deco: [], rug: ["#7a1f2b", "#c9a24a"] };
  let raf = 0, room = "plenary", g = null;

  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  let api0 = null;


  /* ---------- drawing helpers (logical 320x224, rendered at K x) ---------- */
  const FONT_STACK = '-apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif';
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const rr = (x, y, w, h, r, c) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = c; g.fill(); };
  const ell = (x, y, rx, ry, c, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fillStyle = c; g.fill(); };
  const LG = (x0, y0, x1, y1, s) => { const q = g.createLinearGradient(x0, y0, x1, y1); s.forEach((c, i) => q.addColorStop(i / (s.length - 1), c)); return q; };
  const RG = (x, y, r0, r1, s) => { const q = g.createRadialGradient(x, y, r0, x, y, r1); s.forEach((c, i) => q.addColorStop(i / (s.length - 1), c)); return q; };
  const ln = (x1, y1, x2, y2, c, w = 1) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = c; g.lineWidth = w; g.stroke(); };
  const tone = (c, v) => v >= 0 ? mix(c, "#ffffff", v) : mix(c, "#000000", -v);
  const T = (s, x, y, c, sz = 5, al = "left", wt = 700) => { g.font = `${wt} ${sz}px ${FONT_STACK}`; g.textAlign = al; g.textBaseline = "top"; g.fillStyle = c; g.fillText(s, x, y); };
  const tw = (s, sz = 5) => { g.font = `700 ${sz}px ${FONT_STACK}`; return g.measureText(s).width; };
  const pill = (s, cx, y, bg, fg, sz = 4.6) => { const w = tw(s, sz) + 6; rr(cx - w / 2, y, w, sz + 3.6, (sz + 3.6) / 2, bg); T(s, cx, y + 1.9, fg, sz, "center"); };

  /* ---------- static background ---------- */
  function floorTiles(th, x0, y0, x1, y1) {
    const [kind, c1, c2] = th.fl, X0 = x0 * 16, Y0 = y0 * 16, X1 = x1 * 16, Y1 = y1 * 16;
    R(X0, Y0, X1 - X0, Y1 - Y0, c1);
    g.save(); g.beginPath(); g.rect(X0, Y0, X1 - X0, Y1 - Y0); g.clip();
    if (kind === "parquet") {
      for (let ri = 0, y = Y0; y < Y1; ri++, y += 8) for (let px = -(ri % 2 ? 16 : 0); px < X1; px += 32) {
        R(px, y, 32, 8, tone(c1, ((hash(ri * 31 + px) % 7) - 3) * .02)); R(px, y, 32, .6, c2); R(px, y, .6, 8, c2);
        ln(px + 3, y + 3, px + 26, y + 3.4, "rgba(0,0,0,.05)", .5);
      }
    } else if (kind === "checker") {
      for (let y = Y0; y < Y1; y += 16) for (let x = 0; x < X1; x += 16) { R(x, y, 16, 16, ((x + y) / 16) % 2 ? c1 : c2); }
      for (let i = 0; i < 26; i++) { const x = hash("v" + i) % X1, y = Y0 + hash("w" + i) % (Y1 - Y0); ln(x, y, x + 10, y + 6, "rgba(255,255,255,.18)", .5); }
    } else if (kind === "wood") {
      for (let ri = 0, y = Y0; y < Y1; ri++, y += 6) for (let px = -((ri * 13) % 40); px < X1; px += 40) { R(px, y, 40, 6, tone(c1, ((hash(ri * 7 + px) % 5) - 2) * .018)); R(px, y, 40, .5, c2); R(px, y, .5, 6, c2); }
    } else if (kind === "carpet") {
      for (let x = 0; x < X1; x += 32) R(x, Y0, .5, Y1 - Y0, c2); for (let y = Y0; y < Y1; y += 32) R(0, y, X1, .5, c2);
      for (let i = 0; i < 160; i++) R(hash("c" + i) % X1, Y0 + hash("d" + i) % (Y1 - Y0), .8, .8, c2);
    } else if (kind === "concrete") {
      for (let i = 0; i < 220; i++) R(hash("s" + i) % X1, Y0 + hash("t" + i) % (Y1 - Y0), 1, 1, i % 2 ? c2 : tone(c1, .08));
      for (let x = 0; x < X1; x += 64) R(x, Y0, .7, Y1 - Y0, c2); for (let y = Y0; y < Y1; y += 64) R(0, y, X1, .7, c2);
    } else {
      for (let y = Y0; y < Y1; y += 16) for (let x = 0; x < X1; x += 16) { R(x + .4, y + .4, 15.2, 15.2, ((x + y) / 16) % 2 ? c1 : tone(c1, .03)); R(x, y, 16, .5, c2); R(x, y, .5, 16, c2); }
      for (let x = 32; x < X1; x += 64) R(x, Y0, .8, Y1 - Y0, mix(th.trim, c1, .75));
    }
    g.restore();
    R(X0, Y0, X1 - X0, 70, LG(0, Y0, 0, Y0 + 70, ["rgba(0,0,0,.26)", "rgba(0,0,0,0)"]));
    R(X0, Y1 - 50, X1 - X0, 50, LG(0, Y1 - 50, 0, Y1, ["rgba(0,0,0,0)", "rgba(0,0,0,.18)"]));
    if (th.fl[0] !== "tech") for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(24 + i * 62, Y0); g.lineTo(46 + i * 62, Y0); g.lineTo(34 + i * 62, Y0 + 100); g.lineTo(2 + i * 62, Y0 + 100); g.closePath(); g.fillStyle = "rgba(255,248,220,.07)"; g.fill(); }
  }
  function wallBase(th) {
    R(0, 0, W, 48, LG(0, 0, 0, 48, [tone(th.wall, -.28), th.wall, tone(th.wall, -.06)]));
    if (th.brick) {
      for (let r = 0; r < 10; r++) for (let c = 0; c < 21; c++) { const bx = c * 16 + (r % 2 ? 8 : 0) - 8; R(bx + .4, r * 4 + .4, 15.2, 3.2, tone(th.wall, ((hash(r * 9 + c) % 7) - 3) * .035)); }
      R(0, 0, W, 40, "rgba(0,0,0,.12)");
    } else {
      for (let c = 0; c < 20; c++) { rr(c * 16 + 1.5, 23, 13, 15, 1.2, "rgba(255,255,255,.07)"); R(c * 16, 22, .6, 17, "rgba(0,0,0,.14)"); }
      R(0, 21.5, W, 1.6, "rgba(255,255,255,.18)");
    }
    R(0, 0, W, 3.4, tone(th.wall, -.4)); R(0, 3.4, W, .8, "rgba(255,255,255,.22)");
    R(0, 39, W, 9, LG(0, 39, 0, 48, [tone(th.wall, -.22), tone(th.wall, -.4)])); R(0, 39, W, 1.2, th.trim); R(0, 47, W, 1, "rgba(0,0,0,.4)");
  }
  function rugAt(th, x, y, w, h) {
    rr(x - 1, y - 1, w + 2, h + 3, 6, "rgba(0,0,0,.2)"); rr(x, y, w, h, 5, th.rug[0]);
    g.strokeStyle = th.rug[1]; g.lineWidth = 1; g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, 3); g.stroke();
    g.lineWidth = .5; g.beginPath(); g.roundRect(x + 6, y + 6, w - 12, h - 12, 2); g.stroke();
  }
  function glassWall(x, y, h) {
    rr(x, y, 4, h, 1, LG(x, 0, x + 4, 0, ["rgba(190,230,245,.55)", "rgba(120,190,215,.4)"]));
    R(x + .6, y, .8, h, "rgba(255,255,255,.7)");
    for (let k = 0; k < 3; k++) ln(x, y + 10 + k * 24, x + 4, y + 2 + k * 24, "rgba(255,255,255,.55)", .8);
  }
  function paintFirmBg(f, th) {
    floorTiles(th, 0, 3, 20, 14); wallBase(th);
    rugAt(th, 60, 202, 100, 22);
    const dark = mix(f.accent, "#0b0d12", .66);
    // meeting room: deep carpet, gold inlay, chandeliers
    R(212, 48, 108, 96, LG(0, 48, 0, 144, [tone(dark, .06), dark]));
    g.save(); g.beginPath(); g.rect(212, 48, 108, 96); g.clip();
    for (let k = -8; k < 14; k++) { ln(212 + k * 12, 48, 212 + k * 12 + 96, 144, "rgba(255,255,255,.04)", .6); ln(212 + k * 12 + 96, 48, 212 + k * 12, 144, "rgba(255,255,255,.04)", .6); }
    g.restore();
    g.strokeStyle = "#c9a24a"; g.lineWidth = .9; g.strokeRect(218, 54, 96, 84); g.lineWidth = .4; g.strokeRect(220.5, 56.5, 91, 79);
    [232, 266, 300].forEach(x => { ell(x, 96, 20, 12, RG(x, 96, 0, 22, ["rgba(255,226,150,.2)", "rgba(255,226,150,0)"])); });
    // meeting room wall: panels, drapes, sign
    R(212, 0, 108, 48, LG(0, 0, 0, 48, [mix(f.accent, "#0b0d12", .75), mix(f.accent, "#0b0d12", .45)]));
    for (let c = 0; c < 7; c++) { rr(215 + c * 15, 22, 12, 15, 1.2, "rgba(255,255,255,.07)"); }
    R(212, 0, 108, 3, "#c9a24a"); R(212, 39, 108, 1.2, "#c9a24a"); R(212, 40.2, 108, 8, "rgba(0,0,0,.35)");
    [[214, 1], [307, -1]].forEach(([x]) => { rr(x, 4, 10, 36, 2, mix(f.accent, "#000000", .15)); for (let k = 0; k < 4; k++) R(x + 1.5 + k * 2.4, 5, .7, 34, "rgba(0,0,0,.22)"); R(x, 4, 10, 2, "#c9a24a"); });
    pill("MEETING ROOM", 266, 41.2, "#c9a24a", "#2a1c05");
    // partners room
    R(212, 148, 108, 76, LG(0, 148, 0, 224, ["#2b1d16", "#1b130f"]));
    for (let y = 150; y < 224; y += 6) R(212, y, 108, .5, "rgba(0,0,0,.28)");
    rr(220, 156, 92, 64, 4, "#4a1620"); g.strokeStyle = "#c9a24a"; g.lineWidth = .9; g.beginPath(); g.roundRect(223, 159, 86, 58, 2.5, ); g.stroke();
    R(212, 144, 108, 4, "#22252d"); R(212, 144, 108, 1, "#c9a24a");
    pill("PARTNERS", 236, 150.5, "#c9a24a", "#2a1c05");
    // dividers: solid wall, glass, door frames
    rr(208, 48, 4, 4, 1, "#2c313c"); rr(208, 76, 4, 68, 1, "#2c313c"); rr(208, 148, 4, 28, 1, "#2c313c"); rr(208, 212, 4, 12, 1, "#2c313c");
    glassWall(208, 76, 68);
    R(205, 50, 9, 2, f.accent); R(205, 76, 9, 2, f.accent); R(205, 174, 9, 2, f.accent); R(205, 212, 9, 2, f.accent);
    // wall sign plaque
    const nm = f.name.toUpperCase().slice(0, 18), sw = tw(nm, 5.4) + 14;
    rr(104 - sw / 2 - 1.2, 8.4, sw + 2.4, 15.2, 3, "#c9a24a"); rr(104 - sw / 2, 9.6, sw, 12.8, 2.4, f.accent); T(nm, 104, 12.6, "#fff", 5.4, "center");
    rr(194, 56, 13, 16, 3, mix(f.accent, "#000000", .15)); rr(194, 180, 13, 28, 3, mix(f.accent, "#000000", .15));
  }
  function paintBoardBg() {
    floorTiles(BOARD_TH, 0, 3, 20, 14); wallBase(BOARD_TH);
    rr(56, 78, 208, 98, 12, "rgba(0,0,0,.3)"); rr(58, 80, 204, 94, 11, "#3a1017"); g.strokeStyle = "#c9a24a"; g.lineWidth = 1; g.beginPath(); g.roundRect(63, 85, 194, 84, 8); g.stroke();
    rr(120, 218, 80, 6, 3, "#7a1f2b");
  }

  /* ---------- wall decor (animated) ---------- */
  const D = {
    books(x) { rr(x, 8, 28, 31, 2, "#3b2515"); rr(x + 1, 9, 26, 29, 1.5, "#22150b"); const cs = ["#8a2b3a", "#2b4a8a", "#2b6a4a", "#c9a24a", "#5a3a8a", "#8a5a2b"]; for (let s = 0; s < 3; s++) { R(x + 1, 18 + s * 10, 26, 1, "#6b4a2e"); let bx = x + 2; for (let i = 0; i < 8; i++) { const h = 5 + (i * 3 + s) % 4, w = 2 + (i % 2); rr(bx, 18 + s * 10 - h, w, h, .5, cs[(i + s * 2) % 6]); bx += w + .5; } } },
    scales(x) { const c = "#d8b04a"; ln(x + 14, 12, x + 14, 34, c, 1.3); ln(x + 5, 15, x + 23, 15, c, 1.3); [6, 22].forEach(px => { ln(x + px, 15, x + px - 3, 24, c, .5); ln(x + px, 15, x + px + 3, 24, c, .5); g.beginPath(); g.arc(x + px, 24, 3.4, 0, Math.PI); g.fillStyle = c; g.fill(); }); rr(x + 9, 33, 10, 3.5, 1.5, c); ell(x + 14, 12, 1.6, 1.6, c); },
    frame(x) { rr(x + 3, 9, 22, 28, 1.5, "#d8b04a"); rr(x + 4.6, 10.6, 18.8, 24.8, 1, "#1d2a3a"); ell(x + 14, 20, 4, 4.6, "#e0b48a"); rr(x + 8, 25, 12, 9, 4, "#8a2b3a"); R(x + 12.4, 25, 3.2, 4, "#f4efe2"); },
    window(x, t) { rr(x + 1, 8, 26, 30, 1.5, "#6b4e33"); rr(x + 3, 10, 22, 26, 1, LG(0, 10, 0, 36, ["#8ccbee", "#e8f6fc"])); [[3, 7, 11], [8, 5, 14], [13, 8, 9], [19, 6, 12]].forEach(([bx, bw, bh]) => R(x + 3 + bx - 2, 36 - bh, bw, bh, "#6b8399")); ell(x + 9 + ((t / 700) % 10), 15, 4, 1.6, "rgba(255,255,255,.85)"); R(x + 13.4, 10, 1.2, 26, "#6b4e33"); R(x + 3, 22.4, 22, 1.2, "#6b4e33"); R(x - 1, 37, 30, 2.4, "#8a6a45"); },
    map(x, t) { rr(x, 9, 28, 28, 2, "#c9a24a"); rr(x + 1.2, 10.2, 25.6, 25.6, 1.4, LG(0, 10, 0, 36, ["#2f6f8f", "#245a76"])); [[8, 17, 4.5, 3.6], [17, 22, 4, 5.4], [21, 15, 3.4, 2.8], [6, 27, 3, 2]].forEach(([a, b, c, d]) => ell(x + a, b, c, d, "#6aa36a")); ell(x + 9, 17, 1.3, 1.3, ((t / 400) | 0) % 2 ? "#ff4d4d" : "#ffd0d0"); ell(x + 16, 22, 1.3, 1.3, "#ff4d4d"); },
    flags(x, t) { const cs = ["#d94a4a", "#f2c14e", "#4a8fd9"]; for (let i = 0; i < 3; i++) { const px = x + 4 + i * 9; ln(px, 10, px, 38, "#ccd", 1); g.beginPath(); g.moveTo(px, 11); for (let k = 0; k <= 7; k++) g.lineTo(px + k, 11 + Math.sin(t / 260 + k * .7 + i) * 1.1); for (let k = 7; k >= 0; k--) g.lineTo(px + k, 17 + Math.sin(t / 260 + k * .7 + i) * 1.1); g.closePath(); g.fillStyle = cs[i]; g.fill(); } },
    clock(x, t) { ell(x + 14, 18, 8, 8, "#5a4a30"); ell(x + 14, 18, 6.6, 6.6, "#f7f2e6"); const a = t / 4000; ln(x + 14, 18, x + 14 + Math.cos(a) * 4.6, 18 + Math.sin(a) * 4.6, "#222", .8); ln(x + 14, 18, x + 14, 14, "#222", .9); },
    ticker(x, t) { rr(x, 10, 28, 21, 2, "#0a0c0a"); g.save(); g.beginPath(); g.rect(x + 1, 11, 26, 19); g.clip(); const o = -((t / 70) % 60); ["AAPL +1.2  MSFT -0.4  GS +0.8  ", "BRL -0.6  SPX +0.3  DXY -0.1  "].forEach((s, r) => { for (let k = 0; k < 2; k++) T(s, x + 1 + o + k * 60, 13 + r * 8, r ? "#ff6b6b" : "#4cff8a", 4); }); g.restore(); },
    bell(x) { const c = "#e0a030"; g.beginPath(); g.moveTo(x + 6, 24); g.quadraticCurveTo(x + 7, 12, x + 14, 12); g.quadraticCurveTo(x + 21, 12, x + 22, 24); g.closePath(); g.fillStyle = LG(x, 0, x + 28, 0, ["#f6d27a", c, "#a8701a"]); g.fill(); rr(x + 4, 24, 20, 3, 1.5, c); ell(x + 14, 29, 2, 2, "#8a5a10"); rr(x + 3, 33, 22, 3.5, 1.5, "#5a3a10"); },
    blueprint(x) { rr(x + 1, 10, 26, 22, 1.5, "#1f3f94"); rr(x + 2, 11, 24, 20, 1, "#2a54b8"); for (let i = 0; i < 4; i++) R(x + 2, 15 + i * 5, 24, .5, "#5a82e0"); rr(x + 6, 16, 11, 9, 1, "rgba(255,255,255,.85)"); R(x + 8, 18, 7, 5, "#2a54b8"); R(x + 19, 16, 5, .8, "#e8f0ff"); },
    board(x) { rr(x, 9, 28, 24, 2, "#9aa0aa"); rr(x + 1, 10, 26, 22, 1.4, "#f7f7f5"); [["#ffd54a", 3, 13], ["#ff8fa3", 10, 13], ["#7fd6ff", 17, 13], ["#b8f08a", 6, 21]].forEach(([c, a, b]) => { rr(x + a, b, 5.4, 5.4, .6, c); }); R(x + 14, 22, 10, .8, "#555"); R(x + 14, 25, 7, .8, "#555"); },
    chart(x, t) { rr(x, 10, 28, 24, 2, "#071109"); rr(x + 1, 11, 26, 22, 1.4, "#0b1a13"); for (let i = 0; i < 6; i++) { const h = 3 + (((Math.sin(t / 700 + i * 1.3) + 1) * 6) | 0); rr(x + 3 + i * 4, 31 - h, 3, h, .6, "#37d67a"); } R(x + 2, 31.4, 24, .6, "#1d5a3a"); },
    rack(x, t) { rr(x + 5, 7, 18, 32, 2, "#0b0e14"); for (let k = 0; k < 5; k++) { rr(x + 7, 10 + k * 6, 14, 4.4, .8, "#232a36"); ell(x + 9, 12.2 + k * 6, .7, .7, (((t / 250) | 0) + k) % 3 ? "#3cff7a" : "#ff5a3c"); R(x + 12, 11.8 + k * 6, 7, .8, "#394255"); } },
    neon(x, t) { rr(x, 10, 28, 24, 2, "#1d0a16"); const on = ((t / 900) | 0) % 7 !== 0; g.save(); if (on) { g.shadowColor = "#ff4fa3"; g.shadowBlur = 6; } T("GO!", x + 14, 17, on ? "#ff8ac6" : "#5a2a45", 9, "center"); g.restore(); },
    shelf(x) { rr(x + 2, 26, 24, 2, 1, "#6b4e33"); rr(x + 4, 20, 6, 6, 1, "#c3623a"); ell(x + 7, 17, 3, 4, "#3a8a4a"); rr(x + 11, 19, 3, 7, .6, "#2b4a8a"); rr(x + 14.4, 17, 3, 9, .6, "#c9a24a"); rr(x + 19, 21, 5, 5, .8, "#e5e5e5"); }
  };
  const tvDraw = (f, t) => {
    rr(235, 7, 64, 32, 2, "#0b0c10"); rr(236.5, 8.5, 61, 29, 1.2, LG(0, 8, 0, 37, [mix(f.accent, "#000000", .35), mix(f.accent, "#000000", .65)]));
    for (let i = 0; i < 9; i++) { const h = 3 + (((Math.sin(t / 650 + i) + 1) * 7) | 0); rr(240 + i * 6, 35 - h, 4, h, .8, mix(f.accent, "#ffffff", .25)); }
    T("MANDATE", 240, 11, "#fff", 4.4);
  };

  /* ---------- props ---------- */
  const leaf = (x, y, rx, ry, rot, c) => ell(x, y, rx, ry, c, rot);
  const P = {
    plant(o) { ell(o.x + 7, o.y + 19, 8, 2.4, "rgba(0,0,0,.22)"); [[7, 3, 3.2, 7, 0, "#2f8a4a"], [3, 7, 3, 5.4, -.7, "#3aa35a"], [11, 7, 3, 5.4, .7, "#3aa35a"], [7, 5, 2.4, 5.5, 0, "#46b86a"]].forEach(([a, b, c, d, e, f]) => leaf(o.x + a, o.y + b, c, d, e, f)); rr(o.x + 2, o.y + 10, 10, 9, 2, LG(o.x, 0, o.x + 14, 0, ["#d98a58", "#b0643a"])); R(o.x + 2, o.y + 10, 10, 1.6, "#e7a36f"); },
    cooler(o) { ell(o.x + 8, o.y + 20, 8, 2, "rgba(0,0,0,.2)"); rr(o.x + 3, o.y, 10, 9, 3, "rgba(155,211,234,.9)"); R(o.x + 4.5, o.y + 1.2, 2, 6, "rgba(255,255,255,.7)"); rr(o.x + 2, o.y + 8, 12, 12, 1.5, LG(o.x, 0, o.x + 14, 0, ["#f1f2f5", "#cfd3da"])); ell(o.x + 6, o.y + 13, 1, 1, "#3b82f6"); ell(o.x + 10, o.y + 13, 1, 1, "#ef4444"); },
    sofa(o) { const c = o.c, d = mix(c, "#000000", .3); ell(o.x + 24, o.y + 19, 26, 2.8, "rgba(0,0,0,.22)"); rr(o.x, o.y + 6, 48, 12, 4, d); rr(o.x + 1, o.y, 46, 11, 4.5, tone(c, -.04)); rr(o.x + 4, o.y + 9, 19.4, 8, 3, tone(c, .06)); rr(o.x + 24.6, o.y + 9, 19.4, 8, 3, tone(c, .06)); rr(o.x, o.y + 5, 6, 13, 3, d); rr(o.x + 42, o.y + 5, 6, 13, 3, d); R(o.x + 6, o.y + 9.2, 36, .6, "rgba(255,255,255,.14)"); },
    bean(o) { ell(o.x + 11, o.y + 15, 12, 2.4, "rgba(0,0,0,.2)"); rr(o.x, o.y + 2, 22, 14, 7, mix(o.c, "#000000", .28)); rr(o.x + 1, o.y, 20, 13, 7, o.c); ell(o.x + 8, o.y + 4, 4, 1.6, "rgba(255,255,255,.3)"); },
    kegs(o) { ell(o.x + 8, o.y + 22, 9, 2.2, "rgba(0,0,0,.2)"); rr(o.x, o.y + 2, 16, 20, 3, LG(o.x, 0, o.x + 16, 0, ["#d4d7dd", "#8c8f96"])); R(o.x, o.y + 8, 16, 1.6, "#8c8f96"); rr(o.x + 11.5, o.y, 3.4, 4, 1, "#f59e0b"); rr(o.x + 3, o.y + 12, 9, 4.6, 1, "#BE123C"); },
    globe(o) { ell(o.x + 7, o.y + 17, 6, 1.8, "rgba(0,0,0,.2)"); rr(o.x + 3, o.y + 14, 8, 3, 1.4, "#6b4e33"); R(o.x + 6.4, o.y + 10, 1.4, 5, "#6b4e33"); ell(o.x + 7, o.y + 6, 6.2, 6.2, RG(o.x + 5, o.y + 4, 1, 7, ["#7cc0f0", "#2f6aa5"])); ell(o.x + 5, o.y + 5, 2.4, 2, "#6aa36a"); ell(o.x + 9.4, o.y + 8, 1.8, 2.2, "#6aa36a"); }
  };
  const ACC = {
    lamp(x, y) { rr(x + 22, y - 6, 6, 3.4, 1.6, "#1f7a4a"); R(x + 24.6, y - 3, .9, 3.4, "#c9a24a"); },
    flag(x, y) { R(x + 24, y - 8, .8, 9, "#cfd3da"); rr(x + 24.8, y - 8, 4.4, 3, .6, "#d94a4a"); },
    roll(x, y) { rr(x + 21, y - 3, 7, 3.4, 1.4, "#eaf0ff"); R(x + 21.4, y - 3, 1, 3.4, "#4F46E5"); },
    mug(x, y) { rr(x + 24, y - 2, 3.4, 3.4, 1, "#fff"); R(x + 24, y - 2, 3.4, .9, "#c9a24a"); },
    pot(x, y) { rr(x + 23, y - 1, 4.4, 3.2, .8, "#b0643a"); ell(x + 25.2, y - 3, 2.6, 2.2, "#3aa35a"); },
    sticker(x, y) { rr(x + 21, y - 2, 7, 4.2, .8, "#d1d5db"); ell(x + 24.5, y, 1, 1, "#BE123C"); },
    can(x, y) { rr(x + 24, y - 4, 3.2, 5.4, 1, "#22c55e"); R(x + 24, y - 4, 3.2, .9, "#e5e7eb"); }
  };

  /* ---------- people ---------- */
  const JACK = ["#1f2937", "#2b3445", "#33291f", "#3a2c3f", "#1d2d2a", "#4b5563"];
  function sprite(a, t, sel) {
    const x = a.x, y = a.y, mv = a.moving, ph = mv ? Math.sin(t / 110) : 0, bob = mv ? Math.abs(ph) * .9 : 0, T0 = y - 18 - bob;
    const jk = JACK[a.seed % 6], sk = a.skin, hr = a.hair, long = ((a.seed >> 4) % 3) === 0, face = a.dir;
    if (!a.sit) ell(x, y, 5.8, 1.9, "rgba(0,0,0,.26)");
    if (sel) { g.strokeStyle = "#fff"; g.lineWidth = .9; g.beginPath(); g.ellipse(x, y, 8, 2.9, 0, 0, 7); g.stroke(); }
    if (!a.sit) {
      const tr = mix(jk, "#000000", .3);
      rr(x - 3.6, T0 + 14 - Math.max(0, ph) * 1.2, 3, 4.4, 1.2, tr); rr(x + .6, T0 + 14 - Math.max(0, -ph) * 1.2, 3, 4.4, 1.2, tr);
      rr(x - 3.9, y - 1.6 - Math.max(0, ph) * 1.2, 3.6, 1.7, .8, "#15171c"); rr(x + .3, y - 1.6 - Math.max(0, -ph) * 1.2, 3.6, 1.7, .8, "#15171c");
    }
    rr(x - 5.2, T0 + 7, 10.4, 8.6, 3.2, jk); R(x - 4, T0 + 7.6, 8, .8, "rgba(255,255,255,.1)");
    const sw = ph * 1;
    rr(x - 6.6, T0 + 8 + sw, 2.4, 6, 1.2, jk); rr(x + 4.2, T0 + 8 - sw, 2.4, 6, 1.2, jk);
    ell(x - 5.4, T0 + 14.4 + sw, 1.2, 1.2, sk); ell(x + 5.4, T0 + 14.4 - sw, 1.2, 1.2, sk);
    if (face !== "u") {
      g.beginPath(); g.moveTo(x - 1.9, T0 + 7); g.lineTo(x + 1.9, T0 + 7); g.lineTo(x, T0 + 11.4); g.closePath(); g.fillStyle = "#f4f1ea"; g.fill();
      if (face === "d") { rr(x - .75, T0 + 8.4, 1.5, 4.6, .7, a.col); ell(x + 3, T0 + 10.6, .9, .9, a.col); }
    } else R(x - 2.4, T0 + 6.6, 4.8, 1, mix(jk, "#ffffff", .12));
    R(x - 1.4, T0 + 5.6, 2.8, 2, mix(sk, "#000000", .12));
    if (long && face !== "r" && face !== "l") rr(x - 4.2, T0 + 1.2, 8.4, 8, 3, hr);
    ell(x, T0 + 3.4, 3.6, 3.9, sk);
    g.beginPath();
    if (face === "u") { g.ellipse(x, T0 + 3.2, 3.9, 4.1, 0, 0, 7); }
    else if (face === "d") { g.ellipse(x, T0 + 2.1, 3.9, 3.1, 0, Math.PI, 0); g.rect(x - 3.9, T0 + 2, 1.2, 2.4); g.rect(x + 2.7, T0 + 2, 1.2, 2.4); }
    else { const r = face === "r"; g.ellipse(x, T0 + 2.1, 3.9, 3.1, 0, Math.PI, 0); g.ellipse(x + (r ? -1.6 : 1.6), T0 + 3.6, 2.4, 3.4, 0, 0, 7); }
    g.fillStyle = hr; g.fill();
    if (face === "d") { ell(x - 1.4, T0 + 3.9, .55, .55, "#1a1a1a"); ell(x + 1.4, T0 + 3.9, .55, .55, "#1a1a1a"); }
    else if (face !== "u") ell(x + (face === "r" ? 1.7 : -1.7), T0 + 3.9, .55, .55, "#1a1a1a");
  }
  function bubble(a, t) {
    const x = a.x + 4, y = a.y - 34 + (a.ask ? ((t / 220) % 2 | 0) : 0);
    rr(x - .8, y - .8, 12.6, 10.6, 3.6, "#16181D"); rr(x, y, 11, 9, 3, "#fff");
    g.beginPath(); g.moveTo(x + 2, y + 8.6); g.lineTo(x + 1.4, y + 12); g.lineTo(x + 5, y + 8.6); g.fillStyle = "#fff"; g.fill();
    if (a.ask) T("!", x + 5.5, y + 1.6, "#c2410c", 6.4, "center", 800);
    else { const n = ((t / 280) | 0) % 3; for (let i = 0; i < 3; i++) ell(x + 2.8 + i * 2.7, y + 4.6, .95, .95, i <= n ? "#16181D" : "#c9ccd3"); }
  }
  function chairShape(s, th) {
    if (s.big) { ell(s.x, s.y + 1, 6.5, 2, "rgba(0,0,0,.25)"); rr(s.x - 6, s.y - 14, 12, 14, 5, "#4a1c24"); rr(s.x - 5, s.y - 13, 10, 4, 2, "#6a2a34"); g.strokeStyle = "#c9a24a"; g.lineWidth = .5; g.beginPath(); g.roundRect(s.x - 5.4, s.y - 13.4, 10.8, 13, 4.4); g.stroke(); }
    else { ell(s.x, s.y + 1, 5.5, 1.8, "rgba(0,0,0,.22)"); rr(s.x - 5, s.y - 12, 10, 12, 4, "#22252e"); rr(s.x - 4, s.y - 11, 8, 3, 1.6, "#3a3f4c"); }
  }
  function drawDeskShape(r, d, t) {
    const th = r.th, x = d.x, y = d.y;
    ell(x + 15, y + 14, 17, 2.6, "rgba(0,0,0,.2)");
    rr(x + 14.4, y - 5.5, 11, 9, 3.4, th.chair); rr(x + 15.4, y - 4.6, 9, 2.6, 1.4, tone(th.chair, .22));
    rr(x, y, 28, 9, 2, LG(0, y, 0, y + 9, [tone(th.desk[0], .12), th.desk[0]])); R(x + 1, y + .6, 26, .6, "rgba(255,255,255,.25)");
    rr(x + .6, y + 8, 26.8, 4.4, 1.4, th.desk[1]);
    const on = d.on;
    R(x + 6.5, y - .6, 1.6, 2, "#2a2d36");
    rr(x + 2.4, y - 8.4, 11, 8, 1.4, "#14161b"); rr(x + 3.2, y - 7.6, 9.4, 6, .8, on ? LG(0, y - 8, 0, y - 2, ["#2d6cae", "#17406d"]) : "#242831");
    if (on) { R(x + 4.4, y - 6.2, 2.5 + (((t / 220) + d.i) % 4 | 0), .8, "#9be8ff"); R(x + 4.4, y - 4.4, 3.5 + (((t / 310) + d.i) % 3 | 0), .8, "#b8f5b0"); R(x + 3.2, y - 7.6, 9.4, .7, "rgba(255,255,255,.35)"); }
    rr(x + 4, y + 2.6, 9.4, 2.4, .9, "#cfd3da"); rr(x + 18, y + 2.4, 3, 3.4, 1, "#e9ecf1");
    (ACC[th.acc] || ACC.mug)(x, y);
  }
  function drawDesk(r, d, t) { drawDeskShape(r, d, t); }
  function meetTable(f) {
    ell(266, 126, 36, 6, "rgba(0,0,0,.3)");
    rr(231, 94, 70, 31, 8, LG(0, 94, 0, 125, ["#7a5030", "#4f3019", "#3a2312"])); R(236, 95, 60, .8, "rgba(255,255,255,.28)");
    g.strokeStyle = "#c9a24a"; g.lineWidth = .6; g.beginPath(); g.roundRect(235, 98, 62, 22, 5); g.stroke();
    rr(246, 104, 40, 10, 3, mix(f.accent, "#000000", .15)); [[250, 106], [262, 106], [274, 106]].forEach(([a, b]) => rr(a, b, 8, 5, .8, "rgba(255,255,255,.88)"));
    ell(266, 109, 2, 2, "#c9a24a");
  }
  function execDesk(p, f) {
    const x = p.x - 13, y = p.y + 2;
    ell(p.x, y + 14, 15, 2.6, "rgba(0,0,0,.3)");
    rr(x, y, 26, 11, 2, LG(0, y, 0, y + 11, ["#7a5030", "#4a2f1c"])); R(x + 1, y + .6, 24, .6, "rgba(255,255,255,.3)");
    rr(x, y + 10, 26, 3.4, 1.2, "#1c140d"); R(x, y, 26, .9, "#c9a24a");
    rr(x + 7, y + 2.6, 12, 6, 1.4, "#2a1a12"); rr(x + 9.4, y + 8.4, 7, 2.4, .8, mix(f.accent, "#000000", .1));
    rr(x + 2, y - 5, 8, 5.6, 1, "#15171c"); rr(x + 2.8, y - 4.3, 6.4, 4, .6, "#1e4d78");
    rr(x + 19, y - 2.6, 5, 2.6, 1.3, "#1f7a4a"); R(x + 21.2, y - .4, .8, 3, "#c9a24a");
  }
  function drawChairs(spots) { spots.forEach(s => { if (s.chair) chairShape(s); }); }
  function drawBoardTable() {
    ell(162, 132, 84, 28, "rgba(0,0,0,.3)");
    ell(160, 126, 80, 27, LG(0, 100, 0, 152, ["#7a5030", "#4d2f19", "#3a2312"]));
    ell(160, 126, 74, 22, "rgba(0,0,0,0)"); g.strokeStyle = "#c9a24a"; g.lineWidth = .7; g.beginPath(); g.ellipse(160, 126, 72, 21, 0, 0, 7); g.stroke();
    ell(160, 124, 74, 20, "rgba(255,255,255,.05)");
    pill("GTMN", 160, 121, "#c9a24a", "#2a1c05", 5);
  }
  function bannersAndLedger(r, t) {
    const ids = api0.convened();
    ids.slice(0, 6).forEach((id, i) => {
      const fm = api0.byId[id]; if (!fm) return; const bx = i < 3 ? 14 + i * 24 : 240 + (i - 3) * 24;
      g.beginPath(); g.moveTo(bx, 5); g.lineTo(bx + 18, 5); g.lineTo(bx + 18, 36); g.lineTo(bx + 9, 41); g.lineTo(bx, 36); g.closePath(); g.fillStyle = LG(0, 5, 0, 41, [tone(fm.accent, .1), mix(fm.accent, "#000000", .25)]); g.fill();
      R(bx, 5, 18, 1.6, "#c9a24a"); const s = (SHORT[id] || fm.name).slice(0, 4); T(s, bx + 9, 17, "#fff", 5, "center");
    });
    rr(94, 8, 132, 30, 3, "#0b0c10"); rr(95.5, 9.5, 129, 27, 2, "#101c16"); T("FACT LEDGER", 100, 12, "#7be3a0", 4.6);
    for (let i = 0; i < 4; i++) { const w = 20 + (hash("f" + i) % 70); rr(100, 20 + i * 4, Math.min(w, ((t / 60 + i * 30) % 110)), 2, 1, i % 2 ? "#37d67a" : "#a5f3a0"); }
  }
  function mount(host, api) {
    cancelAnimationFrame(raf); api0 = api;
    host.innerHTML = `<div class="fl-bar" id="flbar"></div>
      <div class="fl-hud" id="flhud"></div>
      <div class="fl-wrap" id="flwrap"><div class="fl-stage" id="flstage"><canvas id="flcv" width="${W * K}" height="${H * K}" aria-label="Pixel office floor"></canvas><i class="fl-crt"></i></div><div class="fl-tip" id="fltip" hidden></div></div>
      <div class="fl-roster" id="flroster"></div><p class="fl-legend"><b>!</b> asking you &nbsp;·&nbsp; <b>…</b> working &nbsp;·&nbsp; <b>Desk</b> working alone · <b>Meeting room</b> 5+ working together · <b>Partners room</b> partners at their own desks · <b>Bench</b> idle &nbsp;·&nbsp; tap any character</p>`;
    const cv = host.querySelector("#flcv"), wrap = host.querySelector("#flwrap"), stage = host.querySelector("#flstage"), tip = host.querySelector("#fltip"), bar = host.querySelector("#flbar"), roster = host.querySelector("#flroster"), hud = host.querySelector("#flhud");
    const main = cv.getContext("2d"); main.imageSmoothingEnabled = true;
    let scale = 2, sel = null, cur = null, last = performance.now(), lastSync = -1e9, t0 = performance.now();
    const bgCache = {};

    const firmById = id => api.byId[id];
    const tag = f => f.agents.map(a => ({ ...a, fid: f.id, accent: f.accent }));
    const small = api.firms.filter(f => f.agents.length < MIN_AGENTS).sort((a, b) => a.agents.length - b.agents.length);
    const offices = api.firms.filter(f => f.agents.length >= MIN_AGENTS).map(f => ({ ...f, agents: tag(f), fids: [f.id] }));
    if (small.length) offices.push({ id: "shared", name: "Shared office", accent: "#475569", agents: small.flatMap(tag), fids: small.map(f => f.id), shared: 1 });
    const rooms = {};

    /* ----- room construction ----- */
    function makeFirmRoom(f) {
      const th = TH[f.shared ? "shared" : f.id] || TH.dani, desks = [], objs = [], meet = [], part = [], idle = [];
      for (let i = 0; i < 12; i++) {
        const c = i % 4, r = (i / 4) | 0, dx = 10 + 48 * c, dy = 64 + 48 * r, ax = 48 + 48 * c, sy = dy + 4;
        const spot = { x: dx + 20, y: sy, sit: 1, dir: "d", out: [{ x: dx + 20, y: sy }, { x: ax, y: sy }, { x: ax, y: CY }] };
        desks.push({ x: dx, y: dy, i, spot, on: 0 });
      }
      [[242, 98, 1], [258, 98, 1], [274, 98, 1], [290, 98, 1]].forEach(([x, y]) => meet.push({ x, y, sit: 1, dir: "d", chair: 1, out: [{ x, y }, { x, y: 64 }, { x: 192, y: 64 }, { x: 192, y: CY }] }));
      [242, 258, 274, 290].forEach(x => meet.push({ x, y: 140, sit: 1, dir: "u", chair: 1, out: [{ x, y: 140 }, { x: 226, y: 140 }, { x: 226, y: 64 }, { x: 192, y: 64 }, { x: 192, y: CY }] }));
      [[238, 164], [266, 164], [294, 164], [238, 194], [266, 194], [294, 194]].forEach(([x, y]) => part.push({ x, y, sit: 1, dir: "d", chair: 1, big: 1, out: [{ x, y }, { x: 226, y }, { x: 226, y: CY }, { x: 192, y: CY }] }));
      for (let i = 0; i < 5; i++) idle.push({ x: 68 + i * 20, y: 208, dir: "d", out: [{ x: 68 + i * 20, y: 208 }, { x: 68 + i * 20, y: CY }] });
      for (let i = 0; i < 4; i++) idle.push({ x: 78 + i * 20, y: 219, dir: "d", out: [{ x: 78 + i * 20, y: 219 }, { x: 78 + i * 20, y: CY }] });
      th.lounge.forEach(([k, x, y, c]) => objs.push({ k: y + 18, d: () => P[k]({ x, y, c }) }));
      objs.push({ k: 140, d: () => meetTable(f) });
      objs.push({ k: 71, d: () => P.plant({ x: 300, y: 54 }) });
      part.forEach(p => objs.push({ k: p.y + 14, d: () => execDesk(p, f) }));
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
      const a = { id: ag.id, fid: ag.fid || f.id, name: ag.name, col: ag.accent || f.accent, skin: SKIN[h % 5], hair: HAIR[(h >> 3) % 6], x: (spawn || spot).x, y: (spawn || spot).y, dir: spot.dir || "d", sit: !spawn && !!spot.sit, moving: false, path: [], spot, want: spot, st: "working", seed: h, role: ag.r || "", desc: ag.d || "" };
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
      const all = f.agents.map(a => ({ a, st: api.state(a.fid, a.id) }));
      const act = all.filter(o => o.st !== "idle");
      const away = act.find(o => api.convened().includes(o.a.fid)) || null;
      const isP = o => PARTNERS.has(o.a.id), partners = all.filter(o => o !== away && isP(o)).slice(0, 6);
      const work = act.filter(o => o !== away && !isP(o)), bench = all.filter(o => o.st === "idle" && !isP(o));
      const team = work.filter(o => o.st !== "asking").length > 4;
      const want = new Map(); let m = 0, p = 0, desk = 0;
      r.desks.forEach(d => d.on = 0);
      work.slice(0, 12).forEach((o, i) => {
        let spot = r.desks[i].spot; r.desks[i].on = 1;
        if (team && o.st !== "asking" && m < 8) spot = r.meet[m++];
        if (spot === r.desks[i].spot) desk++;
        want.set(o.a.fid + "/" + o.a.id, { o, spot });
      });
      partners.forEach((o, i) => { want.set(o.a.fid + "/" + o.a.id, { o, spot: r.part[i] }); p++; });
      r.mode = team ? "Team meeting" : work.length ? "Solo work" : "Quiet";
      r.phase = 0;
      bench.slice(0, 9).forEach((o, i) => want.set(o.a.fid + "/" + o.a.id, { o, spot: r.idle[i] }));
      [...r.agents.keys()].forEach(id => { if (!want.has(id)) r.agents.delete(id); });
      want.forEach(({ o, spot }, id) => {
        let a = r.agents.get(id);
        if (!a) { a = newAgent(f, o.a, spot); r.agents.set(id, a); }
        a.st = o.st; a.task = api.task(o.a.fid, o.a.id);
        if (spot !== a.spot && spot !== a.pending) { if (a.moving) a.pending = spot; else go(a, spot); }
      });
      r.counts = { away: away ? 1 : 0, war: m, par: p, desk, bench: bench.length, work: work.length, more: Math.max(0, work.length - 12), benchMore: Math.max(0, bench.length - 9) };
    }

    /* ----- drawing ----- */
    function bgFor(r) {
      if (bgCache[r.id]) return bgCache[r.id];
      const c = document.createElement("canvas"); c.width = W * K; c.height = H * K;
      const og = c.getContext("2d"), prev = g; og.scale(K, K); g = og;
      if (r.isBoard) paintBoardBg(); else paintFirmBg(r.firm, r.th);
      g = prev; bgCache[r.id] = c; return c;
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const r = rooms[room]; if (!r) return;
      if (now - lastSync > 700) { lastSync = now; sync(r, now); updateHud(r); }
      r.agents.forEach(a => step(a, dt));
      g = main; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W * K, H * K); g.drawImage(bgFor(r), 0, 0); g.setTransform(K, 0, 0, K, 0, 0);
      const t = now;
      if (r.isBoard) bannersAndLedger(r, t);
      else {
        r.th.deco.forEach((k, i) => D[k](DECO_X[i], t)); tvDraw(r.firm, t);
        
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
        const cx = Math.max(tw(lbl, 4.4) / 2 + 6, Math.min(W - tw(lbl, 4.4) / 2 - 6, a.x)), y0 = a.y - 29;
        pill(lbl, cx, y0, a.col, "#fff", 4.4);
      });
      raf = requestAnimationFrame(frame);
    }

    /* ----- HUD, chips, resize ----- */
    function updateHud(r) {
      const f = r.firm, c = r.counts, names = ["Kickoff", "Drafting", "Review"];
      if (r.isBoard) { hud.innerHTML = `<span class="fl-tag" style="--a:#16181D">PLENARY</span><span>${c.board} firms at the table</span><span>one fact ledger · blind positions</span>`; }
      else hud.innerHTML = `<span class="fl-tag" style="--a:${f.accent}">${f.name.toUpperCase()}</span>${f.shared ? `<span>${f.fids.map(i => SHORT[i] || i).join(" + ")}</span>` : ""}<span class="fl-ph">${r.mode}</span><span>MEETING <b>${c.war || 0}</b></span><span>PARTNERS <b>${c.par || 0}</b></span><span>AT PLENARY <b>${c.away || 0}</b></span><span>DESKS <b>${c.desk || 0}</b></span><span>BENCH <b>${c.bench || 0}</b></span>${c.more || c.benchMore ? `<span class="fl-more">+${(c.more || 0) + (c.benchMore || 0)} more off-screen</span>` : ""}`;
      drawRoster(r); drawBar();
    }
    function drawBar() {
      const chip = (id, name, n, a) => `<button class="chip" data-room="${id}" aria-pressed="${room === id}" style="--a:${a}"><i></i>${name}${n ? ` · ${n}` : ""}</button>`;
      bar.innerHTML = chip("plenary", "Boardroom", api.convened().length, "#16181D") + offices.map(f => chip(f.id, f.name, f.agents.filter(a => api.state(a.fid, a.id) !== "idle").length, f.accent)).join("");
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
    function showTip(a) {
      sel = a;
      if (!a) { tip.hidden = true; return; }
      const r = rooms[room], fm = r.isBoard ? a.rep : (firmById(a.fid) || r.firm), where = r.isBoard ? "at the boardroom table" : a.sit ? (a.spot.dir === "u" || r.meet.includes(a.spot) ? "in the meeting room" : r.part.includes(a.spot) ? "in the partners room" : "at their desk") : a.st === "idle" ? "on the bench" : "on the way";
      const s = a.st === "asking" ? "asking you" : a.st === "idle" ? "on the bench" : "working";
      const who = a.role || a.desc ? `<p class="fl-who">${a.role ? `<b>${a.role}</b>` : ""}${a.desc ? `<span>${a.desc}</span>` : ""}</p>` : "";
      tip.innerHTML = `<b>${a.name}</b><small>${fm.name} · ${s} · ${where}</small>${who}<p>${a.task && a.st !== "idle" ? a.task : "Nothing right now."}</p>${a.st === "asking" ? '<button class="send" data-go="needs">Answer</button>' : ""}${!r.isBoard ? '<button class="ghost" data-go="agent">Open in Office</button>' : ""}`;
      tip.hidden = false; tip.dataset.f = fm.id; tip.dataset.a = a.id;
      const px = Math.min(Math.max(4, a.x * scale - 115), W * scale - 234), py = Math.max(4, (a.y - 40) * scale);
      tip.style.left = px + "px"; tip.style.top = Math.min(py + 40, H * scale - 150) + "px";
    }
    cv.addEventListener("click", ev => showTip(pick(ev)));
    let rosterKey = "";
    function drawRoster(r) {
      if (r.isBoard) { roster.innerHTML = ""; rosterKey = ""; return; }
      const list = r.firm.agents.map(ag => r.agents.get(ag.fid + "/" + ag.id) || r.agents.get(ag.id) || { fid: ag.fid, id: ag.id, name: ag.name, col: ag.accent, st: api.state(ag.fid, ag.id), role: ag.r, desc: ag.d, x: 160, y: 120, task: "", off: 1 }).sort((x, y) => (x.st === "idle") - (y.st === "idle") || x.name.localeCompare(y.name));
      const key = r.id + list.map(a => a.fid + a.id + a.st).join();
      if (key === rosterKey) return; rosterKey = key;
      roster.innerHTML = `<h3>Everyone in this office · ${f_count(r)}</h3>` + list.map(a => `<button data-ra="${a.fid}/${a.id}" class="${a.st}" style="--a:${a.col}"><i></i>${a.name}</button>`).join("");
    }
    const f_count = r => r.firm.agents.length;
    roster.addEventListener("click", e => { const b = e.target.closest("[data-ra]"); if (!b) return; const [fid, id] = b.dataset.ra.split("/"); const r = rooms[room], ag = r.firm.agents.find(x => x.fid === fid && x.id === id), a = [...r.agents.values()].find(x => x.fid === fid && x.id === id) || { fid, id, name: ag.name, col: ag.accent, st: api.state(fid, id), role: ag.r, desc: ag.d, x: 160, y: 120, task: "", off: 1, spot: { out: [] } }; if (a) { showTip(a); wrap.scrollIntoView({ block: "nearest", behavior: "smooth" }); } });
    tip.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (!b) return; if (b.dataset.go === "needs") api.goNeeds(); else api.openAgent(tip.dataset.f, tip.dataset.a); });
    bar.addEventListener("click", e => { const b = e.target.closest("[data-room]"); if (!b) return; room = b.dataset.room; sel = null; tip.hidden = true; lastSync = -1e9; drawBar(); });
    window.addEventListener("resize", resize);

    rooms.plenary = makeBoard(); offices.forEach(f => rooms[f.id] = makeFirmRoom(f));
    if (!rooms[room]) room = "plenary";
    drawBar(); resize(); raf = requestAnimationFrame(frame);
  }
  window.Floor = { mount };
})();

