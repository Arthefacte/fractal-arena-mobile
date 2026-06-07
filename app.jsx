/* ============================================================
   FRACTAL ARENA — App root: state, actions, shell
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { FA_Ctx, useFA, cx, fmt, Coin, Bar } = window;
const { Team, Arena, Forge, Wallet, Boosts, Perso, Options } = window;
const SAVE_KEY = "fractal_arena_v1";

function freshState() {
  return {
    lang: "FR",
    wallet: null,
    liquid: 0,
    locked: 0,
    useLocked: false,
    roster: [],
    selected: [],
    freeFights: D.ECON.FREE_FIGHTS_PER_DAY,
    freeResetTs: Date.now(),
    totalFights: 0,
    loopSilverToday: 0,
    loopGoldToday: 0,
    ticketsSilver: 0,
    ticketsGold: 0,
    session: { wins: 0, losses: 0, net: 0 },
    boosts: { xp_boost: 0, insurance: 0, lucky_strike: 0 },
    playerName: "",
    playerTitle: "",
    ordinalName: "",
    holderDays: 0,
    options: { sound: true, anim: true, speed: 1 },
    view: "team",
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return Object.assign(freshState(), s, {
      wallet: null, // wallet obligatoire : toujours repasser par la connexion au démarrage
      view: "team",
      options: Object.assign(freshState().options, s.options || {}, { speed: 1 }),
      session: Object.assign({ wins: 0, losses: 0, net: 0 }, s.session || {}),
      boosts: Object.assign({ xp_boost: 0, insurance: 0, lucky_strike: 0 }, s.boosts || {}),
    });
  } catch (e) { return null; }
}

function App() {
  const [g, setG] = useState(() => { const s = loadState() || freshState(); I18N.setLang(s.lang); return s; });
  const [toasts, setToasts] = useState([]);
  const [chipPop, setChipPop] = useState(0);
  const gRef = useRef(g);
  gRef.current = g;

  // persist
  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch (e) { }
  }, [g]);

  // language
  useEffect(() => { I18N.setLang(g.lang); }, [g.lang]);

  // daily reset
  useEffect(() => {
    if (!g.wallet) return;
    if (Date.now() - g.freeResetTs >= 86400000) {
      setG((s) => ({ ...s, freeFights: D.ECON.FREE_FIGHTS_PER_DAY, loopSilverToday: 0, loopGoldToday: 0, freeResetTs: Date.now() }));
    }
  }, [g.wallet]);

  // chip pop on liquid change
  const prevLiquid = useRef(g.liquid);
  useEffect(() => { if (g.liquid !== prevLiquid.current) { prevLiquid.current = g.liquid; setChipPop((n) => n + 1); } }, [g.liquid]);

  function toast(msg, kind) {
    const id = Math.random();
    setToasts((T) => [...T, { id, msg, kind }]);
    setTimeout(() => setToasts((T) => T.filter((t) => t.id !== id)), 2600);
  }

  // ---- spending helper: liquid first then locked ----
  function spendAny(s, amount) {
    if (s.liquid + s.locked < amount) return null;
    let liquid = s.liquid, locked = s.locked;
    if (liquid >= amount) liquid -= amount;
    else { const rem = amount - liquid; liquid = 0; locked -= rem; }
    return { liquid, locked };
  }

  const actions = useMemo(() => ({
    setLang(l) { I18N.setLang(l); setG((s) => ({ ...s, lang: l })); },
    setOption(k, v) { setG((s) => ({ ...s, options: { ...s.options, [k]: v } })); },
    setUseLocked(v) { setG((s) => ({ ...s, useLocked: v })); },
    setView(v) { setG((s) => ({ ...s, view: v })); },

    connectWallet(addr) {
      setG((s) => {
        const isNew = !s.roster.length;
        const next = { ...s, wallet: addr, playerName: addr.slice(0, 6) + "…" + addr.slice(-4) };
        if (isNew) {
          next.roster = D.starterRoster();
          next.locked = D.ECON.WELCOME_LOCKED;
          next.liquid = D.ECON.WELCOME_LIQUID;
          next.freeFights = D.ECON.FREE_FIGHTS_PER_DAY;
          next.freeResetTs = Date.now();
        }
        next.view = "team";
        return next;
      });
    },
    disconnect() { setG((s) => ({ ...s, wallet: null })); },
    resetProgress() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
      setG(freshState());
    },

    toggleSelect(id) {
      setG((s) => {
        const has = s.selected.includes(id);
        let selected = has ? s.selected.filter((x) => x !== id) : (s.selected.length < 3 ? [...s.selected, id] : s.selected);
        return { ...s, selected };
      });
    },

    startBet({ free, betTier, isLoop }) {
      const s = gRef.current;
      if (free) {
        if (s.freeFights <= 0) return { ok: false, reason: I18N.t("AR_FREE_EMPTY") };
        setG((st) => ({ ...st, freeFights: st.freeFights - 1 }));
        return { ok: true, free: true, betTier: "", betAmount: 0, fromLocked: false };
      }
      let tier = betTier;
      let note = null;
      if (isLoop && tier === "silver" && s.loopSilverToday >= D.ECON.LOOP_SILVER_MAX) { tier = "bronze"; note = I18N.t("AR_LOOP_CAP"); }
      if (isLoop && tier === "gold" && s.loopGoldToday >= D.ECON.LOOP_GOLD_MAX) { tier = "bronze"; note = I18N.t("AR_LOOP_CAP"); }
      const amount = D.ECON.BET[tier];
      // deduction with useLocked logic
      // Verrouillage ON : la mise sort UNIQUEMENT du verrouillé, jamais du disponible.
      let fromLocked = false, liquid = s.liquid, locked = s.locked;
      if (s.useLocked) {
        if (s.locked < amount) return { ok: false, reason: I18N.t("AR_LOCKED_EMPTY") };
        locked -= amount; fromLocked = true;
      } else if (s.liquid >= amount) { liquid -= amount; }
      else return { ok: false, reason: I18N.t("AR_INSUFF") };
      setG((st) => {
        const patch = { ...st, liquid, locked };
        if (isLoop && tier === "silver") patch.loopSilverToday = st.loopSilverToday + 1;
        if (isLoop && tier === "gold") patch.loopGoldToday = st.loopGoldToday + 1;
        return patch;
      });
      return { ok: true, free: false, betTier: tier, betAmount: amount, fromLocked, note };
    },

    resolveFight({ win, free, betTier, betAmount, fromLocked, isLoop }) {
      const summary = { payout: 0, net: 0, xp: 0, pool: 0, burn: 0, milestone: false, luckyBonus: 0, insuranceUsed: false, betAmount, levelUps: [], rarityUps: [] };
      setG((s) => {
        let { liquid, locked, totalFights, ticketsSilver, ticketsGold } = s;
        const session = { ...s.session };
        const boosts = { ...s.boosts };
        totalFights += 1;
        // milestone
        if (totalFights % D.ECON.MILESTONE_EVERY === 0) {
          locked += D.ECON.MILESTONE_REWARD;
          ticketsSilver += D.ECON.TICKET_SILVER_PER_MS;
          ticketsGold += D.ECON.TICKET_GOLD_PER_MS;
          summary.milestone = true;
        }
        // roster (xp mutates in place; clone array for React)
        const selBeasts = s.selected.map((id) => s.roster.find((b) => b.id === id)).filter(Boolean);

        if (win) {
          session.wins += 1;
          const base = free ? D.ECON.BET.bronze : betAmount;
          const payout = Math.floor(base * D.ECON.PAYOUT_MULT);
          const net = payout - betAmount;
          if (free) locked += payout; else liquid += payout;
          summary.payout = payout; summary.net = net;
          if (!free) session.net += net;
          // lucky strike
          if (boosts.lucky_strike > 0 && Math.random() < 0.25) {
            const bonus = Math.floor(payout * 0.5);
            liquid += bonus; summary.luckyBonus = bonus;
          }
          // xp
          const xpAmt = D.ECON.XP_PER_VICTORY * (boosts.xp_boost > 0 ? 2 : 1);
          summary.xp = xpAmt;
          const events = D.grantXp(selBeasts, xpAmt);
          summary.levelUps = events.filter((e) => e.type === "levelup");
          summary.rarityUps = events.filter((e) => e.type === "rarity_up");
        } else {
          session.losses += 1;
          if (!free && !isLoop && boosts.insurance > 0) {
            if (fromLocked) locked += betAmount; else liquid += betAmount;
            boosts.insurance -= 1;
            summary.insuranceUsed = true;
          } else if (!free) {
            const pool = Math.floor(betAmount * D.ECON.DEFEAT_POOL_RATIO);
            const burn = betAmount - pool;
            summary.pool = pool; summary.burn = burn;
            session.net -= betAmount;
          }
        }
        // decrement timed boosts each fight
        if (boosts.xp_boost > 0) boosts.xp_boost -= 1;
        if (boosts.lucky_strike > 0) boosts.lucky_strike -= 1;

        return { ...s, liquid, locked, totalFights, ticketsSilver, ticketsGold, session, boosts, roster: [...s.roster] };
      });
      return summary;
    },

    buyBoost(key) {
      const s = gRef.current;
      const def = D.BOOSTS[key];
      const spent = spendAny(s, def.cost);
      if (!spent) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, def.cost) };
      setG((st) => {
        const sp = spendAny(st, def.cost);
        if (!sp) return st;
        const boosts = { ...st.boosts };
        boosts[key] += (def.fights || def.charges);
        return { ...st, liquid: sp.liquid, locked: sp.locked, boosts };
      });
      return { ok: true };
    },

    fuse(id1, id2) {
      const s = gRef.current;
      const a = s.roster.find((b) => b.id === id1), b = s.roster.find((b) => b.id === id2);
      if (!a || !b) return { ok: false, reason: I18N.t("FG_PICK2") };
      if (a.rarity === "Legendary") return { ok: false, reason: I18N.t("FG_NOT_FUSABLE") };
      if (a.rarity !== b.rarity) return { ok: false, reason: I18N.t("FG_PICK2") };
      const cost = D.FORGE.FUSION_COST[a.rarity];
      const spent = spendAny(s, cost);
      if (!spent) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      const success = Math.random() < D.FORGE.FUSION_RATE[a.rarity];
      setG((st) => {
        const sp = spendAny(st, cost);
        if (!sp) return st;
        let roster = st.roster.filter((x) => x.id !== id2); // sacrifice consumed
        const prim = roster.find((x) => x.id === id1);
        if (success && prim) D.upgradeRarity(prim);
        roster = [...roster];
        const selected = st.selected.filter((x) => roster.some((r) => r.id === x));
        return { ...st, liquid: sp.liquid, locked: sp.locked, roster, selected };
      });
      return { ok: true, success, result: a };
    },

    reroll(id) {
      const s = gRef.current;
      const beast = s.roster.find((b) => b.id === id);
      if (!beast) return { ok: false, reason: I18N.t("FG_PICK1") };
      const cost = Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count));
      const spent = spendAny(s, cost);
      if (!spent) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      setG((st) => {
        const sp = spendAny(st, cost);
        if (!sp) return st;
        const beast = st.roster.find((b) => b.id === id);
        const keys = ["base_hp", "base_atk", "base_def", "base_spd", "base_mag"];
        const total = keys.reduce((acc, k) => acc + beast[k], 0);
        // jitter then renormalize to preserve total & rough proportions
        const jit = keys.map((k) => beast[k] * (0.7 + Math.random() * 0.6));
        const jitSum = jit.reduce((a, x) => a + x, 0);
        keys.forEach((k, i) => { beast[k] = Math.max(1, Math.round(jit[i] / jitSum * total)); });
        beast.reroll_count += 1;
        return { ...st, liquid: sp.liquid, locked: sp.locked, roster: [...st.roster] };
      });
      return { ok: true };
    },

    summon() {
      const s = gRef.current;
      const cost = D.ECON.MINT_COST;
      const spent = spendAny(s, cost);
      if (!spent) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      const beast = D.mintBeast(D.pick(D.TEMPLATE_KEYS));
      setG((st) => {
        const sp = spendAny(st, cost);
        if (!sp) return st;
        return { ...st, liquid: sp.liquid, locked: sp.locked, roster: [...st.roster, beast] };
      });
      return { ok: true, beast };
    },

    rename(id, name) {
      const s = gRef.current;
      const cost = D.ECON.VANITY_RENAME;
      const spent = spendAny(s, cost);
      if (!spent) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      setG((st) => {
        const sp = spendAny(st, cost);
        if (!sp) return st;
        const beast = st.roster.find((b) => b.id === id);
        if (beast) beast.custom_name = name;
        return { ...st, liquid: sp.liquid, locked: sp.locked, roster: [...st.roster] };
      });
      return { ok: true };
    },
    setTitle(title) {
      const s = gRef.current;
      const cost = D.ECON.VANITY_TITLE;
      const spent = spendAny(s, cost);
      if (!spent) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      setG((st) => {
        const sp = spendAny(st, cost);
        if (!sp) return st;
        return { ...st, liquid: sp.liquid, locked: sp.locked, playerTitle: title };
      });
      return { ok: true };
    },

    deposit(n) { setG((s) => ({ ...s, liquid: s.liquid + n })); return { ok: true }; },
    setOrdinalName(name) { setG((s) => ({ ...s, ordinalName: name })); return { ok: true }; },
    withdraw(n) {
      const s = gRef.current;
      if (n < D.ECON.WITHDRAW_MIN) return { ok: false, reason: I18N.t("WL_WD_MIN", D.ECON.WITHDRAW_MIN) };
      if (n > D.ECON.WITHDRAW_MAX) return { ok: false, reason: I18N.t("WL_WD_MAX", D.ECON.WITHDRAW_MAX) };
      if (n > s.liquid) return { ok: false, reason: I18N.t("WL_WD_INSUFF") };
      setG((st) => ({ ...st, liquid: st.liquid - n }));
      return { ok: true };
    },
  }), []);

  const ctx = { g, actions, toast };

  if (!g.wallet) {
    return (
      <FA_Ctx.Provider value={ctx}>
        <Ambient />
        <Onboarding />
        <Toasts toasts={toasts} />
      </FA_Ctx.Provider>
    );
  }

  const VIEWS = { team: Team, arena: Arena, forge: Forge, wallet: Wallet, boosts: Boosts, perso: Perso, options: Options };
  const View = VIEWS[g.view] || Team;

  return (
    <FA_Ctx.Provider value={ctx}>
      <Ambient />
      <div className="app-shell">
        <Header chipPop={chipPop} />
        <Nav />
        <View />
      </div>
      <Toasts toasts={toasts} />
    </FA_Ctx.Provider>
  );
}

function Ambient() {
  const embers = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 26; i++) {
      arr.push({
        left: Math.random() * 100,
        dur: 7 + Math.random() * 9,
        delay: -Math.random() * 14,
        drift: (Math.random() * 80 - 40) + "px",
        cy: Math.random() < 0.4,
        size: 2 + Math.random() * 2.5,
      });
    }
    return arr;
  }, []);
  return (
    <>
      <div className="app-bg" />
      <div className="embers">
        {embers.map((e, i) => (
          <span key={i} className={cx("ember", e.cy && "cy")} style={{ left: e.left + "%", width: e.size, height: e.size, animationDuration: e.dur + "s", animationDelay: e.delay + "s", "--drift": e.drift }} />
        ))}
      </div>
    </>
  );
}

function Header({ chipPop }) {
  const { g, actions } = useFA();
  return (
    <header className="hdr">
      <img className="hdr-logo" src="assets/LOGO_cut.png" alt="Fractal Arena" />
      <div className="hdr-word">
        <span className="hdr-title">FRACTAL ARENA</span>
        <span className="hdr-sub">FRACTAL BITCOIN · AUTO-BATTLER</span>
      </div>
      <div className="hdr-spacer" />
      <div className="flex gap8 center wrap" style={{ justifyContent: "flex-end" }}>
        <span key={chipPop} className="chip pop"><span className="coin">◎</span> {fmt(g.liquid)}</span>
        {g.locked > 0 && <span className="chip locked"><span className="ico">🔒</span> {fmt(g.locked)} {I18N.t("LOCKED_CHIP")}</span>}
        <div className="lang-switch">
          {[["FR", "FR"], ["EN", "EN"], ["ZH", "中文"]].map(([code, lbl]) => (
            <button key={code} className={g.lang === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
          ))}
        </div>
      </div>
    </header>
  );
}

function Nav() {
  const { g, actions } = useFA();
  const tabs = [
    ["team", "NAV_TEAM"], ["arena", "NAV_ARENA"], ["forge", "NAV_FORGE"],
    ["wallet", "NAV_WALLET"], ["boosts", "NAV_BOOSTS"], ["perso", "NAV_PERSO"], ["options", "NAV_OPTIONS"],
  ];
  return (
    <nav className="nav">
      {tabs.map(([k, key]) => (
        <button key={k} className={cx("nav-tab", g.view === k && "on")} onClick={() => actions.setView(k)}>
          {I18N.t(key)}
        </button>
      ))}
    </nav>
  );
}

function Onboarding() {
  const { actions, toast } = useFA();
  const [addr, setAddr] = useState("");
  const [checking, setChecking] = useState(false);
  function connect() {
    const a = addr.trim();
    if (a.length < 20 || !/^bc1/i.test(a)) { toast(I18N.t("OB_INVALID"), "bad"); return; }
    setChecking(true);
    setTimeout(() => { actions.connectWallet(a); }, 1100);
  }
  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", maxWidth: 540, padding: 28, position: "relative" }}>
        <div className="ob-logo" style={{ position: "relative", width: 168, height: 168, margin: "0 auto 26px", animation: "obFloat 4.5s ease-in-out infinite" }}>
          <img src="assets/LOGO_cut.png" alt="Fractal Arena" style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(247,147,26,0.35))" }} />
        </div>
        <div className="eyebrow">{I18N.t("OB_TAG")}</div>
        <div className="hdr-title" style={{ fontSize: 40, letterSpacing: 6, display: "block", margin: "8px 0 18px" }}>FRACTAL ARENA</div>
        <div className="h2" style={{ fontSize: 18, marginBottom: 8 }}>{I18N.t("OB_CONNECT")}</div>
        <div className="muted mono" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>{I18N.t("OB_SUB")}</div>
        <input className="field" style={{ textAlign: "center", marginBottom: 14 }} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={I18N.t("OB_PLACEHOLDER")} onKeyDown={(e) => e.key === "Enter" && connect()} />
        <button className="btn btn-fire block lg" disabled={checking} onClick={connect}>{checking ? I18N.t("OB_CHECKING") : I18N.t("OB_BTN")}</button>
        <div className="pill" style={{ marginTop: 18, color: "var(--gold)", borderColor: "rgba(255,230,0,0.3)" }}>🎁 {I18N.t("OB_GIFT")}</div>
        <div className="lang-switch" style={{ margin: "16px auto 0", width: "fit-content" }}>
          {[["FR", "Français"], ["EN", "English"], ["ZH", "中文"]].map(([code, lbl]) => (
            <button key={code} className={I18N.getLang() === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => <div key={t.id} className={cx("toast", t.kind)}>{t.msg}</div>)}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
