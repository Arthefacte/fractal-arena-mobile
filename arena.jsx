/* ============================================================
   FRACTAL ARENA — Arena screen (combat)
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, presetLabel, rarityLabel, Bar, Modal } = window;
const ENG = window.FA_ENGINE;

function CombatCard({ meta, live, side, cref }) {
  if (!meta) {
    return (
      <div className="card" ref={cref} style={{ "--rc": "var(--line)", opacity: 0.5 }}>
        <div className="art" style={{ display: "grid", placeItems: "center" }}>
          <span className="mono" style={{ color: "var(--text-faint)", fontSize: 30 }}>?</span>
        </div>
        <div className="body"><div className="cname muted">—</div></div>
      </div>
    );
  }
  const rc = D.RARITY_COLORS[meta.rarity];
  const frac = live ? live.hp / live.maxHp : 1;
  const dead = live && !live.alive;
  return (
    <div className={cx("card", dead && "dead")} ref={cref} style={{ "--rc": rc }}>
      <div className="art">
        <img src={D.ART[meta.image_key]} alt={meta.name} draggable="false" />
        <div className="rar-tag">{rarityLabel(meta.rarity)}</div>
        <div className="lvl-tag">LV {meta.level}</div>
      </div>
      <div className="body">
        <div className="flex between center" style={{ gap: 6 }}>
          <div className="cname">{meta.name}</div>
          <div className="cpreset" style={{ color: D.PRESET_COLORS[meta.preset] }}>{presetLabel(meta.preset)}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="bar-label">
            <span style={{ color: side === "p1" ? "var(--elec)" : "var(--alert)" }}>HP</span>
            <span style={{ color: "var(--text)" }}>{live ? Math.max(0, Math.ceil(live.hp)) : meta.maxHp}/{live ? live.maxHp : meta.maxHp}</span>
          </div>
          <Bar frac={frac} kind="hp" />
        </div>
      </div>
    </div>
  );
}

function Arena() {
  const { g, actions, toast } = useFA();
  const selectedBeasts = g.selected.map((id) => g.roster.find((b) => b.id === id)).filter(Boolean);
  const ready = selectedBeasts.length === 3;

  const [betTier, setBetTier] = useState("");
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [p1Live, setP1Live] = useState(null);
  const [p2Live, setP2Live] = useState(null);
  const [p1Meta, setP1Meta] = useState(selectedBeasts.map(beastMeta));
  const [p2Meta, setP2Meta] = useState([null, null, null]);
  const [logLines, setLogLines] = useState([]);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);

  const loopRef = useRef(false);
  const runIdRef = useRef(0);
  const stepRef = useRef(null);
  const battleRef = useRef(null);
  const seqRef = useRef([]);
  const seqIdxRef = useRef(0);
  const logRef = useRef(null);
  const p1Refs = useRef([]);
  const p2Refs = useRef([]);

  function beastMeta(b) {
    return b ? { name: D.displayName(b), rarity: b.rarity, image_key: b.image_key, preset: b.preset, level: b.level, maxHp: D.eff(b, "hp") } : null;
  }

  // keep idle preview synced with selection
  useEffect(() => {
    if (!playing) {
      setP1Meta(selectedBeasts.map(beastMeta));
      setP1Live(selectedBeasts.map((b) => ({ hp: D.eff(b, "hp"), maxHp: D.eff(b, "hp"), alive: true })));
    }
  }, [g.selected.join(","), g.roster, playing]);

  // build difficulty sequence lazily when team changes
  useEffect(() => {
    seqRef.current = []; seqIdxRef.current = 0;
    if (ready) {
      const beasts = selectedBeasts.slice();
      const id = ++runIdRef.current;
      setTimeout(() => {
        const seq = ENG.buildSequence(beasts);
        if (runIdRef.current === id || true) { seqRef.current = seq; seqIdxRef.current = 0; }
      }, 30);
    }
  }, [g.selected.join(","), selectedBeasts.map((b) => b.level + b.rarity).join(",")]);

  // cleanup on unmount
  useEffect(() => () => { loopRef.current = false; runIdRef.current++; if (stepRef.current) clearTimeout(stepRef.current); }, []);

  function log(text, cls) { setLogLines((L) => [...L.slice(-120), { text, cls }]); }
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logLines]);

  function nextMult() {
    const seq = seqRef.current;
    if (!seq.length) return 1.0;
    const m = seq[seqIdxRef.current % seq.length];
    seqIdxRef.current++;
    return m;
  }

  function floatText(cardEl, text, color) {
    if (!cardEl || !g.options.anim) return;
    const art = cardEl.querySelector(".art");
    if (!art) return;
    const el = document.createElement("div");
    el.className = "dmg-float";
    el.textContent = text;
    el.style.color = color;
    el.style.left = (30 + Math.random() * 40) + "%";
    el.style.top = "40%";
    art.appendChild(el);
    setTimeout(() => el.remove(), 980);
  }
  function animHit(side, idx) {
    if (!g.options.anim) return;
    const el = (side === "p1" ? p1Refs : p2Refs).current[idx];
    if (!el) return;
    el.classList.remove("shake", "flash"); void el.offsetWidth;
    el.classList.add("shake", "flash");
    setTimeout(() => el.classList.remove("shake", "flash"), 360);
  }
  function animLunge(side, idx) {
    if (!g.options.anim) return;
    const el = (side === "p1" ? p1Refs : p2Refs).current[idx];
    if (!el) return;
    const cls = side === "p1" ? "lunge-l" : "lunge-r";
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 380);
  }

  function stopBattle() { if (stepRef.current) { clearTimeout(stepRef.current); stepRef.current = null; } }

  // Begin one fight. Uses a setTimeout-driven stepper (robust under Babel transform).
  function playFight(isLoopRun) {
    if (!ready) { toast(I18N.t("AR_NEED3"), "bad"); return; }
    if (!g.wallet) { toast(I18N.t("OB_WALLET_REQUIRED"), "bad"); return; }

    const free = betTier === "" && g.freeFights > 0;
    if (betTier === "" && g.freeFights <= 0) { toast(I18N.t("AR_PICK_BET"), "bad"); return; }

    const bet = actions.startBet({ free, betTier, isLoop: isLoopRun });
    if (!bet.ok) { toast(bet.reason || I18N.t("AR_INSUFF"), "bad"); if (isLoopRun) { loopRef.current = false; setLoop(false); } return; }
    if (bet.note) toast(bet.note, "info");
    const effTier = bet.betTier;

    setPlaying(true);
    setResult(null);
    if (!isLoopRun) setLogLines([]);

    const enemies = D.generateEnemyTeam(selectedBeasts, nextMult());
    setP1Meta(selectedBeasts.map(beastMeta));
    setP2Meta(enemies.map(beastMeta));

    const battle = ENG.runBattle(selectedBeasts, enemies);
    setP1Live(battle.events[0].state.p1);
    setP2Live(battle.events[0].state.p2);

    if (free) log(I18N.t("L_FREE"), "lc-green");
    else log(I18N.t("L_BET", I18N.t("AR_" + effTier.toUpperCase()), bet.betAmount), "lc-gold");
    log(I18N.t("L_START"), "lc-elec");

    const spd = g.options.speed || 1;
    const baseDelay = g.options.anim ? 165 : 42;
    battleRef.current = { battle, i: 0, isLoopRun, free, effTier, bet, spd, baseDelay };

    stopBattle();
    stepRef.current = setTimeout(stepBattle, 220 / spd);
  }

  function stepBattle() {
    const ctx = battleRef.current;
    if (!ctx) return;
    const { battle, spd, baseDelay } = ctx;
    if (ctx.i >= battle.events.length) { settleBattle(); return; }
    const ev = battle.events[ctx.i++];
    let delay = baseDelay / spd;
    switch (ev.t) {
      case "round":
        setRound(ev.round);
        log("── " + I18N.t("AR_ROUND", ev.round) + " ──", "lc-yellow");
        delay = baseDelay * 0.6 / spd;
        break;
      case "atk":
      case "sp":
      case "crit": {
        animLunge(ev.side, ev.idx);
        animHit(ev.tside, ev.tidx);
        const tEl = (ev.tside === "p1" ? p1Refs : p2Refs).current[ev.tidx];
        floatText(tEl, "-" + ev.dmg, ev.crit ? "var(--gold)" : ev.t === "sp" ? "var(--forge)" : "var(--alert)");
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
        log(I18N.t(key, ev.name, ev.tname, ev.dmg), ev.crit ? "lc-gold" : ev.t === "sp" ? "lc-purple" : "lc-red");
        if (ev.down) log(I18N.t("L_DOWN", ev.tname), "lc-yellow");
        break;
      }
      case "miss":
        log(I18N.t("L_MISS", ev.name), "lc-dim");
        delay = baseDelay * 0.6 / spd;
        break;
      case "heal": {
        const hEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        floatText(hEl, "+" + ev.heal, "var(--success)");
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        log(I18N.t("L_HEAL", ev.name, ev.heal), "lc-green");
        delay = baseDelay * 0.5 / spd;
        break;
      }
      case "timeout":
        log(I18N.t("L_TIMEOUT"), "lc-dim");
        delay = 80 / spd;
        break;
      case "win": case "lose":
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        delay = 40 / spd;
        break;
    }
    stepRef.current = setTimeout(stepBattle, delay);
  }

  function settleBattle() {
    const ctx = battleRef.current;
    if (!ctx) return;
    const { battle, isLoopRun, free, effTier, bet, spd } = ctx;
    const win = battle.winner === "p1";
    log(win ? I18N.t("L_WIN") : I18N.t("L_LOSE"), win ? "lc-green" : "lc-red");

    const summary = actions.resolveFight({ win, free, betTier: effTier, betAmount: bet.betAmount, fromLocked: bet.fromLocked, isLoop: isLoopRun });
    summary.levelUps.forEach((e) => log(I18N.t("L_LEVELUP", D.displayName(e.beast), e.beast.level), "lc-elec"));
    summary.rarityUps.forEach((e) => log(I18N.t("L_RARITYUP", D.displayName(e.beast), rarityLabel(e.beast.rarity)), "lc-purple"));

    setPlaying(false);
    battleRef.current = null;

    if (loopRef.current && isLoopRunAllowed()) {
      stepRef.current = setTimeout(() => { if (loopRef.current) playFight(true); }, 640 / spd);
      return;
    }
    loopRef.current = false; setLoop(false);
    if (!isLoopRun) setResult({ win, free, ...summary });
  }

  function isLoopRunAllowed() {
    // continue loop only if we can afford / have free fights
    if (betTier === "") return g.freeFights > 0;
    const amt = D.ECON.BET[betTier];
    // Verrouillage ON : on ne mise QUE depuis le verrouillé. Dès qu'il ne couvre
    // plus une mise, la boucle s'arrête — le solde disponible n'est jamais entamé.
    if (g.useLocked) return g.locked >= amt;
    return g.liquid + g.locked >= amt;
  }

  function onFight() { if (playing) return; setResult(null); playFight(false); }
  function onLoop() {
    if (loop) { loopRef.current = false; setLoop(false); return; }
    if (!ready) { toast(I18N.t("AR_NEED3"), "bad"); return; }
    loopRef.current = true; setLoop(true);
    if (!playing) playFight(true);
  }

  const total = g.session.wins + g.session.losses;
  const wr = total ? Math.round((g.session.wins / total) * 100) : 0;
  const nextMs = D.ECON.MILESTONE_EVERY - (g.totalFights % D.ECON.MILESTONE_EVERY);

  const betTiers = [
    { k: "bronze", c: "#CD7F32" },
    { k: "silver", c: "#C0C0C0" },
    { k: "gold", c: "var(--gold)" },
  ];

  return (
    <div className="container wide">
      <div className="flex between center wrap" style={{ marginBottom: 14, gap: 12 }}>
        <div>
          <div className="eyebrow">{I18N.t("OB_TAG")}</div>
          <div className="h1" style={{ marginBottom: 0 }}>{I18N.t("NAV_ARENA")}</div>
        </div>
        <div className="flex gap8 wrap">
          <span className="pill" style={{ color: wr >= 60 ? "var(--success)" : wr >= 45 ? "var(--gold)" : "var(--alert)" }}>{I18N.t("AR_WINRATE", g.session.wins, g.session.losses, wr)}</span>
          <span className="pill">{I18N.t("AR_NEXT_MS", nextMs)}</span>
          <span className="pill" style={{ color: "var(--elec)" }}>{I18N.t("AR_TICKETS", g.ticketsSilver, g.ticketsGold)}</span>
        </div>
      </div>

      {/* Arena board with full battle background */}
      <div className="panel oct" style={{ position: "relative", overflow: "hidden", border: "1px solid var(--line)", padding: "26px 22px 22px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "var(--filigrane)", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.16, mixBlendMode: "luminosity" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,9,18,0.55), rgba(6,9,18,0.82))" }} />
        <div style={{ position: "relative" }}>
          <div className="flex center arena-board-row" style={{ gap: 18, alignItems: "stretch" }}>
            {/* P1 */}
            <div style={{ flex: 1 }}>
              <div className="flex between center" style={{ marginBottom: 10 }}>
                <span className="h2" style={{ color: "var(--elec)", fontSize: 15 }}>{g.ordinalName || g.playerTitle || g.playerName || I18N.t("AR_YOU")}</span>
                {round > 0 && <span className="pill mono" style={{ fontSize: 10 }}>{I18N.t("AR_ROUND", round)}</span>}
              </div>
              <div className="team-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                {[0, 1, 2].map((i) => (
                  <CombatCard key={i} side="p1" meta={p1Meta[i]} live={p1Live && p1Live[i]} cref={(el) => (p1Refs.current[i] = el)} />
                ))}
              </div>
            </div>
            {/* VS hex */}
            <div className="flex center arena-vs" style={{ flexDirection: "column", justifyContent: "center", flex: "none", width: 70 }}>
              <div className="hex" style={{ width: 64, height: 70, background: "linear-gradient(160deg, var(--fire), #7a1f0a)", display: "grid", placeItems: "center", boxShadow: "0 0 30px rgba(247,147,26,0.4)" }}>
                <div className="hex" style={{ width: 56, height: 62, background: "var(--bg-0)", display: "grid", placeItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1, color: "var(--fire)" }}>VS</span>
                </div>
              </div>
            </div>
            {/* P2 */}
            <div style={{ flex: 1 }}>
              <div className="flex between center" style={{ marginBottom: 10 }}>
                <span className="h2" style={{ color: "var(--alert)", fontSize: 15 }}>{I18N.t("AR_VERSUS")}</span>
              </div>
              <div className="team-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                {[0, 1, 2].map((i) => (
                  <CombatCard key={i} side="p2" meta={p2Meta[i]} live={p2Live && p2Live[i]} cref={(el) => (p2Refs.current[i] = el)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls + log */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginTop: 16 }} className="arena-lower">
        {/* Log */}
        <div className="panel oct" style={{ border: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 260 }}>
          <div className="flex between center arena-log-head" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            <span className="h2" style={{ fontSize: 14, color: "var(--fire)" }}>{I18N.t("AR_LOG")}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>terminal://fractal.arena</span>
          </div>
          <div className="log" ref={logRef} style={{ flex: 1, maxHeight: 320 }}>
            {logLines.length === 0 && <div className="lc-dim">&gt; {I18N.t("TEAM_HINT")}…</div>}
            {logLines.map((l, i) => <div key={i} className={cx("log-line", l.cls)}>{l.text}</div>)}
          </div>
        </div>

        {/* Action panel */}
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="flex between center" style={{ marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("AR_BET")}</span>
              <span className="mono" style={{ fontSize: 12, color: g.freeFights > 0 ? "var(--success)" : "var(--text-dim)" }}>
                {g.freeFights > 0 ? I18N.t("AR_FREE_LEFT", g.freeFights) : I18N.t("AR_FREE_EMPTY")}
              </span>
            </div>
            <div className="flex gap8 arena-bet-row">
              <button className={cx("btn sm", betTier === "" && "on")} style={{ flex: 1, "--c": "var(--success)" }} disabled={playing} onClick={() => setBetTier("")}>{I18N.t("AR_FREE")}</button>
              {betTiers.map((t) => (
                <button key={t.k} className={cx("btn sm", betTier === t.k && "on")} style={{ flex: 1.3, "--c": t.c }} disabled={playing} onClick={() => setBetTier(t.k)}>
                  {I18N.t("AR_" + t.k.toUpperCase())}<span className="mono" style={{ fontSize: 10, opacity: 0.8, marginLeft: 4 }}>{D.ECON.BET[t.k]}</span>
                </button>
              ))}
            </div>
            {betTier && <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>+{D.ECON.BET_GAIN[betTier]} {I18N.t("RES_NET")} · ×{D.ECON.PAYOUT_MULT}</div>}
          </div>

          <label className="flex between center" style={{ cursor: "pointer", padding: "8px 0", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("AR_USE_LOCKED")}</span>
            <span onClick={() => actions.setUseLocked(!g.useLocked)} className="oct-sm" style={{ width: 42, height: 22, background: g.useLocked ? "var(--fire)" : "#1a2238", position: "relative", transition: "background .2s", borderRadius: 11 }}>
              <span style={{ position: "absolute", top: 3, left: g.useLocked ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </span>
          </label>

          <div className="flex gap8" style={{ marginTop: "auto" }}>
            <button className="btn btn-success block lg" style={{ flex: 1.4 }} disabled={playing || !ready} onClick={onFight}>{I18N.t("AR_FIGHT")}</button>
            <button className={cx("btn block lg", loop ? "btn-forge on" : "btn-forge")} style={{ flex: 1 }} disabled={!ready} onClick={onLoop}>{loop ? I18N.t("AR_LOOP_ON") : I18N.t("AR_LOOP_OFF")}</button>
          </div>
          {!ready && <div className="mono" style={{ fontSize: 11, color: "var(--alert)", textAlign: "center" }}>{I18N.t("AR_NEED3")}</div>}
        </div>
      </div>

      {result && <ResultModal data={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function ResultModal({ data, onClose }) {
  const win = data.win;
  return (
    <Modal onClose={onClose} accent={win ? "var(--success)" : "var(--alert)"}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div className="eyebrow" style={{ color: win ? "var(--success)" : "var(--alert)" }}>{data.free ? I18N.t("RES_LOCKED_GAIN") : "FRACTALARENA"}</div>
        <div className="h1" style={{ fontSize: 38, color: win ? "var(--success)" : "var(--alert)", margin: "4px 0" }}>{win ? I18N.t("RES_WIN") : I18N.t("RES_LOSE")}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {win ? (
          <>
            <ResRow label={I18N.t("RES_GAIN")} value={"+" + fmt(data.payout)} color="var(--gold)" />
            {!data.free && <ResRow label={I18N.t("RES_NET")} value={(data.net >= 0 ? "+" : "") + fmt(data.net)} color={data.net >= 0 ? "var(--success)" : "var(--alert)"} />}
            <ResRow label={I18N.t("RES_XP")} value={"+" + data.xp} color="var(--elec)" />
            {data.luckyBonus > 0 && <ResRow label="Lucky Strike" value={"+" + fmt(data.luckyBonus)} color="var(--fire)" />}
          </>
        ) : (
          <>
            {data.insuranceUsed ? (
              <ResRow label="Insurance 🛡" value={"+" + fmt(data.betAmount)} color="var(--success)" />
            ) : (
              <>
                <ResRow label={I18N.t("RES_POOL")} value={fmt(data.pool)} color="var(--elec)" />
                <ResRow label={I18N.t("RES_BURN")} value={fmt(data.burn)} color="var(--alert)" />
              </>
            )}
            <ResRow label={I18N.t("RES_XP")} value="+0" color="var(--text-dim)" />
          </>
        )}
        {data.milestone && (
          <div className="oct-sm" style={{ marginTop: 6, padding: "12px 14px", background: "rgba(255,230,0,0.08)", border: "1px solid rgba(255,230,0,0.4)", textAlign: "center" }}>
            <span className="mono" style={{ color: "var(--gold)", fontSize: 13 }}>{I18N.t("RES_MILESTONE", D.ECON.MILESTONE_REWARD)}</span>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>+{D.ECON.TICKET_SILVER_PER_MS} 🎟 Silver · +{D.ECON.TICKET_GOLD_PER_MS} 🎟 Gold</div>
          </div>
        )}
      </div>
      <button className={cx("btn block lg", win ? "btn-success" : "btn-elec")} style={{ marginTop: 20 }} onClick={onClose}>{I18N.t("RES_CONTINUE")}</button>
    </Modal>
  );
}
function ResRow({ label, value, color }) {
  return (
    <div className="flex between center" style={{ padding: "9px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-soft)" }}>
      <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

Object.assign(window, { Arena });
