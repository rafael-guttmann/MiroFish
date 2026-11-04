(function () {
  const FIRMS = window.FIRMS;
  FIRMS.forEach(f => f.agents.forEach(a => { if (a.name === a.name.toLowerCase()) a.name = a.name[0].toUpperCase() + a.name.slice(1); }));
  const byId = Object.fromEntries(FIRMS.map(f => [f.id, f]));
  const PLENARY = { id: "plenary", name: "Plenary boardroom", role: "Several firms, one mandate", accent: "#FFFFFF" };
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const initials = n => n.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const S = { tab: "office", firm: null, agent: null, showAll: false, route: null, sel: new Set(), state: {}, task: {}, convened: ["gtmn-cto", "dani", "spc-deal-team"] };
  FIRMS.forEach(f => f.agents.forEach(a => S.state[f.id + "/" + a.id] = "idle"));
  const set = (fid, aid, st, task) => { S.state[fid + "/" + aid] = st; if (task) S.task[fid + "/" + aid] = task; };
  const firmAgents = f => f.agents.map(a => ({ ...a, st: S.state[f.id + "/" + a.id] }));
  const pick = (f, n, st, task) => f.agents.slice(0, n).forEach((a, i) => set(f.id, a.id, st, task));
  pick(byId["gtmn-cto"], 3, "working", "Reading the vendor pitch and writing a blind position");
  set("gtmn-cto", "cto-larson", "asking", "Waiting for your answer on hosting");
  pick(byId["plan-house"], 9, "working", "Building the assumption register");
  set("plan-house", byId["plan-house"].agents[2].id, "asking", "Waiting for your answer on the base year");
  pick(byId["ogc-dg"], 14, "working", "Reviewing the loan agreement clause by clause");
  set("ogc-dg", byId["ogc-dg"].agents[5].id, "asking", "Waiting for your approval on the indemnity");
  pick(byId["zencredit-firm"], 2, "working", "Running the hazard model");
  set("dani", "dani", "working", "Giving a second opinion on the founding team");

  let jobs = [
    { id: 1, t: "Evaluate the AgentOps vendor pitch", f: "gtmn-cto", col: "work", p: .6 },
    { id: 2, t: "Go/no-go: acquire a Brazilian fintech", f: "plan-house", col: "need", p: .35 },
    { id: 3, t: "Review the MCA loan agreement template", f: "ogc-dg", col: "need", p: .7 },
    { id: 4, t: "Should we back Orbit Labs?", f: "plenary", col: "need", p: .2 },
    { id: 5, t: "Noteholder pack, Q4", f: "zencredit-firm", col: "work", p: .45 },
    { id: 6, t: "JV term sheet for Mexico", f: "alliance-house", col: "wait", p: 0 },
    { id: 7, t: "Family office allocation memo", f: "cio-ic-memo", col: "wait", p: 0 },
    { id: 8, t: "Technical review of the Plenary plugin", f: "gtmn-cto", col: "done", p: 1 },
    { id: 9, t: "Credit portfolio review, Q3", f: "zencredit-firm", col: "done", p: 1 },
  ];
  const fl = id => id === "plenary" ? PLENARY : byId[id];

  let cards = [
    { id: "c1", job: 2, firm: "plan-house", agent: byId["plan-house"].agents[2].name, kind: "one", q: "Which base year should the five-year model use?",
      opts: [["2024 actuals", "Audited numbers. Safer, but a year old.", 1], ["2025 forecast", "Fresher, but based on management estimates."], ["Show both", "Two models side by side. Takes about 20 minutes longer."]],
      why: "Every growth rate in the plan hangs off this base. Changing it later means redoing the assumption register.", def: "If you don't answer, I'll use 2024 actuals." },
    { id: "c2", job: 1, firm: "gtmn-cto", agent: "Will Larson", kind: "one", q: "Where should the Holdings platform live first?",
      opts: [["One cloud server", "Simplest and cheapest. Good until about ten firms run at once.", 1], ["Managed containers", "Scales on its own. More setup and more to pay for."], ["Your own machine", "Full control. It sleeps when your laptop does."]],
      why: "This sets how the office stays on when you close your laptop, and what it costs each month.", def: "If you don't answer, I'll wait. The build can't start without it." },
    { id: "c3", job: 3, firm: "ogc-dg", agent: byId["ogc-dg"].agents[5].name, kind: "one", approve: 1, q: "Approve the revised indemnity clause before it goes to the counterparty?",
      opts: [["Approve", "Send it as drafted.", 1], ["Approve with changes", "You tell us what to adjust, then it goes."], ["Reject", "Send it back to the drafting desk."]],
      why: "A senior partner has signed off. Your approval is the last gate before anything leaves the building.", def: "Nothing leaves without your approval. This one waits." },
    { id: "c4", job: 4, firm: "plenary", agent: "Plenary Chair", kind: "many", q: "Which firms should sit on the Orbit Labs mandate?",
      opts: [["SPC Deal Team", "Venture diligence on the company and the round.", 1], ["Office of the CIO", "Fit with the family office allocation.", 1], ["DG-IB", "Valuation and deal structure."], ["Office of the CTO", "Technical due diligence on the product."]],
      why: "Each firm writes its position blind, then they cross-examine each other inside their own lanes.", def: "If you don't answer, I'll convene the recommended ones." },
  ];
  const feed = [];
  const say = (fid, who, text) => { feed.unshift({ fid, who, text, t: clock() }); if (feed.length > 40) feed.pop(); if ($("#aside")) renderAside(true); };
  say("ogc-dg", "OGC DG", "Seat 6 asked you to approve an indemnity clause");
  say("gtmn-cto", "Office of the CTO", "Three seats started writing blind positions");
  say("plan-house", "Plan House", "Assumption register reached 41 entries");
  say("plenary", "Plenary", "Orbit Labs mandate opened, waiting for you to pick firms");

  const pawn = (f, a, cls = "", d = 0) => `<span class="pawn ${cls}" style="--a:${f.accent};--d:${d}s" title="${esc(a)}">${esc(initials(a))}</span>`;
  const counts = f => { const l = firmAgents(f); return { work: l.filter(a => a.st === "working" || a.st === "asking").length, ask: l.filter(a => a.st === "asking").length, n: l.length }; };

  function header(title, sub) {
    const w = FIRMS.reduce((n, f) => n + counts(f).work, 0);
    return `<div class="top"><div><h1>${title}</h1><p class="sub">${sub}</p></div>
      <div class="pulse"><span><i class="dot work"></i><b>${w}</b> working</span><span><i class="dot need"></i><b>${cards.length}</b> need you</span><span><i class="dot wait"></i><b>${jobs.filter(j => j.col === "wait").length}</b> waiting</span></div></div>`;
  }

  /* OFFICE */
  function office() {
    if (S.agent) return agentView();
    if (S.firm) return firmView();
    const rooms = FIRMS.map(f => {
      const c = counts(f), l = firmAgents(f).sort((a, b) => (b.st !== "idle") - (a.st !== "idle"));
      const shown = l.slice(0, 10), rest = c.n - shown.length;
      return `<button class="room ${c.work ? "busy" : ""} ${c.ask ? "need-flag" : ""}" style="--a:${f.accent}" data-firm="${f.id}">
        <div><h3>${esc(f.name)}</h3><div class="role">${esc(f.role)}</div></div>
        <div class="pawns">${shown.map((a, i) => pawn(f, a.name, a.st === "idle" ? "idle" : a.st === "asking" ? "working asking" : "working", (i % 5) * .25)).join("")}${rest > 0 ? `<span class="bench">+${rest}</span>` : ""}</div>
        <div class="count"><span>${c.work ? `${c.work} of ${c.n} working` : `${c.n} on the bench`}</span>${c.ask ? `<span>${c.ask} asking</span>` : "<span></span>"}</div></button>`;
    });
    const seats = S.convened.map((id, i) => pawn(byId[id], byId[id].name, "working", i * .3)).join("");
    const board = `<button class="room boardroom ${S.convened.length ? "busy" : ""}" style="--a:#fff" data-firm="plenary">
      <div><h3>Plenary boardroom</h3><div class="role">Orbit Labs · ${S.convened.length} firms in session</div></div>
      <div class="pawns">${seats}</div><div class="count"><span>Blind positions being written</span><span>Open</span></div></button>`;
    const order = [board, ...rooms];
    return `${header("The building", "Every firm, live. Tap a room to look inside.")}<div class="building">${order.join("")}</div>`;
  }
  function firmView() {
    if (S.firm === "plenary") {
      return `<div class="crumbs"><button data-back="b">The building</button> / Plenary</div>
      <div class="firmhead" style="--a:#16181D"><i></i><div><h1>Plenary boardroom</h1><p class="sub">Orbit Labs · ${S.convened.length} firms at the table</p></div></div>
      <h2>At the table</h2><div class="desks">${S.convened.map(id => `<div class="desk"><span class="pawn working" style="--a:${byId[id].accent}">${initials(byId[id].name)}</span><div><b>${esc(byId[id].name)}</b><small class="state-work">writing blind position</small></div></div>`).join("")}</div>
      <h2 class="group">Steps</h2><div class="desks">${["Fact ledger", "Blind positions", "Single text", "Cross-examination", "Decision memo"].map((s, i) => `<div class="desk ${i > 1 ? "idle" : ""}"><div><b>${i + 1}. ${s}</b><small>${i === 0 ? "done · 23 facts" : i === 1 ? "in progress" : "not started"}</small></div></div>`).join("")}</div>`;
    }
    const f = byId[S.firm], l = firmAgents(f), act = l.filter(a => a.st !== "idle"), idle = l.filter(a => a.st === "idle");
    const card = a => `<button class="desk ${a.st === "idle" ? "idle" : ""}" data-agent="${a.id}">${pawn(f, a.name, a.st === "idle" ? "idle" : a.st === "asking" ? "working asking" : "working")}<div><b>${esc(a.name)}</b><small class="${a.st === "asking" ? "state-ask" : a.st === "working" ? "state-work" : ""}">${a.st === "asking" ? "asking you" : a.st === "working" ? "working" : "on the bench"}</small></div></button>`;
    const showIdle = idle.length <= 12 || S.showAll;
    return `<div class="crumbs"><button data-back="b">The building</button> / ${esc(f.name)}</div>
      <div class="firmhead" style="--a:${f.accent}"><i></i><div><h1>${esc(f.name)}</h1><p class="sub">${esc(f.role)} · ${l.length} agents · ${act.length} working</p></div></div>
      ${act.length ? `<h2>Working now</h2><div class="desks">${act.map(card).join("")}</div>` : ""}
      ${idle.length ? `<h2 class="group">Bench (${idle.length})</h2>${showIdle ? `<div class="desks">${idle.map(card).join("")}</div>` : `<button class="chip" data-showall="1">Show all ${idle.length}</button>`}` : ""}`;
  }
  function agentView() {
    const f = byId[S.firm], a = f.agents.find(x => x.id === S.agent), k = f.id + "/" + a.id, st = S.state[k];
    return `<div class="crumbs"><button data-back="b">The building</button> / <button data-back="f">${esc(f.name)}</button> / ${esc(a.name)}</div>
    <div class="agentview" style="--a:${f.accent}"><div class="from">${pawn(f, a.name, st === "idle" ? "idle" : "working")}<span class="${st === "asking" ? "state-ask" : st === "working" ? "state-work" : ""}">${st === "asking" ? "Asking you" : st === "working" ? "Working" : "On the bench"}</span></div>
      <h3>${esc(a.name)}</h3><p class="sub">${esc(S.task[k] || "No task right now.")}</p>
      <div class="log"><div><time>${clock()}</time>Read the mandate and the fact ledger</div><div><time>${clock()}</time>Searched 4 sources</div><div><time>${clock()}</time>Wrote 2 pages of draft, kept private from other seats</div></div></div>`;
  }

  /* FLOOR */
  function floor() { return `${header("The floor", "Watch the firms at work. Tap a room, then tap anyone.")}<div id="floorhost"></div>`; }
  function mountFloor() {
    Floor.mount($("#floorhost"), {
      firms: FIRMS, byId, convened: () => S.convened,
      state: (f, a) => S.state[f + "/" + a], task: (f, a) => S.task[f + "/" + a],
      goNeeds: () => { S.tab = "needs"; render(); },
      openAgent: (f, a) => { S.tab = "office"; S.firm = f; S.agent = a; render(); },
    });
  }

  /* BOARD */
  function board() {
    const cols = [["wait", "Waiting"], ["work", "Working"], ["need", "Needs you"], ["done", "Done"]];
    return `${header("Board", "Every demand, from waiting to done.")}<div class="board">${cols.map(([k, n]) => {
      const l = jobs.filter(j => j.col === k);
      return `<section class="col"><h2><span>${n}</span><span>${l.length}</span></h2><div class="list">${l.map(j => { const f = fl(j.f); return `<button class="job" data-job="${j.id}" style="--a:${f.accent === "#FFFFFF" ? "#16181D" : f.accent}"><b>${esc(j.t)}</b><div class="meta"><i></i>${esc(f.name)}</div>${k === "work" ? `<div class="bar"><span style="transform:scaleX(${j.p})"></span></div>` : ""}</button>`; }).join("")}</div></section>`;
    }).join("")}</div>`;
  }

  /* NEEDS YOU */
  function needs() {
    if (!cards.length) return `<div class="empty"><h1>All clear</h1><p>Nobody is waiting on you. The teams carry on.</p></div>`;
    const c = cards[0], f = fl(c.firm), many = c.kind === "many";
    const nm = c.firm === "plenary" ? "Plenary Chair" : c.agent;
    return `<div class="stage"><div class="counter"><span>${1} of ${cards.length}</span><span class="pips">${cards.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</span></div>
    <article class="qcard" id="qcard" style="--a:${f.accent === "#FFFFFF" ? "#16181D" : f.accent}">
      <div class="from">${pawn({ accent: f.accent === "#FFFFFF" ? "#16181D" : f.accent }, nm)}<span><b>${esc(nm)}</b> · ${esc(f.name)}</span></div>
      <h1 class="q">${esc(c.q)}</h1>
      <div class="opts" role="group">${c.opts.map((o, i) => `<button class="opt" data-opt="${i}" aria-pressed="${S.sel.has(i)}"><span class="k">${many ? (S.sel.has(i) ? "✓" : "") : i + 1}</span><span><b>${esc(o[0])}${o[2] && !many ? '<span class="rec">Recommended</span>' : ""}${o[2] && many ? '<span class="rec">Suggested</span>' : ""}</b><span class="d">${esc(o[1])}</span></span></button>`).join("")}</div>
      <div class="free"><textarea id="free" rows="1" placeholder="Or tell me something else…" aria-label="Your own answer"></textarea><button class="send" id="send" disabled>${many ? "Send" : "Send"}</button></div>
      <details class="why"><summary>Why I'm asking</summary><p>${esc(c.why)}</p></details>
      <p class="default">${esc(c.def)}</p>
      <div class="actions"><button class="ghost" id="later">Later</button><button class="ghost" id="decide">Decide for me</button></div>
    </article></div>`;
  }
  function answer(text, how) {
    const c = cards[0]; if (!c) return;
    const el = $("#qcard"); if (el) el.classList.add("out");
    setTimeout(() => {
      cards.shift(); S.sel.clear();
      const j = jobs.find(x => x.id === c.job); if (j) { j.col = "work"; j.p = Math.max(j.p, .4); }
      if (c.firm === "plenary") { c.opts.forEach((o, i) => { }); }
      Object.keys(S.state).forEach(k => { if (S.state[k] === "asking" && k.startsWith(c.firm + "/")) { S.state[k] = "working"; S.task[k] = "Carrying on with your answer"; } });
      say(c.firm, fl(c.firm).name, how === "decide" ? "Used the recommended option and logged it" : `Got your answer: ${text.length > 48 ? text.slice(0, 48) + "…" : text}`);
      toast(how === "decide" ? "Done. The recommended option was used and written in the diary." : "Sent. The team carries on.");
      render();
    }, 260);
  }

  /* NEW DEMAND */
  function newDemand() {
    const note = S.route === null ? "The front desk will pick the right firm, or call a Plenary if it needs several." : S.route === "plenary" ? "Plenary will convene the firms that fit and run it as one working group." : `Goes straight to ${esc(byId[S.route].name)}.`;
    return `<div class="form"><h1>What do you need?</h1><p class="sub" style="margin-bottom:20px">Write it like a note to a colleague. They'll ask if they need more.</p>
      <textarea class="big" id="demand" placeholder="For example: Should we acquire a Brazilian payments company at a 6x revenue multiple?"></textarea>
      <div class="drop">Drop files here or <label style="text-decoration:underline;cursor:pointer">choose files<input type="file" multiple hidden></label></div>
      <h2 style="margin-top:20px">Send to</h2>
      <div class="routes"><button class="chip" data-route="" aria-pressed="${S.route === null}">Let the front desk choose</button><button class="chip" data-route="plenary" aria-pressed="${S.route === "plenary"}">Several firms (Plenary)</button>${FIRMS.map(f => `<button class="chip" style="--a:${f.accent}" data-route="${f.id}" aria-pressed="${S.route === f.id}"><i></i>${esc(f.name)}</button>`).join("")}</div>
      <p class="route-note">${note}</p>
      <button class="submit" id="submit" disabled>Send demand</button></div>`;
  }

  /* ASIDE (desktop) */
  function renderAside(feedOnly) {
    const a = $("#aside");
    a.innerHTML = `${cards.length ? `<h2>Needs you · ${cards.length}</h2>${cards.slice(0, 2).map(c => `<button class="mini" data-goneeds="1"><b>${esc(c.q)}</b><small>${esc(fl(c.firm).name)}</small></button>`).join("")}<div style="height:22px"></div>` : ""}<h2>Live</h2><div class="feed">${feed.slice(0, 12).map(e => `<div class="ev"><span class="pawn" style="--a:${fl(e.fid).accent === "#FFFFFF" ? "#16181D" : fl(e.fid).accent}">${initials(e.who)}</span><div>${esc(e.text)}<time>${e.t} · ${esc(e.who)}</time></div></div>`).join("")}</div>`;
  }

  function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove("on"), 2600); }

  function render() {
    const m = $("#main");
    m.innerHTML = { office, floor, board, needs, new: newDemand }[S.tab]();
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.tab === S.tab));
    const b = $("#badge"); b.textContent = cards.length || ""; b.dataset.n = cards.length;
    renderAside();
    if (S.tab === "floor") mountFloor();
    if (S.tab === "needs") wireNeeds();
    if (S.tab === "new") wireNew();
  }
  function wireNeeds() {
    const c = cards[0]; if (!c) return;
    const free = $("#free"), send = $("#send"), many = c.kind === "many";
    const sync = () => { send.disabled = many ? !(S.sel.size || free.value.trim()) : !free.value.trim(); };
    free.addEventListener("input", () => { free.style.height = "auto"; free.style.height = free.scrollHeight + "px"; sync(); });
    free.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!send.disabled) send.click(); } });
    send.onclick = () => {
      const parts = [...S.sel].map(i => c.opts[i][0]); if (free.value.trim()) parts.push(free.value.trim());
      answer(parts.join(" + "), "typed");
    };
    document.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      const i = +b.dataset.opt;
      if (many) { S.sel.has(i) ? S.sel.delete(i) : S.sel.add(i); b.setAttribute("aria-pressed", S.sel.has(i)); b.querySelector(".k").textContent = S.sel.has(i) ? "✓" : ""; sync(); }
      else if (c.approve && i === 1) { free.focus(); free.placeholder = "What should change?"; }
      else answer(c.opts[i][0], "tap");
    });
    $("#decide").onclick = () => answer(c.opts.filter(o => o[2]).map(o => o[0]).join(" + "), "decide");
    $("#later").onclick = () => { if (cards.length > 1) { cards.push(cards.shift()); S.sel.clear(); toast("Moved to the end. The team works on other things."); render(); } else toast("It's the only card. It stays here until you answer."); };
    sync();
  }
  function wireNew() { wireNewSubmit(); }
  function wireNewSubmit() {
    const d = $("#demand"), s = $("#submit");
    d.oninput = () => s.disabled = !d.value.trim();
    document.querySelectorAll("[data-route]").forEach(b => b.onclick = () => { const v = b.dataset.route, keep = d.value; S.route = v || null; render(); $("#demand").value = keep; $("#submit").disabled = !keep.trim(); });
    s.onclick = () => {
      const t = d.value.trim(); if (!t) return;
      const id = S.route || (/acqui|invest|back|deal/i.test(t) ? "plenary" : "gtmn-cto");
      jobs.unshift({ id: Date.now(), t: t.length > 70 ? t.slice(0, 70) + "…" : t, f: id, col: "wait", p: 0 });
      say(id, "Front desk", `New demand routed to ${fl(id).name}`);
      S.route = null; S.tab = "board"; render(); toast(`Sent to ${fl(id).name}. You'll see it move on the board.`);
    };
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; if (S.tab === "office") { S.firm = null; S.agent = null; } render(); }
    else if (t.dataset.firm && S.tab === "office") { S.firm = t.dataset.firm; S.agent = null; S.showAll = false; render(); }
    else if (t.dataset.agent) { S.agent = t.dataset.agent; render(); }
    else if (t.dataset.back) { if (t.dataset.back === "b") S.firm = null; S.agent = null; render(); }
    else if (t.dataset.showall) { S.showAll = true; render(); }
    else if (t.dataset.goneeds) { S.tab = "needs"; render(); }
    else if (t.dataset.job) { const j = jobs.find(x => x.id == t.dataset.job); if (j.col === "need") { S.tab = "needs"; const i = cards.findIndex(c => c.job === j.id); if (i > 0) cards.unshift(...cards.splice(i, 1)); render(); } }
  });

  /* gentle live simulation */
  const lines = ["finished a section", "added 6 facts to the ledger", "is cross-checking a source", "started a new draft", "sent a note to the desk"];
  setInterval(() => {
    const f = FIRMS[Math.floor(Math.random() * FIRMS.length)], a = f.agents[Math.floor(Math.random() * f.agents.length)], k = f.id + "/" + a.id;
    if (S.state[k] === "asking") return;
    S.state[k] = S.state[k] === "idle" ? "working" : (Math.random() < .5 ? "idle" : "working");
    if (S.state[k] === "working") S.task[k] = "Drafting its section of the mandate";
    if (Math.random() < .6) say(f.id, f.name, `${a.name} ${lines[Math.floor(Math.random() * lines.length)]}`);
    jobs.forEach(j => { if (j.col === "work") j.p = Math.min(.95, j.p + .02); });
    if (S.tab === "office" || S.tab === "board") { const y = $("#main").scrollTop; render(); $("#main").scrollTop = y; }
  }, 4500);

  render();
})();
