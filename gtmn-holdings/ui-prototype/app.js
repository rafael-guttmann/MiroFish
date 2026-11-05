(function () {
  const FIRMS = window.FIRMS;
  FIRMS.forEach(f => f.agents.forEach(a => { if (a.name === a.name.toLowerCase()) a.name = a.name[0].toUpperCase() + a.name.slice(1); }));
  const byId = Object.fromEntries(FIRMS.map(f => [f.id, f]));
  const PLENARY = { id: "plenary", name: "Plenary boardroom", role: "Several firms, one mandate", accent: "#FFFFFF" };
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const initials = n => n.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let live = false, sig = "";
  const S = { tab: "office", firm: null, agent: null, showAll: false, route: null, picks: new Set(), work: null, workBy: "firm", wmode: false, wsel: new Set(), arch: false, open: new Set(), sel: new Set(), state: {}, task: {}, thread: {}, nds: null, pend: [], lib: "demand", fmtOpen: null, fmtSel: new Set(), newFmts: new Set(), granola: true, convened: ["gtmn-cto", "dani", "spc-deal-team"] };
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

  let ajobs = [];
  const jobOf = id => jobs.find(j => j.id === id) || ajobs.find(j => j.id === id);
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
    { id: 10, t: "Brand refresh for Orbit Labs", f: "marketing-house", col: "work", p: .5 },
    { id: 11, t: "Plan House: unit economics deep dive", f: "plan-house", col: "work", p: .8 },
  ];
  const fl = id => id === "plenary" ? PLENARY : byId[id];
  const FMT = { Excel: "xlsx", PowerPoint: "pptx", Word: "docx", PDF: "pdf", JPEG: "jpg", Markdown: "md" };
  const ag = (f, i) => byId[f].agents[i % byId[f].agents.length].name;
  let docs = [
    { id: "d1", job: 8, name: "Plenary plugin: technical review", type: "Memo", why: "Decides whether the Plenary plugin is safe to build on.", by: ag("gtmn-cto", 0), ver: 2, fmts: ["PDF"], st: "final", at: "2 Nov, 17:40" },
    { id: "d2", job: 9, name: "Credit portfolio review, Q3", type: "Report", why: "The ten-page review for the noteholders.", by: ag("zencredit-firm", 0), ver: 1, fmts: ["Word", "PDF"], st: "final", at: "30 Oct, 11:05" },
    { id: "d3", job: 9, name: "Q3 methodology walkthrough", type: "Report", why: "Shows how every number was calculated.", by: ag("zencredit-firm", 1), ver: 1, fmts: ["PDF"], st: "final", at: "30 Oct, 11:05" },
    { id: "d4", job: 3, name: "Revised indemnity clause", type: "Legal text", why: "Goes to the counterparty once you approve it.", by: ag("ogc-dg", 5), ver: 2, fmts: ["Word"], st: "draft", at: "4 Nov, 09:12" },
    { id: "d5", job: 11, name: "Unit economics model", type: "Model", why: "The numbers behind the go/no-go.", by: ag("plan-house", 3), ver: 1, fmts: [], st: "draft", at: "4 Nov, 14:20" },
    { id: "d6", job: 5, name: "Noteholder pack, Q4", type: "Report", why: "Quarterly update for noteholders.", by: ag("zencredit-firm", 2), ver: 1, fmts: [], st: "draft", at: "4 Nov, 13:02" },
    { id: "d7", job: 10, name: "Orbit Labs brand brief", type: "Deck", why: "The direction for the brand refresh.", by: ag("marketing-house", 0), ver: 1, fmts: [], st: "draft", at: "4 Nov, 12:30" },
  ];
  let stds = [
    { id: "s1", name: "GTMN master brand guide", kind: "File · PDF", scope: "All firms", at: "28 Oct", def: 1 },
    { id: "s2", name: "GTMN design system (Claude artifact)", kind: "Link", url: "https://claude.ai/artifact/LxJ9JP4ZDcVijZnq1V7Tr2", scope: "All firms", at: "Today" },
  ];
  const sysOpts = () => [...stds.map((s, i) => [s.name, s.kind + (s.def ? " · default" : ""), s.def ? 1 : 0]), ["Let the design skill decide", "No fixed system. The designer picks a fitting look for this piece."]];

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
  cards.push({ id: "c5", job: 11, firm: "plan-house", agent: ag("plan-house", 3), kind: "many", fmtDoc: "d5", q: "The unit economics model is ready. Which formats do you want?",
      opts: [["Excel", "The live model with formulas.", 1], ["PowerPoint", "A short deck with the key charts."], ["Word", "A written memo."], ["PDF", "A fixed copy to share.", 1], ["JPEG", "Charts as images."], ["Markdown", "Plain text for notes and code."]],
      why: "Each format is built for its purpose, so it is cheaper to ask now than to convert later.", def: "If you don't answer, I'll make Excel and PDF." });
  cards.push({ id: "c6", job: 10, firm: "marketing-house", agent: ag("marketing-house", 0), kind: "one", q: "Which design system should the Orbit Labs brand work follow?", opts: sysOpts(),
      why: "Every layout, colour and font will follow it. Changing it later means redoing the design.", def: "If you don't answer, I'll use the default design system." });
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

  /* WORK */
  const STG = {
    def: ["Brief", "Research", "Draft", "Review", "Delivery"],
    "plan-house": ["Intake", "Research", "Assumption register", "Audit", "Decision memo"],
    "ogc-dg": ["Intake", "Analysis", "Drafting", "Partner review", "Your approval"],
    "gtmn-cto": ["Brief", "Blind reads", "Synthesis", "Build pack"],
    "marketing-house": ["Insight", "Strategy", "Creative", "Identity", "Delivery pack"],
    "zencredit-firm": ["Data check", "Modelling", "Draft", "Review", "Publish"],
    plenary: ["Mandate", "Fact ledger", "Blind positions", "Cross-exam", "Decision memo"],
  };
  const DOES = ["Read the brief and set the scope", "Pulled sources and logged the key facts", "Wrote a first pass of its section", "Checked the numbers against the ledger", "Flagged two risks for the partner", "Rewrote the weakest part after review"];
  const WORKERS = j => j.f === "plenary" ? S.convened.map(id => ({ name: byId[id].name, f: byId[id] })) : byId[j.f].agents.map(a => ({ name: a.name, f: byId[j.f], id: a.id }));
  function detail(j) {
    const names = STG[j.f] || STG.def, n = names.length, pool = WORKERS(j), f = fl(j.f);
    const cur = j.p >= 1 ? n : Math.min(n - 1, Math.floor(j.p * n));
    const stages = names.map((nm, i) => {
      const st = i < cur ? "done" : i === cur ? (j.col === "need" ? "ask" : j.col === "wait" || j.col === "stop" ? "next" : "now") : "next";
      const who = [0, 1].map(k => pool[(j.id * 3 + i * 2 + k) % pool.length]);
      const steps = st === "next" ? [] : who.map((w, k) => ({ w, what: DOES[(i * 2 + k + j.id) % DOES.length], t: st === "done" ? `${9 + i}:${k ? "40" : "05"}` : "now" }));
      return { nm, st, who, steps };
    });
    const tally = {}; stages.forEach(s => s.steps.forEach(x => tally[x.w.name] = (tally[x.w.name] || 0) + 1));
    const people = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { stages, cur, people, f, now: stages[cur], next: stages.filter(s => s.st === "next") };
  }
  const STL = { wait: "Waiting to start", work: "Working", need: "Needs you", done: "Done", stop: "Stopped" };
  const LIVE = j => ["wait", "work", "need"].includes(j.col);
  const jc = j => { const r = window.__byJob && window.__byJob[j.id]; return r ? "$" + (r >= 100 ? r.toFixed(0) : r.toFixed(2)) : ""; };
  const jcost = j => jc(j) ? `<span class="jc" title="Estimated spend on this demand">${jc(j)}</span>` : "";
  function work() {
    if (S.work) { const jj = jobOf(S.work); if (jj) return workDetail(jj); S.work = null; }
    const by = S.workBy, list = S.arch ? ajobs : jobs, c = k => list.filter(j => j.col === k).length;
    const row = j => { const d = detail(j), f = d.f, ac = f.accent === "#FFFFFF" ? "#16181D" : f.accent, on = S.wsel.has(j.id);
      return `<div class="wr${on ? " on" : ""}">${S.wmode ? `<button class="wck" data-wpick="${j.id}" aria-pressed="${on}" aria-label="Select ${esc(j.t)}">${on ? "✓" : ""}</button>` : ""}<button class="wrow" data-work="${j.id}" style="--a:${ac}"><span class="wt"><b>${esc(j.t)}</b><small>${by === "firm" ? "" : esc(f.name) + " · "}${j.col === "done" ? "Finished" : j.col === "stop" ? "Stopped by you" : j.col === "wait" ? "Queued" : esc(d.now.nm)}</small></span>
      <span class="seg" aria-hidden="true">${d.stages.map(s => `<i class="${s.st}"></i>`).join("")}</span><span class="pc">${Math.round(j.p * 100)}%</span>${jcost(j)}<span class="st ${j.col}">${STL[j.col]}</span></button>${!S.wmode && live && LIVE(j) ? `<button class="wstop" data-wstop="${j.id}" aria-label="Stop ${esc(j.t)}">Stop</button>` : ""}</div>`; };
    const groups = by === "firm" ? [...FIRMS.map(x => [x, list.filter(j => j.f === x.id)]), [PLENARY, list.filter(j => j.f === "plenary")]].filter(g => g[1].length).sort((a, b) => b[1].length - a[1].length || 0)
      : ["need", "work", "wait", "stop", "done"].map(k => [{ name: STL[k], accent: "#16181D" }, list.filter(j => j.col === k)]).filter(g => g[1].length);
    return `${header("Work", "What every firm is doing. Tap one to go deeper.")}
    <div class="wsum"><div><b>${c("work")}</b><small>working</small></div><div><b class="n">${c("need")}</b><small>need you</small></div><div><b>${c("wait")}</b><small>waiting</small></div><div><b>${c("done")}</b><small>done</small></div></div>
    <div class="routes" style="margin-bottom:14px"><button class="chip" data-wby="firm" aria-pressed="${by === "firm"}">By firm</button><button class="chip" data-wby="status" aria-pressed="${by === "status"}">By status</button>${live ? `<span class="wsp"></span><button class="chip" data-warch="1" aria-pressed="${S.arch}">Archived · ${ajobs.length}</button><button class="chip" data-wmode="1" aria-pressed="${S.wmode}">${S.wmode ? "Cancel" : "Select"}</button>` : ""}</div>
    ${S.wmode ? `<div class="wbar" role="toolbar"><b>${S.wsel.size} selected</b><button data-wall="1">${S.wsel.size === list.length ? "Clear" : "Select all"}</button><span class="wsp"></span><button data-wact="stop" ${[...S.wsel].some(i => { const q = jobOf(i); return q && LIVE(q); }) ? "" : "disabled"}>Stop</button><button data-wact="${S.arch ? "unarchive" : "archive"}" ${S.wsel.size ? "" : "disabled"}>${S.arch ? "Unarchive" : "Archive"}</button><button class="danger" data-wact="delete" ${S.wsel.size ? "" : "disabled"}>Delete</button></div>` : ""}
    ${S.arch && !list.length ? `<p class="sub">Nothing archived.</p>` : ""}${groups.map(([g, l]) => `<section class="wgroup"><h2><i style="background:${g.accent === "#FFFFFF" ? "#16181D" : g.accent}"></i>${esc(g.name)} · ${l.length}</h2>${l.map(row).join("")}</section>`).join("")}`;
  }
  function ring(p, ac) { const r = 42, c = 2 * Math.PI * r; return `<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${Math.round(p * 100)} percent complete"><circle cx="50" cy="50" r="${r}" fill="none" stroke="#E3DFD6" stroke-width="10"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${ac}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 50 50)"/><text x="50" y="55" text-anchor="middle" font-size="22" font-weight="700" fill="#16181D">${Math.round(p * 100)}%</text></svg>`; }
  function workDetail(j) {
    const d = detail(j), f = d.f, ac = f.accent === "#FFFFFF" ? "#16181D" : f.accent, max = Math.max(1, ...d.people.map(p => p[1]));
    const who = d.now ? d.now.who : [];
    const card = cards.find(c => c.job === j.id);
    return `<div class="crumbs"><button data-wback="1">Work</button> / ${esc(j.t)}</div>
    <div class="wdet" style="--a:${ac}">
      <div class="whead"><div><span class="st ${j.col}">${STL[j.col]}</span>${live && LIVE(j) ? `<button class="wstop" data-wstop="${j.id}">Stop work</button>` : ""}<h1>${esc(j.t)}</h1><p class="sub">${esc(f.name)}${j.col !== "done" && j.col !== "wait" && j.col !== "stop" ? " · now: " + esc(d.now.nm) : ""}${jcost(j) ? ` · spent <b>${jc(j)}</b> so far` : ""}</p></div>${ring(j.p, ac)}</div>
      ${card ? `<button class="needbar" data-goneeds="1"><b>${esc(card.agent)} is waiting for you</b><span>${esc(card.q)}</span><em>Answer →</em></button>` : ""}
      <h2>Progress</h2>
      <ol class="steps">${d.stages.map((s, i) => `<li class="${s.st}"><i>${s.st === "done" ? "✓" : i + 1}</i><span>${esc(s.nm)}</span></li>`).join("")}</ol>
      <div class="wcols">
        <div><h2>Who is working</h2>${j.col === "done" ? `<p class="sub">Everyone has finished.</p>` : j.col === "stop" ? `<p class="sub">You stopped this work.</p>` : j.col === "wait" ? `<p class="sub">Nobody yet. It starts when a desk is free.</p>` : who.map(w => `<button class="desk" ${w.id ? `data-openagent="${w.f.id}/${w.id}"` : ""}>${pawn(w.f, w.name, "working")}<div><b>${esc(w.name)}</b><small class="state-work">${esc(d.now.nm)}</small></div></button>`).join("")}</div>
        <div><h2>Who did the most</h2>${d.people.length ? d.people.map(([n, v]) => `<div class="hb"><span>${esc(n)}</span><div><i style="width:${v / max * 100}%"></i></div><b>${v}</b></div>`).join("") : `<p class="sub">Nothing yet.</p>`}</div>
      </div>
      <h2>Step by step</h2>
      <div class="tl">${d.stages.map((s, i) => `<div class="tstage ${s.st}"><button class="th" data-stage="${j.id}:${i}" aria-expanded="${S.open.has(j.id + ":" + i)}"><i></i><b>${esc(s.nm)}</b><small>${s.st === "done" ? "Done" : s.st === "now" ? "In progress" : s.st === "ask" ? "Waiting for you" : "Next"}</small></button>
        ${S.open.has(j.id + ":" + i) ? `<div class="tb">${s.steps.length ? s.steps.map(x => `<div class="ts">${pawn(f, x.w.name, "")}<div><b>${esc(x.w.name)}</b> <small>${x.t}</small><p>${esc(x.what)}</p></div></div>`).join("") : `<p class="sub">Not started. ${esc(s.who.map(w => w.name).join(" and "))} will take it.</p>`}</div>` : ""}</div>`).join("")}</div>
      <h2>Deliverables</h2><div id="dlv">${docsFor(j.id)}</div>
      ${d.next.length && j.col !== "done" ? `<h2>What comes next</h2><ul class="nx">${d.next.slice(0, 3).map((s, i) => `<li><b>${esc(s.nm)}</b><small>${esc(s.who[0].name)}${i === 0 && j.col !== "wait" ? " · after the current step" : ""}</small></li>`).join("")}</ul>` : ""}
    </div>
    ${steerBox(j)}`;
  }
  const thr = j => S.thread[j.id] || (S.thread[j.id] = []);
  const msgHtml = (m, j) => `<div class="msg ${m.me ? "me" : ""}">${m.me ? "" : pawn(fl(j.f), fl(j.f).name, "")}<div><small>${m.me ? "You" : esc(fl(j.f).name) + " desk"} · ${m.t}</small><p>${esc(m.text)}${m.typing ? '<span class="dots"><i></i><i></i><i></i></span>' : ""}</p>${(m.files || []).map(x => `<span class="fchip">${esc(x)}</span>`).join("")}</div></div>`;
  const EMPTY = `<div class="st-empty"><b>Nothing sent yet</b><span>Change the scope, add a request, or attach a file or design system. The desk reads it and adjusts. Steps already finished stay as they are.</span></div>`;
  function steerBox(j) {
    const t = thr(j), sug = ["Use our brand guide", "Make it shorter", "Add a risk lens", "Also give me Excel"];
    const empty = EMPTY;
    return `<section class="steer" aria-label="Steer this work"><div class="st-h"><h2>Steer this work</h2><span>Send a change at any time</span></div>
      <div id="thread" class="thread">${t.length ? t.map(m => msgHtml(m, j)).join("") : empty}</div>
      <div class="comp2"><div class="sug" role="group" aria-label="Quick changes">${sug.map(s => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <textarea id="snote" rows="2" aria-label="Message to the team" placeholder="What should change?"></textarea>
        <div id="pend" class="pend"></div>
        <div class="comp-bar"><label class="att2"><svg viewBox="0 0 24 24"><path d="M20 11l-8 8a5 5 0 01-7-7l8-8a3.5 3.5 0 015 5l-8 8a2 2 0 01-3-3l7-7"/></svg>Attach file or design system<input type="file" id="sfile" multiple hidden></label><button class="send" id="ssend" disabled>Send</button></div></div></section>`;
  }
  const tfmt = c => new Date(c * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function syncThread(j) {
    if (!(live && j && j.live)) return;
    getj("/api/jobs/" + j.id + "/thread").then(l => {
      const m = l.map(x => ({ me: x.role === "me" ? 1 : 0, text: x.text, t: tfmt(x.created) }));
      if (l.length && l[l.length - 1].role === "me") m.push({ typing: 1, text: "", t: clock() });
      const k = JSON.stringify(m); if (S.thr_sig && S.thr_sig[j.id] === k) return;
      (S.thr_sig = S.thr_sig || {})[j.id] = k; S.thread[j.id] = m; if (S.tab === "board" && S.work === j.id) drawThread(j);
    }).catch(() => {});
  }
  function steer(j, text, files) {
    if (live && j.live && text) {
      post("/api/jobs/" + j.id + "/steer", { text }).then(() => { syncThread(j); pull(); });
      const t = thr(j); t.push({ me: 1, text, t: clock() }, { typing: 1, text: "", t: clock() }); drawThread(j);
      say(j.f, fl(j.f).name, "Change request received: " + text.slice(0, 48));
      return;
    }
    const t = thr(j), now = clock();
    t.push({ me: 1, text: text || "(file attached)", files, t: now });
    const r = { text: "", typing: 1, t: now }; t.push(r); drawThread(j);
    const d = detail(j), nowSt = d.stages.find(s => s.st === "now") || d.stages.find(s => s.st !== "done");
    let reply = "";
    if (files.length) { files.forEach(n => stds.unshift({ id: "s" + Date.now() + n, name: n, kind: "File", scope: "Added from: " + j.t, at: "Today" })); reply += `Saved ${files.join(", ")} to Design systems. I'll apply it from the next step. Work already delivered stays as it is unless you ask. `; }
    const m = (text || "").match(/excel|power ?point|ppt|word|pdf|jpe?g/gi);
    if (m) { const names = [...new Set(m.map(x => /excel/i.test(x) ? "Excel" : /pow|ppt/i.test(x) ? "PowerPoint" : /word/i.test(x) ? "Word" : /pdf/i.test(x) ? "PDF" : /markdown|\bmd\b/i.test(x) ? "Markdown" : "JPEG"))]; docs.filter(x => x.job === j.id).forEach(x => names.forEach(n => { if (!x.fmts.includes(n)) x.fmts.push(n); })); reply += `Added ${names.join(", ")} to this demand's deliverables. `; }
    if (/stop|pause|hold/i.test(text || "")) reply += "Paused at the end of the current step. Say \"go on\" when ready.";
    else if (text) { if (j.col === "done") { j.col = "work"; j.p = .85; reply += "Reopened. I'll revise the deliverable and keep the earlier version. "; } reply += nowSt ? `I'll adjust from "${nowSt.nm}". Steps already finished stay.` : "I'll pick it up in the next step."; }
    say(j.f, fl(j.f).name, "Change request received: " + ((text || files[0] || "").slice(0, 48)));
    setTimeout(() => { r.typing = 0; let i = 0; const iv = setInterval(() => { i += 3; r.text = reply.slice(0, i); drawThread(j); if (i >= reply.length) { clearInterval(iv); const dv = $("#dlv"); if (dv) dv.innerHTML = docsFor(j.id); } }, 22); }, 900);
  }
  function drawThread(j) { const el = $("#thread"); if (!el) return; const t = thr(j); el.innerHTML = t.length ? t.map(m => msgHtml(m, j)).join("") : EMPTY; el.scrollTop = el.scrollHeight; }
  function wireWork() {
    const j = jobs.find(x => x.id === S.work); if (!j) return;
    syncThread(j);
    const n = $("#snote"), s = $("#ssend"), f = $("#sfile"), p = $("#pend");
    const upd = () => { s.disabled = !(n.value.trim() || S.pend.length); p.innerHTML = S.pend.map((x, i) => `<span class="fchip">${esc(x)} <button data-unpend="${i}" aria-label="Remove">×</button></span>`).join(""); };
    n.oninput = () => { n.style.height = "auto"; n.style.height = Math.max(64, Math.min(140, n.scrollHeight)) + "px"; upd(); };
    n.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!s.disabled) s.click(); } };
    f.onchange = () => { S.pend.push(...[...f.files].map(x => x.name)); upd(); };
    s.onclick = () => { steer(j, n.value.trim(), S.pend.splice(0)); n.value = ""; n.style.height = ""; upd(); };
    document.querySelectorAll("[data-sug]").forEach(b => b.onclick = () => { n.value = b.dataset.sug; n.oninput(); n.focus(); });
    p.onclick = e => { const u = e.target.closest("[data-unpend]"); if (u) { S.pend.splice(+u.dataset.unpend, 1); upd(); } };
    upd(); drawThread(j);
  }

  /* LIBRARY */
  const dl = (d, fmt) => { if (live && /^d\d+$/.test(d.id)) { const a = document.createElement("a"); a.href = `/api/docs/${d.id.slice(1)}/file?format=${fmt}`; document.body.appendChild(a); a.click(); a.remove(); return toast("Downloading " + fmt); } const ext = FMT[fmt], nm = `${d.name.replace(/[^\w]+/g, "-")}-v${d.ver}.${ext}`; const b = new Blob([`GTMN Holdings sample file\n${d.name}\nVersion ${d.ver}\nFormat: ${fmt}\nThis is a prototype placeholder.`], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nm; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); toast("Downloading " + nm); };
  const fmtPicker = d => `<div class="fpick"><b>Which formats?</b><div class="fchips">${Object.keys(FMT).map(k => `<button class="chip" data-fmt="${k}" aria-pressed="${S.fmtSel.has(k)}">${k}</button>`).join("")}</div><button class="submit sm" data-fmtok="${d.id}" ${S.fmtSel.size ? "" : "disabled"}>${d.fmts.length ? "Add formats" : "Confirm"}</button></div>`;
  function docRow(d) {
    const j = jobs.find(x => x.id === d.job), f = fl(j.f), ac = f.accent === "#FFFFFF" ? "#16181D" : f.accent;
    return `<div class="doc" style="--a:${ac}"><div class="dico">${esc(d.type.slice(0, 1))}</div><div class="dmain"><b>${esc(d.name)} <em>v${d.ver}${d.st === "draft" ? " · draft" : ""}</em></b>
      <small>${esc(d.type)} · from ${esc(f.name)}, ${esc(d.by)} · ${d.at}</small><p>${esc(d.why)}</p>
      <div class="dfm"><button class="chip pvb" data-pv="${d.id}">Preview</button>${d.fmts.length ? d.fmts.map(k => `<button class="chip dlb" data-dl="${d.id}:${k}">↓ ${k}</button>`).join("") : `<span class="ask">Format not chosen yet</span>`}<button class="chip ghostc" data-fmtopen="${d.id}">${d.fmts.length ? "+ Another format" : "Choose formats"}</button></div>
      ${S.fmtOpen === d.id ? fmtPicker(d) : ""}
      <small class="bk">✓ Backed up · vault + second copy · ${d.at}</small></div></div>`;
  }
  function docsFor(jid) {
    const l = docs.filter(d => d.job === jid);
    return l.length ? l.map(docRow).join("") : `<p class="sub">Nothing produced yet. Files appear here and in the Library as they are made.</p>`;
  }
  let bk = null, bkAsked = 0;
  const bkLoad = () => live && getj("/api/backup").then(x => { bk = x; if (S.tab === "lib") render(); }).catch(() => {});
  function library() {
    if (S.lib === "design") return designRepo();
    const by = S.lib, groups = new Map();
    docs.forEach(d => { const j = jobs.find(x => x.id === d.job), k = by === "demand" ? j.id : j.f; (groups.get(k) || groups.set(k, []).get(k)).push(d); });
    return `<div class="libwrap"><h1>Library</h1><p class="sub">Everything the firms produce, saved in one place, backed up, and sorted by the demand it came from.</p>
      <div class="bkbar"><b>${bk ? (bk.last ? "✓ Backed up" : "No backup yet") : "✓ All " + docs.length + " files backed up"}</b><span>${bk ? (bk.last ? "Last backup " + new Date(bk.last.at * 1000).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + ". " : "") + "Saved in the vault and backed up every night at 02:00" + (bk.second ? ", in " + bk.locations.length + " places." : ". Tap Backup copy to keep one off this server.") : "Saved to the vault and copied every night to a second location. Last backup 14:02."}</span>${bk ? '<button class="chip" data-bknow="1">Back up now</button><button class="chip" data-bkdl="1">↓ Backup copy</button>' : ""}<button class="chip" data-dlall="1">↓ Download everything</button></div>
      <div class="wtoggle"><button class="chip" data-libby="demand" aria-pressed="${by === "demand"}">By demand</button><button class="chip" data-libby="firm" aria-pressed="${by === "firm"}">By firm</button><button class="chip" data-libby="design" aria-pressed="${by === "design"}">Design systems</button></div>
      ${[...groups].map(([k, l]) => { const j = by === "demand" ? jobs.find(x => x.id === k) : null, f = fl(by === "demand" ? j.f : k), ac = f.accent === "#FFFFFF" ? "#16181D" : f.accent;
        return `<section class="lgrp" style="--a:${ac}"><div class="lh"><h2>${esc(by === "demand" ? j.t : f.name)}</h2><small>${by === "demand" ? esc(f.name) + " · " + STL[j.col] : l.length + " files"}</small></div>${l.map(docRow).join("")}</section>`; }).join("")}
</div>`;
  }

  function designRepo() {
    return `<div class="libwrap"><h1>Library</h1><p class="sub">A separate shelf for design systems. Before design work starts, the firm asks which one to use, or lets the design skill decide.</p>
      <div class="wtoggle"><button class="chip" data-libby="demand" aria-pressed="false">By demand</button><button class="chip" data-libby="firm" aria-pressed="false">By firm</button><button class="chip" data-libby="design" aria-pressed="true">Design systems</button></div>
      ${stds.map(s => `<div class="doc std"><div class="dico">${s.url ? "↗" : "▤"}</div><div class="dmain"><b>${esc(s.name)}${s.def ? " <em>default</em>" : ""}</b><small>${esc(s.kind)} · ${esc(s.scope)} · added ${s.at}</small>${s.url ? `<small><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a></small>` : ""}<div class="dfm">${s.def ? "" : `<button class="chip" data-sdef="${s.id}">Make default</button>`}</div></div></div>`).join("")}
      <h2 style="margin-top:22px">Add a design system</h2>
      <div class="comp" style="position:static"><input id="slink" placeholder="Paste a link" style="flex:1;border:0;outline:0;font:inherit;padding:8px 6px"><button class="send" id="slinkgo">Add link</button></div>
      <label class="drop">Or drop files here, <u>choose a file</u><input type="file" id="stdfile" multiple hidden></label>
      <p class="route-note">Backed up with everything else. Links are saved as references; upload the file too if the link may expire.</p></div>`;
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
    if (live && c.srv) post("/api/cards/" + c.srv + "/answer", { answer: text }).then(() => setTimeout(pull, 400));
    const el = $("#qcard"); if (el) el.classList.add("out");
    setTimeout(() => {
      cards.shift(); S.sel.clear();
      if (c.fmtDoc) { const d = docs.find(x => x.id === c.fmtDoc); const ks = Object.keys(FMT).filter(k => text.includes(k)); if (d) d.fmts = ks.length ? ks : ["Excel", "PDF"]; }
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
    const note = S.route === null ? "The front desk will pick the right firm, or call a Plenary if it needs several." : S.picks.size > 1 ? `Plenary will convene exactly these ${S.picks.size} firms: ${[...S.picks].map(i => esc(byId[i].name)).join(", ")}.` : S.route === "plenary" ? "Plenary will convene the firms that fit and run it as one working group." : `Goes straight to ${esc(byId[S.route].name)}.`;
    return `<div class="form"><h1>What do you need?</h1><p class="sub" style="margin-bottom:20px">Write it like a note to a colleague. They'll ask if they need more.</p>
      <textarea class="big" id="demand" placeholder="For example: Should we acquire a Brazilian payments company at a 6x revenue multiple?"></textarea>
      <div class="drop">Drop files here or <label style="text-decoration:underline;cursor:pointer">choose files<input type="file" multiple hidden></label></div>
      <h2 style="margin-top:20px">Deliverable format</h2><div class="routes"><button class="chip" data-nfmt="" aria-pressed="${!S.newFmts.size}">Ask me when it's ready</button>${Object.keys(FMT).map(k => `<button class="chip" data-nfmt="${k}" aria-pressed="${S.newFmts.has(k)}">${k}</button>`).join("")}</div>
      <h2 style="margin-top:20px">Your meeting notes</h2><div class="routes"><button class="chip" data-gr="1" aria-pressed="${S.granola}">Agents may search my Granola meetings</button><button class="chip" data-gr="0" aria-pressed="${!S.granola}">Keep meetings out of this one</button></div>
      <h2 style="margin-top:20px">Design system</h2><div class="routes"><button class="chip" data-nds="" aria-pressed="${S.nds === null}">Ask me when design starts</button><button class="chip" data-nds="skill" aria-pressed="${S.nds === "skill"}">Let the design skill decide</button>${stds.map(s => `<button class="chip" data-nds="${s.id}" aria-pressed="${S.nds === s.id}">${esc(s.name)}</button>`).join("")}</div>
      <h2 style="margin-top:20px">Send to <small style="font-weight:400;text-transform:none;letter-spacing:0;opacity:.7">· tap one firm, or as many as you want to convene them in a Plenary</small></h2>
      <div class="routes"><button class="chip" data-route="" aria-pressed="${S.route === null}">Let the front desk choose</button><button class="chip" data-route="plenary" aria-pressed="${S.route === "plenary"}">Several firms (Plenary)</button>${FIRMS.map(f => `<button class="chip" style="--a:${f.accent}" data-route="${f.id}" aria-pressed="${S.picks.has(f.id)}"><i></i>${esc(f.name)}</button>`).join("")}</div>
      <p class="route-note">${note}</p>
      <button class="submit" id="submit" disabled>Send demand</button></div>`;
  }

  /* ASIDE (desktop) */
  function renderAside(feedOnly) {
    const a = $("#aside");
    a.innerHTML = `${cards.length ? `<h2>Needs you · ${cards.length}</h2>${cards.slice(0, 2).map(c => `<button class="mini" data-goneeds="1"><b>${esc(c.q)}</b><small>${esc(fl(c.firm).name)}</small></button>`).join("")}<div style="height:22px"></div>` : ""}<h2>${live ? "Live" : "Live · demo data"}</h2><div class="feed">${feed.slice(0, 12).map(e => `<div class="ev"><span class="pawn" style="--a:${fl(e.fid).accent === "#FFFFFF" ? "#16181D" : fl(e.fid).accent}">${initials(e.who)}</span><div>${esc(e.text)}<time>${e.t} · ${esc(e.who)}</time></div></div>`).join("")}</div>`;
  }

  function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove("on"), 2600); }

  /* CHARTERS */
  const CH = window.CHARTERS || [];
  const rev = (() => { try { return JSON.parse(localStorage.getItem("chRev") || "{}"); } catch (e) { return {}; } })();
  S.chOpen = null;
  const chSt = c => (rev[c.id] || {}).decision || "proposed";
  const agName = id => { for (const f of FIRMS) { const a = f.agents.find(x => x.id === id); if (a) return a.name; } return id; };
  fetch("/api/charters").then(r => r.ok ? r.json() : []).then(l => { l.forEach(x => rev[x.charter] = x); if (l.length) { localStorage.setItem("chRev", JSON.stringify(rev)); if (S.tab === "charters") render(); updCb(); } }).catch(() => {});
  const EDITS = {};
  function loadEdits() { fetch("/api/charter-edits").then(r => r.ok ? r.json() : {}).then(e => { Object.keys(e).forEach(id => { EDITS[id] = e[id]; const c = CH.find(x => x.id === id); if (c) { c.summary = e[id].summary ?? c.summary; c.notes = e[id].notes ?? c.notes; c.owns = e[id].owns ?? c.owns; } }); if (S.tab === "charters") render(); }).catch(() => {}); }
  loadEdits();
  function applyChanges() {
    S.applying = true; render();
    fetch("/api/charters/apply-changes", { method: "POST", body: "{}" }).then(r => r.json()).then(j => {
      S.applying = false;
      if (j.error) { toast("Could not apply: " + j.error); return render(); }
      const ok = (j.results || []).filter(x => !x.error).length, bad = (j.results || []).length - ok;
      toast(ok ? `Updated ${ok} charter${ok > 1 ? "s" : ""}. Review and approve again.` : "Nothing was updated." + (bad ? " Try again." : ""));
      fetch("/api/charters").then(r => r.json()).then(l => { Object.keys(rev).forEach(k => delete rev[k]); l.forEach(x => rev[x.charter] = x); localStorage.setItem("chRev", JSON.stringify(rev)); updCb(); loadEdits(); render(); });
    }).catch(() => { S.applying = false; toast("Could not reach the server."); render(); });
  }
  function updCb() { const n = CH.filter(c => chSt(c) === "proposed").length, b = document.getElementById("cbadge"); if (b) { b.textContent = n || ""; b.dataset.n = n; } }
  function charters() {
    const n = CH.filter(c => chSt(c) === "proposed").length, nc = CH.filter(c => chSt(c) === "changes" && ((rev[c.id] || {}).note || "").trim()).length;
    return `<h1>Charters</h1><p class="lede" style="color:var(--ink2);font-size:14px;line-height:1.5;margin:6px 0 14px">A charter is a firm's rulebook: who sits on it, which gates it must pass, who can veto, and what it delivers. A firm only takes demands once you approve its charter. ${n ? `${n} of ${CH.length} waiting for you.` : "All reviewed."}</p>${nc ? `<div class="ch-apply"><div><b>${nc} charter${nc > 1 ? "s have" : " has"} requested changes</b><small>The charter desk reads your notes and updates the wording. You then approve again.</small></div><button class="submit" data-applych="1" ${S.applying ? "disabled" : ""}>${S.applying ? "Updating…" : "Apply my changes"}</button></div>` : ""}` + CH.map(c => {
      const s = chSt(c), open = S.chOpen === c.id, r = rev[c.id] || {};
      const lab = { proposed: "Waiting for you", approved: "Approved", changes: "Changes requested" }[s];
      const body = open ? `<div class="ch-b"><h4>What it is</h4><p>${esc(c.summary)}</p>
        <h4>Gates it must pass</h4><ul>${c.gates.map(g => `<li>${esc(g)}</li>`).join("") || "<li>None listed</li>"}</ul>
        <h4>Senior panel (reviews and signs off)</h4><p>${c.panel.map(agName).map(esc).join(", ") || "None"}${c.signoff ? ` · final sign-off: ${esc(agName(c.signoff))}` : ""}</p>
        <h4>Can veto</h4><ul>${c.veto.map(v => `<li>${esc(v.ground || v)}</li>`).join("") || "<li>No vetoes</li>"}</ul>
        <h4>Delivers</h4><p>${c.outputs.map(esc).join(", ")}</p>
        ${c.notes ? `<h4>Notes</h4><p>${esc(c.notes)}</p>` : ""}
        ${EDITS[c.id] && EDITS[c.id].applied ? `<h4>What the charter desk changed</h4><p>${esc(EDITS[c.id].applied)}</p>${EDITS[c.id].cannot ? `<p><b>Not done:</b> ${esc(EDITS[c.id].cannot)}</p>` : ""}` : ""}
        ${r.note ? `<h4>Your last note</h4><p>${esc(r.note)}</p>` : ""}
        <div class="ch-act"><textarea id="chnote" placeholder="Anything to change? (optional)" aria-label="Note on this charter"></textarea>
        <button class="chip" data-chrev="${c.id}:changes">Request changes</button><button class="submit" data-chrev="${c.id}:approved">${s === "approved" ? "Approved ✓" : "Approve charter"}</button></div></div>` : "";
      return `<div class="ch" style="--a:${c.accent || "#475569"}"><button class="ch-h" data-chopen="${c.id}" aria-expanded="${open}"><i class="sw"></i><div><b>${esc(c.name)}</b><small>${c.agents} agent${c.agents === 1 ? "" : "s"} · ${c.gates.length} gate${c.gates.length === 1 ? "" : "s"} · ${c.panel.length} senior</small></div><span class="st ${s === "approved" ? "ok" : s === "changes" ? "ch2" : ""}">${lab}</span></button>${body}</div>`;
    }).join("");
  }
  function review(id, decision) {
    const note = ($("#chnote") || {}).value || "";
    rev[id] = { charter: id, decision, note, created: Date.now() / 1000 };
    localStorage.setItem("chRev", JSON.stringify(rev));
    fetch("/api/charters/" + id + "/review", { method: "POST", body: JSON.stringify({ decision, note }) }).catch(() => {});
    S.chOpen = null; toast(decision === "approved" ? "Charter approved." : "Changes requested. The firm stays paused."); render();
  }

  function render() {
    const m = $("#main");
    if (S.tab === "lib" && live && !bkAsked) { bkAsked = 1; bkLoad(); }
    m.innerHTML = { office, floor, board: work, lib: library, charters, needs, new: newDemand }[S.tab]();
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.tab === S.tab));
    const b = $("#badge"); b.textContent = cards.length || ""; b.dataset.n = cards.length;
    renderAside(); updCb();
    if (S.tab === "floor") mountFloor();
    if (S.tab === "needs") wireNeeds();
    if (S.tab === "new") wireNew();
    if (S.tab === "board" && S.work) wireWork();
    if (S.tab === "lib") { const sf = $("#stdfile"); if (sf) sf.onchange = () => { [...sf.files].forEach(x => stds.push({ id: "s" + Date.now() + x.name, name: x.name, kind: "File", scope: "All firms", at: "Today" })); toast("Saved to Design systems."); render(); };
      const go = $("#slinkgo"); if (go) go.onclick = () => { const v = $("#slink").value.trim(); if (!/^https:\/\//.test(v)) { toast("Paste a link that starts with https://"); return; } if (live) post("/api/design-systems", { name: v.replace(/^https:\/\//, "").slice(0, 40), url: v }); stds.push({ id: "s" + Date.now(), name: v.replace(/^https:\/\//, "").slice(0, 40), kind: "Link", url: v, scope: "All firms", at: "Today" }); toast("Link saved to Design systems."); render(); }; }
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
    document.querySelectorAll("[data-gr]").forEach(b => b.onclick = () => { const keep = d.value; S.granola = b.dataset.gr === "1"; render(); $("#demand").value = keep; $("#submit").disabled = !keep.trim(); });
    document.querySelectorAll("[data-nds]").forEach(b => b.onclick = () => { const v = b.dataset.nds, keep = d.value; S.nds = v === "" ? null : v; render(); $("#demand").value = keep; $("#submit").disabled = !keep.trim(); });
    document.querySelectorAll("[data-nfmt]").forEach(b => b.onclick = () => { const v = b.dataset.nfmt, keep = d.value; v ? (S.newFmts.has(v) ? S.newFmts.delete(v) : S.newFmts.add(v)) : S.newFmts.clear(); render(); $("#demand").value = keep; $("#submit").disabled = !keep.trim(); });
    document.querySelectorAll("[data-route]").forEach(b => b.onclick = () => { const v = b.dataset.route, keep = d.value;
      if (!v || v === "plenary") { S.picks.clear(); S.route = v || null; }
      else { if (S.picks.has(v)) S.picks.delete(v); else S.picks.add(v); S.route = S.picks.size === 0 ? null : S.picks.size === 1 ? [...S.picks][0] : "plenary"; } render(); $("#demand").value = keep; $("#submit").disabled = !keep.trim(); });
    s.onclick = () => {
      const t = d.value.trim(); if (!t) return;
      if (live) {
        post("/api/jobs", { title: t, firm: S.route || undefined, firms: S.picks.size > 1 ? [...S.picks] : undefined, formats: [...S.newFmts], design: S.nds, granola: S.granola }).then(async r => {
          const j = await r.json();
          if (r.status === 409) { toast(`${j.name}'s charter isn't approved yet. Approve it in Charters first.`); return; }
          if (!r.ok) { toast("The server refused this demand."); return; }
          S.newFmts.clear(); S.nds = null; S.route = null; S.picks.clear(); S.tab = "board"; await pull(); render(); toast(`Sent to ${fl(j.firm).name}. Watch it on the board.`);
        }).catch(() => toast("Could not reach the server."));
        return;
      }
      const id = S.route || (/acqui|invest|back|deal/i.test(t) ? "plenary" : "gtmn-cto");
      const jid = Date.now(), jt = t.length > 70 ? t.slice(0, 70) + "…" : t;
      jobs.unshift({ id: jid, t: jt, f: id, col: "wait", p: 0 });
      docs.unshift({ id: "d" + jid, job: jid, name: "Deliverable: " + jt, type: "Report", why: "Produced for this demand.", by: id === "plenary" ? "Plenary Chair" : ag(id, 0), ver: 1, fmts: [...S.newFmts], st: "draft", at: "Today" }); S.newFmts.clear(); S.nds = null;
      say(id, "Front desk", `New demand routed to ${fl(id).name}`);
      S.route = null; S.picks.clear(); S.tab = "board"; render(); toast(`Sent to ${fl(id).name}. You'll see it move on the board.`);
    };
  }

  const keep = () => { const y = $("#main").scrollTop; render(); $("#main").scrollTop = y; };
  document.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.chopen) { S.chOpen = S.chOpen === t.dataset.chopen ? null : t.dataset.chopen; const y = $("#main").scrollTop; render(); $("#main").scrollTop = y; return; }
    if (t.dataset.applych) { applyChanges(); return; }
    if (t.dataset.chrev) { const [i, d] = t.dataset.chrev.split(":"); review(i, d); return; }
    if (t.dataset.tab) { S.fmtOpen = null; S.tab = t.dataset.tab; if (S.tab === "board") S.work = null; if (S.tab === "office") { S.firm = null; S.agent = null; } render(); }
    else if (t.dataset.firm && S.tab === "office") { S.firm = t.dataset.firm; S.agent = null; S.showAll = false; render(); }
    else if (t.dataset.agent) { S.agent = t.dataset.agent; render(); }
    else if (t.dataset.back) { if (t.dataset.back === "b") S.firm = null; S.agent = null; render(); }
    else if (t.dataset.showall) { S.showAll = true; render(); }
    else if (t.dataset.goneeds) { S.tab = "needs"; render(); }
    else if (t.dataset.wmode) { S.wmode = !S.wmode; S.wsel = new Set(); render(); }
    else if (t.dataset.warch) { S.arch = !S.arch; S.wsel = new Set(); render(); }
    else if (t.dataset.wpick) { const i = +t.dataset.wpick; S.wsel.has(i) ? S.wsel.delete(i) : S.wsel.add(i); render(); }
    else if (t.dataset.wall) { const l = S.arch ? ajobs : jobs; S.wsel = S.wsel.size === l.length ? new Set() : new Set(l.map(j => j.id)); render(); }
    else if (t.dataset.wstop) { jobsAct([+t.dataset.wstop], "stop"); }
    else if (t.dataset.wact) { jobsAct([...S.wsel], t.dataset.wact); }
    else if (t.dataset.work && S.wmode) { const i = +t.dataset.work; S.wsel.has(i) ? S.wsel.delete(i) : S.wsel.add(i); render(); }
    else if (t.dataset.work) { S.work = +t.dataset.work; S.open = new Set([S.work + ":" + detail(jobOf(S.work)).cur]); render(); $("#main").scrollTop = 0; }
    else if (t.dataset.sdef) { stds.forEach(s => s.def = s.id === t.dataset.sdef ? 1 : 0); keep(); }
    else if (t.dataset.libby) { S.lib = t.dataset.libby; render(); }
    else if (t.dataset.fmtopen) { S.fmtOpen = S.fmtOpen === t.dataset.fmtopen ? null : t.dataset.fmtopen; S.fmtSel.clear(); keep(); }
    else if (t.dataset.fmt) { const k = t.dataset.fmt; S.fmtSel.has(k) ? S.fmtSel.delete(k) : S.fmtSel.add(k); keep(); }
    else if (t.dataset.fmtok) { const d = docs.find(x => x.id === t.dataset.fmtok); S.fmtSel.forEach(k => { if (!d.fmts.includes(k)) d.fmts.push(k); }); toast("Will be made as " + [...S.fmtSel].join(", ")); S.fmtSel.clear(); S.fmtOpen = null; keep(); }
    else if (t.dataset.pv) pvOpen(t.dataset.pv);
    else if (t.dataset.pvk) pvOpen(S.pv.id, t.dataset.pvk);
    else if (t.dataset.pvx) pvClose();
    else if (t.dataset.pvdl) { const [id, k] = t.dataset.pvdl.split(":"), d = docs.find(x => x.id === id); if (d.fmts.includes(k) || (live && /^d\d+$/.test(d.id))) dl(d, k); else { d.fmts.push(k); toast(`Asked the desk to also make it in ${k}.`); } pvOpen(id, k); }
    else if (t.dataset.pvsteer) { const jid = +t.dataset.pvsteer; pvClose(); S.tab = "board"; S.work = jid; S.open = new Set([jid + ":" + detail(jobs.find(j => j.id === jid)).cur]); render(); $("#main").scrollTop = 0; }
    else if (t.dataset.dl) { const [id, k] = t.dataset.dl.split(":"); dl(docs.find(x => x.id === id), k); }
    else if (t.dataset.bkdl) { toast("Preparing your backup…"); location.href = "/api/backup.zip"; }
    else if (t.dataset.bknow) { toast("Backing up…"); post("/api/backup", {}).then(r => { toast(r && r.name ? "Backup saved: " + r.files + " files" : "Backup failed"); bkLoad(); }); }
    else if (t.dataset.dlall) { if (live) { toast("Preparing your zip. This can take a moment."); location.href = "/api/docs.zip"; } else toast("Preparing one zip with every file (sample in this prototype).");}
    else if (t.dataset.wback) { S.work = null; render(); }
    else if (t.dataset.wby) { S.workBy = t.dataset.wby; render(); }
    else if (t.dataset.stage) { S.open.has(t.dataset.stage) ? S.open.delete(t.dataset.stage) : S.open.add(t.dataset.stage); const y = $("#main").scrollTop; render(); $("#main").scrollTop = y; }
    else if (t.dataset.openagent) { const [ff, aa] = t.dataset.openagent.split("/"); S.tab = "office"; S.firm = ff; S.agent = aa; render(); }
    else if (t.dataset.job) { const j = jobs.find(x => x.id == t.dataset.job); if (j.col === "need") { S.tab = "needs"; const i = cards.findIndex(c => c.job === j.id); if (i > 0) cards.unshift(...cards.splice(i, 1)); render(); } }
  });


  /* PREVIEW */
  const PVF = ["PDF", "Word", "PowerPoint", "Excel", "JPEG", "Markdown"];
  const pvSec = d => [["Summary", d.why], ["Key findings", "Three points that matter most for the decision, each with its source and a confidence level."], ["Recommendation", "The desk's recommended path, the main risks, and what would change the answer."], ["Next steps", "Who does what next, with owners and dates."]];
  const real = d => live && /^d\d+$/.test(d.id);
  const mdHtml = t => esc(t).replace(/^#{1,3} (.*)$/gm, "<h4>$1</h4>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/^[-*] (.*)$/gm, "• $1").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
  function pvReal(d, k, host) {
    const u = `/api/docs/${d.id.slice(1)}/file?format=${k}&inline=1`;
    if (k === "PDF") return host.innerHTML = `<iframe class="pv-frame" src="${u}" title="PDF preview"></iframe>`;
    if (k === "JPEG") return host.innerHTML = `<img class="pv-real" src="${u}" alt="JPEG preview">`;
    const md = k === "Markdown";
    fetch(`/api/docs/${d.id.slice(1)}/file?format=text`).then(r => r.text()).then(t => {
      if (S.pv && S.pv.k === k && S.pv.id === d.id) host.innerHTML = md ? `<div class="pv-page"><pre class="pv-md">${esc(t.slice(0, 8000))}</pre></div>` : `<div class="pv-page"><p>${mdHtml(t.slice(0, 6000))}</p></div><p class="pv-n">Text view of the real content. Download for the full ${k} file.</p>`;
    }).catch(() => {});
  }
  function pvBody(d, k) {
    const j = jobs.find(x => x.id === d.job), f = fl(j.f), ac = f.accent === "#FFFFFF" ? "#16181D" : f.accent, S4 = pvSec(d);
    if (k === "PowerPoint") return `<div class="pv-slides">${[["", d.name, f.name + " · " + d.at], ...S4.map(s => [s[0], s[1], ""])].map((s, i) => `<div class="pv-slide" style="--a:${ac}"><small>${i + 1}</small>${s[0] ? `<h4>${esc(s[0])}</h4>` : ""}<b>${esc(s[1])}</b>${s[2] ? `<p>${esc(s[2])}</p>` : ""}</div>`).join("")}</div>`;
    if (k === "Excel") return `<div class="pv-sheet"><table><thead><tr><th></th><th>Item</th><th>Base</th><th>Low</th><th>High</th></tr></thead><tbody>${["Revenue", "Costs", "Margin", "Capital needed", "Payback (months)"].map((r, i) => `<tr><td>${i + 1}</td><td>${r}</td><td>${(100 + i * 37) % 180}</td><td>${(60 + i * 29) % 120}</td><td>${(140 + i * 41) % 220}</td></tr>`).join("")}</tbody></table><p class="pv-n">Sample figures only. The real file carries the assumption register.</p></div>`;
    if (k === "Markdown") return `<div class="pv-page"><pre class="pv-md">${esc("# " + d.name + "\n\n## Summary\n" + d.why + "\n\n## Recommendation\n...")}</pre></div>`;
    if (k === "JPEG") return `<div class="pv-img" style="--a:${ac}"><b>${esc(d.name)}</b><span>${esc(f.name)}</span></div>`;
    return `<div class="pv-page"><h3>${esc(d.name)}</h3><small>${esc(f.name)} · ${esc(d.by)} · v${d.ver} · ${d.at}</small>${S4.map(s => `<h4>${esc(s[0])}</h4><p>${esc(s[1])}</p>`).join("")}</div>`;
  }
  function pvOpen(id, k) {
    const d = docs.find(x => x.id === id); if (!d) return;
    k = k || d.fmts[0] || "PDF"; S.pv = { id, k };
    let el = $("#pv"); if (!el) { el = document.createElement("div"); el.id = "pv"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "File preview"); document.body.appendChild(el); }
    const have = d.fmts.length ? d.fmts : [];
    el.innerHTML = `<div class="pv-card"><div class="pv-h"><div><b>${esc(d.name)}</b><small>v${d.ver} · ${esc(d.type)}</small></div><button class="chip" data-pvx="1" aria-label="Close preview">Close</button></div>
      <div class="pv-tabs">${PVF.map(f => `<button class="chip" data-pvk="${f}" aria-pressed="${f === k}" style="${have.includes(f) ? "" : "opacity:.55;border-style:dashed"}">${f}</button>`).join("")}</div>
      <p class="pv-note">${have.includes(k) ? "" : `Not made yet in ${k}. This shows how it would look. `}Sample preview: the real file is shown here once the firm has produced it.</p>
      <div class="pv-body">${pvBody(d, k)}</div>
      <div class="pv-f"><button class="submit" data-pvdl="${d.id}:${k}">${have.includes(k) ? "Download " + k : "Make it in " + k}</button><button class="chip" data-pvsteer="${d.job}">Steer this</button></div></div>`;
    if (real(d)) { const pb = el.querySelector(".pv-body"); pb.innerHTML = ""; el.querySelector(".pv-note").textContent = "This is the real file the firm produced."; el.querySelector("[data-pvdl]").textContent = "Download " + k; pvReal(d, k, pb); }
    el.classList.add("on"); const c = el.querySelector("[data-pvx]"); if (c) c.focus();
  }
  const pvClose = () => { const el = $("#pv"); if (el) el.classList.remove("on"); S.pv = null; };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && S.pv) pvClose(); });

  /* LIVE ENGINE: used when the page is served by server/app.py */
  const COL = { waiting: "wait", working: "work", asking: "need", done: "done", stopped: "stop" };
  const post = (u, b) => fetch(u, { method: "POST", body: JSON.stringify(b) });
  const getj = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const when = t => new Date(t * 1000).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  async function jobsAct(ids, action) {
    if (!ids.length) return;
    const n = ids.length, w = n === 1 ? "this demand" : n + " demands";
    const msg = { stop: `Stop work on ${w}? Files already made stay in the Library.`, delete: `Delete ${w} and ${n === 1 ? "its" : "their"} files? This cannot be undone.` }[action];
    if (msg && !confirm(msg)) return;
    const r = await post("/api/jobs/bulk", { ids, action }).catch(() => null);
    if (!r || !r.ok) { toast("That did not work. Try again."); return; }
    toast({ stop: "Stopped", archive: "Archived", unarchive: "Restored", delete: "Deleted" }[action]);
    if (action !== "stop") S.wsel = new Set();
    if (action === "delete" && ids.includes(S.work)) S.work = null;
    if (action === "stop") S.wsel = new Set();
    sig = ""; await pull(); render();
  }
  async function pull() {
    let js, cs, lb;
    try { [js, cs, lb] = await Promise.all([getj("/api/jobs"), getj("/api/cards"), getj("/api/library")]); } catch (e) { return; }
    const docOf = job => (lb.docs.find(d => d.job === job) || {}).id;
    const mapJ = j => ({ id: j.id, t: j.title, f: j.firm, col: COL[j.status] || "wait", p: j.progress, live: 1 });
    jobs = js.filter(j => !j.archived).map(mapJ); ajobs = js.filter(j => j.archived).map(mapJ);
    cards = cs.map(c => { const p = c.payload, f = byId[c.firm]; return { id: "c" + c.id, srv: c.id, job: c.job, firm: c.firm, agent: f ? f.agents[0].name : "Plenary Chair", kind: p.kind, q: p.q, opts: p.opts, why: p.why, def: p.def, fmtDoc: p.q.startsWith("Which formats") ? "d" + docOf(c.job) : undefined }; });
    docs = lb.docs.map(d => ({ id: "d" + d.id, job: d.job, name: d.name, type: d.kind, why: d.why || "Produced for this demand.", by: agName(d.by), ver: d.version, fmts: JSON.parse(d.formats || "[]"), st: "final", at: when(d.created) }));
    if (lb.design_systems.length) stds = lb.design_systems.map(s => ({ id: "s" + s.id, name: s.name, kind: s.kind === "link" ? "Link" : "File", url: s.url, def: s.is_default, scope: "All firms", at: when(s.created) }));
    Object.keys(S.state).forEach(k => { S.state[k] = "idle"; });
    jobs.forEach(j => { const f = byId[j.f]; if (!f || (j.col !== "work" && j.col !== "need")) return; f.agents.slice(0, 4).forEach(a => { S.state[f.id + "/" + a.id] = j.col === "need" ? "asking" : "working"; S.task[f.id + "/" + a.id] = "Working on: " + j.t; }); });
    const s = JSON.stringify([jobs, ajobs, cards, docs, stds]);
    if (s === sig) return; sig = s;
    const ae = document.activeElement, typing = ae && /TEXTAREA|INPUT/.test(ae.tagName);
    if (!typing && ["office", "board", "needs", "lib"].includes(S.tab)) keep(); else { updCb(); renderAside(); const b = $("#badge"); b.textContent = cards.length || ""; b.dataset.n = cards.length; }
  }
  async function goLive() {
    try { const r = await fetch("/api/firms"); if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return; } catch (e) { return; }
    live = true; jobs = []; cards = []; docs = []; sig = "";
    try {
      const server = Object.fromEntries((await getj("/api/charters")).map(x => [x.charter, x.decision]));
      for (const id in rev) if (rev[id].decision !== "proposed" && server[id] !== rev[id].decision) await post("/api/charters/" + id + "/review", { decision: rev[id].decision, note: rev[id].note || "" });
      const lb = await getj("/api/library");
      if (!lb.design_systems.length) for (const s of stds) if (s.url) await post("/api/design-systems", { name: s.name, url: s.url });
    } catch (e) {}
    await pull(); setInterval(() => { pull(); if (S.tab === "board") syncThread(jobs.find(x => x.id === S.work)); }, 2500);
    const es = new EventSource("/api/stream");
    es.onmessage = m => { const e = JSON.parse(m.data), id = byId[e.firm] ? e.firm : "plenary"; say(id, fl(id).name, e.text); };
    render();
  }
  goLive();

  /* gentle live simulation */
  const lines = ["finished a section", "added 6 facts to the ledger", "is cross-checking a source", "started a new draft", "sent a note to the desk"];
  setInterval(() => {
    if (live) return;
    const f = FIRMS[Math.floor(Math.random() * FIRMS.length)], a = f.agents[Math.floor(Math.random() * f.agents.length)], k = f.id + "/" + a.id;
    if (S.state[k] === "asking") return;
    S.since = S.since || {};
    if (S.state[k] === "idle") { S.state[k] = "working"; S.since[k] = Date.now(); S.task[k] = "Drafting its section of the mandate"; }
    else if (Date.now() - (S.since[k] || 0) > 90000 && Math.random() < .3) S.state[k] = "idle";
    if (Math.random() < .6) say(f.id, f.name, `${a.name} ${lines[Math.floor(Math.random() * lines.length)]}`);
    jobs.forEach(j => { if (j.col === "work") j.p = Math.min(.95, j.p + .02); });
    if (S.tab === "office" || (S.tab === "board" && !S.work)) { const y = $("#main").scrollTop; render(); $("#main").scrollTop = y; }
  }, 4500);

  render();

  /* COST BAR */
  const CB = { d: null, open: false };
  const usd = n => "$" + (n >= 100 ? n.toFixed(0) : n.toFixed(2));
  function drawCost() {
    const el = document.getElementById("costbar"), d = CB.d; if (!el || !d) return;
    if (el.hidden) { el.hidden = false; document.documentElement.style.setProperty("--cb", "38px"); setTimeout(() => window.dispatchEvent(new Event("resize")), 50); }
    const pct = d.cap > 0 ? Math.min(100, d.spent / d.cap * 100) : 100, cls = pct >= 100 ? "hot" : pct >= 80 ? "hot" : pct >= 60 ? "warn" : "";
    el.classList.toggle("paused", !!d.paused); el.innerHTML = `<span class="cb-hide">Spend this month</span><b>${usd(d.spent)}</b><div class="cb-track" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Spend against cap"><div class="cb-fill ${cls}" style="width:${pct}%"></div></div><span>of <b>${usd(d.cap)}</b></span>` +
      (d.paused ? `<span class="cb-msg">Cap reached: runs paused</span><button class="cb-go" data-cbext="10">+ $10</button><button class="cb-go" data-cbext="25">+ $25</button><button data-cbstop="1">Stop runs</button>` : "") +
      `<span class="cb-sp cb-hide">Today ${usd(d.today)}</span><button data-cbset="1">Set cap</button>`;
    let pop = document.getElementById("cbpop");
    if (CB.open && !pop) { pop = document.createElement("div"); pop.id = "cbpop"; pop.className = "cb-pop"; document.body.appendChild(pop); }
    if (pop) { if (!CB.open) pop.remove(); else if (!pop.dataset.f) { pop.dataset.f = 1; pop.innerHTML = `<h4>Monthly spending cap</h4><small>Runs pause when it is reached. You can extend it or stop them. Resets each month.</small><label for="cbv">Cap in USD</label><input id="cbv" type="number" min="1" step="1" value="${Math.round(d.base)}"><label for="cbe">Or add extra this month</label><input id="cbe" type="number" min="1" step="1" placeholder="e.g. 10"><div class="row"><button class="pri" data-cbsave="1">Save</button><button data-cbclose="1">Close</button></div>`; } }
  }
  function pullCost() { fetch("/api/cost").then(r => r.ok ? r.json() : null).then(d => { if (d) { const was = JSON.stringify(window.__byJob || {}); window.__byJob = Object.fromEntries((d.by_job || []).map(x => [x.job, x.usd])); CB.d = d; drawCost(); if (was !== JSON.stringify(window.__byJob) && S.tab === "work") render(); } }).catch(() => {}); }
  function postCost(body) { return fetch("/api/cost", { method: "POST", body: JSON.stringify(body) }).then(r => r.json()).then(d => { if (d.error) { toast("Could not save: " + d.error); return; } CB.d = d; drawCost(); }).catch(() => toast("Could not reach the server.")); }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-cbext],[data-cbstop],[data-cbset],[data-cbsave],[data-cbclose]"); if (!t) return;
    if (t.dataset.cbext) postCost({ extend: +t.dataset.cbext }).then(() => toast("Cap extended. Work resumes."));
    else if (t.dataset.cbstop) { if (confirm("Stop all paused runs? They end where they are.")) postCost({ stop: true }).then(() => toast("Paused runs stopped.")); }
    else if (t.dataset.cbset) { CB.open = !CB.open; const p = document.getElementById("cbpop"); if (p) p.remove(); drawCost(); }
    else if (t.dataset.cbsave) { const c = document.getElementById("cbv").value, x = document.getElementById("cbe").value; const go = x ? postCost({ extend: +x }) : postCost({ cap: +c }); go.then(() => { CB.open = false; drawCost(); toast("Cap saved."); }); }
    else if (t.dataset.cbclose) { CB.open = false; drawCost(); }
  });
  pullCost(); setInterval(pullCost, 3000);
})();
