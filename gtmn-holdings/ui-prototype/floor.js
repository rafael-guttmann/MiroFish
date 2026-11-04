(function () {
  const TW = 64, TH = 32, N = 12, WH = 130;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const shade = (c, t) => t < 0 ? mix(c, "#000000", -t) : mix(c, "#ffffff", t);
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const SKIN = ["#F1C9A5", "#E0A87C", "#C68A5E", "#9A6240", "#6E4329", "#F6D7BC"];
  const HAIR = ["#2A211C", "#5A3A22", "#B7791F", "#1B1B1B", "#8A8F99", "#7B341E", "#E8D9B0"];
  const DESK = [[1, 1.6], [4, 1.6], [7, 1.6], [10, 1.6], [1, 4.4], [4, 4.4], [7, 4.4], [10, 4.4], [1, 7.2], [4, 7.2], [7, 7.2], [10, 7.2]];
  const AISLES = [0.5, 3.5, 6.5, 9.5];
  const PSEATS = [[4.6, 3.9, 0], [6.0, 3.9, 0], [7.4, 3.9, 0], [4.6, 8.3, 1], [6.0, 8.3, 1], [7.4, 8.3, 1]];

  let token = 0;

  function mount(host, api) {
    const my = ++token;
    host.innerHTML = `<div class="fl-bar" id="flbar"></div>
      <div class="fl-wrap" id="flwrap"><canvas id="flcv" aria-label="Isometric office floor"></canvas><div class="fl-tip" id="fltip" hidden></div></div>
      <p class="fl-legend"><span class="pawn asking working" style="--a:#555;width:14px;height:14px;line-height:14px"></span> asking you &nbsp; · &nbsp; <b>…</b> thinking &nbsp; · &nbsp; Tap anyone to see what they're doing</p>`;
    const cv = host.querySelector("#flcv"), wrap = host.querySelector("#flwrap"), tip = host.querySelector("#fltip"), bar = host.querySelector("#flbar");
    const ctx = cv.getContext("2d");
    let room = "plenary", sel = null, W = 0, H = 0, sc = 1, ox = 0, oy = 0, avs = new Map(), seatOf = {}, last = performance.now(), recon = 0, lastRoom = null;

    function drawBar() {
      const chip = (id, name, n, a) => `<button class="chip" data-room="${id}" aria-pressed="${room === id}" style="--a:${a}"><i></i>${name}${n ? ` · ${n}` : ""}</button>`;
      bar.innerHTML = chip("plenary", "Boardroom", api.convened().length, "#16181D") + api.firms.map(f => { const n = f.agents.filter(a => api.state(f.id, a.id) !== "idle").length; return chip(f.id, f.name, n, f.accent); }).join("");
    }
    bar.onclick = e => { const b = e.target.closest("[data-room]"); if (!b) return; room = b.dataset.room; sel = null; tip.hidden = true; drawBar(); };

    function resize() {
      const r = wrap.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(r.width, 640); H = r.height;
      cv.style.width = W + "px"; cv.style.height = H + "px";
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      requestAnimationFrame(() => { wrap.scrollLeft = (W - r.width) / 2; });
      const rw = N * TW + 60, rh = N * TH + WH + 70;
      sc = Math.min(W / rw, H / rh); ox = W / 2; oy = (H - rh * sc) / 2 + (WH + 20) * sc;
    }
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    const P = (gx, gy, z = 0) => [(gx - gy) * TW / 2, (gx + gy) * TH / 2 - z];
    const poly = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
    function box(gx, gy, w, d, h, col, z0 = 0) {
      poly([P(gx, gy, z0 + h), P(gx + w, gy, z0 + h), P(gx + w, gy + d, z0 + h), P(gx, gy + d, z0 + h)], shade(col, .1));
      poly([P(gx, gy + d, z0), P(gx + w, gy + d, z0), P(gx + w, gy + d, z0 + h), P(gx, gy + d, z0 + h)], shade(col, -.08));
      poly([P(gx + w, gy, z0), P(gx + w, gy + d, z0), P(gx + w, gy + d, z0 + h), P(gx + w, gy, z0 + h)], shade(col, -.22));
    }
    const wallR = (gx, z, fn) => { const [x, y] = P(gx, 0, z); ctx.save(); ctx.translate(x, y); ctx.transform(1, .5, 0, 1, 0, 0); fn(); ctx.restore(); };
    const wallL = (gy, z, fn) => { const [x, y] = P(0, gy, z); ctx.save(); ctx.translate(x, y); ctx.transform(1, -.5, 0, 1, 0, 0); fn(); ctx.restore(); };

    function shell(f) {
      const a = f.accent === "#FFFFFF" ? "#3B4252" : f.accent;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], (i + j) % 2 ? mix("#E6E0D2", a, .06) : mix("#EFEADD", a, .05));
      const wl = mix("#F3F0E8", a, .22), wr = mix("#F8F6F0", a, .14);
      poly([P(0, 0, 0), P(0, N, 0), P(0, N, WH), P(0, 0, WH)], wl);
      poly([P(0, 0, 0), P(N, 0, 0), P(N, 0, WH), P(0, 0, WH)], wr);
      poly([P(0, 0, 0), P(0, N, 0), P(0, N, 10), P(0, 0, 10)], shade(wl, -.15));
      poly([P(0, 0, 0), P(N, 0, 0), P(N, 0, 10), P(0, 0, 10)], shade(wr, -.12));
      ctx.strokeStyle = "rgba(22,24,29,.25)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); [P(0, N, WH), P(0, 0, WH), P(N, 0, WH)].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      // right wall: name sign + windows
      if (f.id !== "plenary") wallR(3.5, 68, () => { ctx.fillStyle = "#1B1E25"; ctx.fillRect(0, -34, 5 * 32, 34); ctx.fillStyle = a; ctx.fillRect(0, -34, 6, 34); ctx.fillStyle = "#fff"; ctx.font = "600 17px Georgia,serif"; ctx.textBaseline = "middle"; ctx.fillText(f.name, 16, -17); });
      [0.8, 9.2].forEach(g => wallR(g, 62, () => { ctx.fillStyle = "#CFE0EE"; ctx.fillRect(0, -50, 64, 50); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(4, -46, 12, 42); ctx.strokeStyle = "#8C96A3"; ctx.lineWidth = 3; ctx.strokeRect(0, -50, 64, 50); ctx.beginPath(); ctx.moveTo(32, -50); ctx.lineTo(32, 0); ctx.stroke(); }));
      wallL(2.5, 62, () => { ctx.fillStyle = "#CFE0EE"; ctx.fillRect(0, -50, 64, 50); ctx.strokeStyle = "#8C96A3"; ctx.lineWidth = 3; ctx.strokeRect(0, -50, 64, 50); });
      wallL(7.2, 66, () => { ctx.fillStyle = "#fff"; ctx.fillRect(0, -44, 56, 44); ctx.strokeStyle = "#16181D"; ctx.lineWidth = 2; ctx.strokeRect(0, -44, 56, 44); ctx.fillStyle = a; [10, 20, 30].forEach((y, i) => ctx.fillRect(8, -44 + y, 40 - i * 9, 4)); });
    }

    const sofa = () => { box(1, 10.3, 3.4, 1.2, 12, "#7C8DA6"); box(1, 10.3, 3.4, .35, 28, "#6C7C94"); };
    const plant = (gx, gy) => { box(gx, gy, .6, .6, 12, "#B5714A"); const [x, y] = P(gx + .3, gy + .3, 12); ctx.fillStyle = "#3F8F5A"; [[-12, -10], [12, -12], [0, -22], [-6, -3], [7, -4]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 9, 13, dx / 20, 0, 7); ctx.fill(); }); };
    const cooler = (gx, gy) => { box(gx, gy, .6, .6, 34, "#E9EEF2"); box(gx + .05, gy + .05, .5, .5, 16, "#8FC5E8", 34); };
    const rug = a => poly([P(5, 9.9), P(9.6, 9.9), P(9.6, 11.8), P(5, 11.8)], mix("#D9D2C0", a, .25));

    function firmRoom(f, t) {
      const a = f.accent;
      const list = f.agents.map(x => ({ ...x, st: api.state(f.id, x.id), task: api.task(f.id, x.id) }));
      const act = list.filter(x => x.st !== "idle").sort((p, q) => (q.st === "asking") - (p.st === "asking"));
      const idle = list.filter(x => x.st === "idle");
      // seats
      const cap = DESK.length, active = new Set(act.map(x => x.id));
      for (const id of Object.keys(seatOf)) if (!active.has(id)) delete seatOf[id];
      const taken = new Set(Object.values(seatOf));
      act.forEach(x => { if (seatOf[x.id] == null) { for (let s = 0; s < cap; s++) if (!taken.has(s)) { seatOf[x.id] = s; taken.add(s); break; } } });
      const seated = act.filter(x => seatOf[x.id] != null), overflow = act.length - seated.length;
      const lounge = [...act.filter(x => seatOf[x.id] == null), ...idle].slice(0, 8);
      const want = new Map();
      seated.forEach(x => want.set(x.id, { a: x, seat: seatOf[x.id] }));
      lounge.forEach(x => want.set(x.id, { a: x, seat: null }));
      for (const k of [...avs.keys()]) if (!want.has(k)) avs.delete(k);
      want.forEach((w, id) => {
        let v = avs.get(id);
        const s = w.seat, d = s != null ? DESK[s] : null;
        if (!v) { v = avs.get(id) || { id, name: w.a.name, seat: null, x: s != null ? d[0] + 1 : 2 + (hash(id) % 8), y: s != null ? d[1] - .4 : 10.4 + (hash(id + "y") % 10) / 12, path: [], pause: 0, ph: hash(id) % 100 / 10 }; avs.set(id, v); }
        v.st = w.a.st; v.task = w.a.task; v.firm = f; v.skin = SKIN[hash(id) % SKIN.length]; v.hair = HAIR[hash(id + "h") % HAIR.length]; v.col = a;
        if (v.seat !== s) {
          v.seat = s;
          if (reduce) { if (s != null) { v.x = d[0] + 1; v.y = d[1] - .4; } v.path = []; }
          else if (s != null) { const sx = d[0] + 1, cy = d[1] - 1.1, ax = AISLES.reduce((p, q) => Math.abs(q - v.x) < Math.abs(p - v.x) ? q : p); v.path = [[ax, v.y], [ax, cy], [sx, cy], [sx, d[1] - .4]]; }
          else { const d0 = DESK[Object.keys(seatOf).length ? 0 : 0]; v.path = [[v.x, v.y - 1.1], [AISLES.reduce((p, q) => Math.abs(q - v.x) < Math.abs(p - v.x) ? q : p), v.y - 1.1], [AISLES[0], 10.2]]; v.wander = true; }
        }
      });
      const items = [];
      items.push({ k: 20, fn: () => rug(a) });
      items.push({ k: 12, fn: sofa }, { k: 22, fn: () => plant(10.8, 10.8) }, { k: 21, fn: () => cooler(11, 9.4) }, { k: 1, fn: () => { box(.1, 2.4, .5, 2.4, 60, mix("#CDBBA0", a, .08)); } });
      DESK.forEach(([dx, dy], i) => {
        const occ = Object.keys(seatOf).find(id => seatOf[id] === i), v = occ && avs.get(occ);
        items.push({ k: dx + dy + 0.3, fn: () => box(dx + .7, dy - .65, .6, .6, 10, shade(a, -.3)) });
        items.push({ k: dx + dy + 1.5, fn: () => {
          box(dx, dy, 2, 1, 20, mix("#CDBBA0", a, .1));
          box(dx + .8, dy + .3, .5, .12, 15, "#242830", 20);
          if (v) { const [x, y] = P(dx + 1.3, dy + .36, 33); ctx.fillStyle = v.st === "asking" ? "#C2410C" : "#5BE38E"; ctx.beginPath(); ctx.arc(x - 3, y, 2.4, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(91,227,142,.14)"; ctx.beginPath(); ctx.ellipse(x - 14, y + 20, 30, 12, 0, 0, 7); ctx.fill(); }
          box(dx + .55, dy + .6, .9, .26, 2, "#F4F1EA", 20);
        } });
      });
      avs.forEach(v => items.push({ k: v.x + v.y + .6, fn: () => av(v, t) }));
      const extra = [];
      if (overflow > 0) extra.push(`+${overflow} more working, no free desk`);
      if (list.length > lounge.length + seated.length) extra.push(`+${list.length - lounge.length - seated.length} more on the bench`);
      return { items, extra };
    }

    function plenary(t) {
      const seats = api.convened().slice(0, PSEATS.length), items = [];
      const want = new Set(seats);
      for (const k of [...avs.keys()]) if (!want.has(k)) avs.delete(k);
      seats.forEach((id, i) => {
        const f = api.byId[id], [sx, sy, back] = PSEATS[i];
        let v = avs.get(id);
        if (!v) { v = { id, name: f.name, firm: f, seat: i, x: reduce ? sx : 10.8, y: reduce ? sy : 10.8, path: reduce ? [] : [[10.6, sy], [sx, sy]], pause: 0, ph: i * 1.7, back: !!back }; avs.set(id, v); }
        v.st = "working"; v.task = "Writing a blind position on Orbit Labs"; v.skin = SKIN[hash(id) % SKIN.length]; v.hair = HAIR[hash(id + "h") % HAIR.length]; v.col = f.accent; v.back = !!back; v.label = f.name;
      });
      items.push({ k: 5, fn: () => {
        box(4, 4.5, 4, 3, 24, "#B58A5A");
        [[4.2, 4.7], [7.5, 4.7], [4.2, 6.8], [7.5, 6.8]].forEach(([x, y]) => box(x, y, .3, .3, 0, "#B58A5A", 0));
        const [cx, cy] = P(6, 6, 24); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(cx, cy, 60, 24, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#1B1E25"; ctx.font = "600 11px Georgia,serif"; ctx.textAlign = "center"; ctx.fillText("PLENARY", cx, cy + 4); ctx.textAlign = "left";
      } });
      items.push({ k: 1, fn: () => wallR(2.5, 92, () => {
        ctx.fillStyle = "#fff"; ctx.fillRect(0, -70, 6 * 32, 70); ctx.strokeStyle = "#16181D"; ctx.lineWidth = 2; ctx.strokeRect(0, -70, 6 * 32, 70);
        ctx.fillStyle = "#16181D"; ctx.font = "600 12px Georgia,serif"; ctx.fillText("Fact ledger · 23 facts", 10, -52);
        ctx.fillStyle = "#CFCABD"; [0, 1, 2, 3].forEach(i => ctx.fillRect(10, -40 + i * 11, 150 - i * 22, 5));
      }) });
      items.push({ k: 22, fn: () => plant(10.8, 10.8) }, { k: 21, fn: () => plant(.3, 10.8) });
      avs.forEach(v => items.push({ k: v.x + v.y + .6, fn: () => av(v, t) }));
      return { items, extra: [] };
    }

    function av(v, t) {
      const [px, py] = P(v.x, v.y), moving = v.path && v.path.length, seated = v.seat != null && v.firm && v.firm.id !== "plenary" && !moving, tt = t / 1000 + v.ph;
      const bob = reduce ? 0 : moving ? Math.abs(Math.sin(tt * 9)) * 3 : v.st !== "idle" ? Math.sin(tt * 2) * 0.8 : 0;
      ctx.save(); ctx.translate(px, py - bob + (seated ? 8 : 0));
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, bob, 11, 5, 0, 0, 7); ctx.fill();
      if (sel === v.id) { ctx.strokeStyle = "#16181D"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, bob, 15, 7, 0, 0, 7); ctx.stroke(); }
      const sw = moving && !reduce ? Math.sin(tt * 9) * 3 : 0;
      ctx.fillStyle = "#2B2F3A"; ctx.fillRect(-6, -16 + sw, 5, 16 - sw); ctx.fillRect(1, -16 - sw, 5, 16 + sw);
      ctx.fillStyle = v.col; ctx.fillRect(-8, -34, 16, 19);
      ctx.fillStyle = shade(v.col, .25); ctx.fillRect(-3, -34, 6, 3);
      const typ = !moving && v.st !== "idle" && !reduce ? Math.sin(tt * 14) * 2 : 0;
      ctx.fillStyle = shade(v.col, -.18);
      if (v.st !== "idle" && !moving) { ctx.fillRect(-12, -30, 4, 12); ctx.fillRect(8, -30, 4, 12); ctx.fillStyle = v.skin; ctx.fillRect(-12, -19 + typ, 4, 4); ctx.fillRect(8, -19 - typ, 4, 4); }
      else { ctx.fillRect(-12, -33 + sw, 4, 14); ctx.fillRect(8, -33 - sw, 4, 14); ctx.fillStyle = v.skin; ctx.fillRect(-12, -19 + sw, 4, 4); ctx.fillRect(8, -19 - sw, 4, 4); }
      ctx.fillStyle = v.skin; ctx.fillRect(-7, -50, 14, 16);
      ctx.fillStyle = v.hair; ctx.fillRect(-8, -53, 16, v.back ? 18 : 7); if (!v.back) { ctx.fillRect(-8, -47, 3, 6); ctx.fillRect(5, -47, 3, 6); }
      if (!v.back) { ctx.fillStyle = "#16181D"; ctx.fillRect(-4, -42, 2.5, 3); ctx.fillRect(2, -42, 2.5, 3); }
      const tag = v.label || v.name.split(" ").slice(-1)[0];
      ctx.font = "600 10px -apple-system,Segoe UI,sans-serif"; const w = ctx.measureText(tag).width + 10;
      ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.beginPath(); ctx.roundRect(-w / 2, -70, w, 14, 7); ctx.fill();
      ctx.fillStyle = "#16181D"; ctx.textAlign = "center"; ctx.fillText(tag, 0, -60); ctx.textAlign = "left";
      if (v.st === "asking") { const s = 1 + (reduce ? 0 : Math.sin(tt * 5) * .08); ctx.fillStyle = "#C2410C"; ctx.beginPath(); ctx.arc(0, -86, 10 * s, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", 0, -81); ctx.textAlign = "left"; }
      else if (v.st === "working" && !moving && Math.floor(tt / 3) % 3 === 0) { ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.roundRect(-14, -92, 28, 16, 8); ctx.fill(); ctx.fillStyle = "#16181D"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-6 + i * 6, -84 - (reduce ? 0 : Math.sin(tt * 6 + i) * 1.5), 1.8, 0, 7); ctx.fill(); } }
      ctx.restore();
      v.sx = ox + px * sc; v.sy = oy + (py - 36) * sc; v.rr = 24 * sc;
    }

    function step(dt) {
      avs.forEach(v => {
        if (v.path && v.path.length) {
          const [tx, ty] = v.path[0], dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy), sp = 2.2 * dt;
          if (d <= sp) { v.x = tx; v.y = ty; v.path.shift(); } else { v.x += dx / d * sp; v.y += dy / d * sp; }
        } else if (v.seat == null && v.firm && v.firm.id !== "plenary" && !reduce) {
          v.pause = (v.pause || 0) - dt;
          if (v.pause <= 0) { v.pause = 2 + Math.random() * 4; v.path = [[Math.max(.8, Math.min(11.2, v.x + (Math.random() - .5) * 5)), 10.2 + Math.random() * 1.4]]; }
        }
      });
    }

    function frame(now) {
      if (my !== token || !host.isConnected) return;
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (room !== lastRoom) { avs = new Map(); seatOf = {}; lastRoom = room; drawBar(); }
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
      const f = room === "plenary" ? { id: "plenary", name: "Plenary boardroom", accent: "#FFFFFF" } : api.byId[room];
      shell(f);
      const r = room === "plenary" ? plenary(now) : firmRoom(f, now);
      step(dt);
      r.items.sort((a, b) => a.k - b.k).forEach(i => i.fn());
      ctx.restore();
      ctx.fillStyle = "rgba(22,24,29,.7)"; ctx.font = "13px -apple-system,Segoe UI,sans-serif";
      r.extra.forEach((s, i) => ctx.fillText(s, 14, H - 14 - i * 18));
      if (sel && avs.get(sel)) place(avs.get(sel));
      requestAnimationFrame(frame);
    }

    function place(v) {
      const rect = wrap.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(v.sx - wrap.scrollLeft + 24, rect.width - 250)) + "px"; tip.style.top = Math.max(8, v.sy - 70) + "px";
    }
    function showTip(v) {
      const s = v.st === "asking" ? "Asking you" : v.st === "working" ? "Working" : "On the bench";
      tip.innerHTML = `<b>${v.name}</b><small>${v.firm.name} · ${s}</small><p>${v.task && v.st !== "idle" ? v.task : "Nothing right now."}</p>${v.st === "asking" ? '<button class="send" data-go="needs">Answer</button>' : ""}${v.firm.id !== "plenary" ? '<button class="ghost" data-go="agent">Open in Office</button>' : ""}`;
      tip.hidden = false; place(v);
    }
    tip.onclick = e => { const b = e.target.closest("[data-go]"); if (!b) return; const v = avs.get(sel); if (b.dataset.go === "needs") api.goNeeds(); else api.openAgent(v.firm.id, v.id); };
    wrap.addEventListener("click", e => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let best = null, bd = 1e9;
      avs.forEach(v => { const d = Math.hypot(v.sx - x, v.sy - y); if (d < Math.max(v.rr, 22) && d < bd) { best = v; bd = d; } });
      if (best) { sel = best.id; showTip(best); } else { sel = null; tip.hidden = true; }
    });

    drawBar(); resize(); requestAnimationFrame(frame);
  }
  window.Floor = { mount };
})();
