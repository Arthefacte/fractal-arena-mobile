/* ============================================================
   FRACTAL ARENA — Team / Forge / Boosts / Wallet / Perso / Options
   ============================================================ */
const { useState, useEffect, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, presetLabel, rarityLabel, Bar, StatGrid, CreatureCard, Modal, SectionHead, MiniStats } = window;

/* ---------------- TEAM ---------------- */
function Team() {
  const { g, actions, toast } = useFA();
  const sorted = useMemo(() => {
    return g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity] || b.level - a.level);
  }, [g.roster]);
  const selCount = g.selected.length;

  function toggle(b) {
    if (g.selected.includes(b.id)) actions.toggleSelect(b.id);
    else if (selCount >= 3) toast(I18N.t("TEAM_FULL"), "bad");
    else actions.toggleSelect(b.id);
  }

  return (
    <div className="container">
      <div className="flex between center wrap" style={{ marginBottom: 22, gap: 12 }}>
        <div>
          <div className="eyebrow">{I18N.t("TEAM_COUNT", g.roster.length)}</div>
          <div className="h1" style={{ marginBottom: 0 }}>{I18N.t("TEAM_TITLE")}</div>
          <div className="muted mono" style={{ fontSize: 13, marginTop: 4 }}>{I18N.t("TEAM_HINT")}</div>
        </div>
        <div className="flex gap12 center">
          <span className="pill" style={{ color: selCount === 3 ? "var(--success)" : "var(--text-dim)", fontSize: 13 }}>{I18N.t("TEAM_SELECTED", selCount)}</span>
          <button className="btn btn-elec lg" disabled={selCount !== 3} onClick={() => actions.setView("arena")}>{I18N.t("TEAM_ENTER")} →</button>
        </div>
      </div>
      <div className="grid-cards">
        {sorted.map((b) => (
          <CreatureCard key={b.id} beast={b} selectable selected={g.selected.includes(b.id)} onClick={() => toggle(b)} showXp />
        ))}
      </div>
    </div>
  );
}

/* ---------------- FORGE ---------------- */
function Forge() {
  const { g, actions, toast } = useFA();
  const [tab, setTab] = useState("fusion");
  const tabs = [{ k: "fusion", c: "var(--forge)" }, { k: "reroll", c: "var(--elec)" }, { k: "summon", c: "var(--fire)" }];
  return (
    <div className="container">
      <SectionHead eyebrow={I18N.t("FG_SUB")} title={I18N.t("FG_TITLE")} />
      <div className="subtabs">
        {tabs.map((t) => (
          <button key={t.k} className={cx("subtab", tab === t.k && "on")} style={{ "--c": t.c }} onClick={() => setTab(t.k)}>
            {I18N.t("FG_" + t.k.toUpperCase())}
          </button>
        ))}
      </div>
      {tab === "fusion" && <ForgeFusion />}
      {tab === "reroll" && <ForgeReroll />}
      {tab === "summon" && <ForgeSummon />}
    </div>
  );
}

function ForgeFusion() {
  const { g, actions, toast } = useFA();
  const [sel, setSel] = useState([]);
  const elig = g.roster.filter((b) => b.rarity !== "Legendary");
  const sorted = elig.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]);
  const first = sel[0] ? g.roster.find((b) => b.id === sel[0]) : null;

  function clickable(b) {
    if (!first) return true;
    if (b.id === first.id) return true;
    return b.rarity === first.rarity;
  }
  function toggle(b) {
    if (sel.includes(b.id)) setSel(sel.filter((x) => x !== b.id));
    else if (sel.length < 2 && clickable(b)) setSel([...sel, b.id]);
  }
  function doFuse() {
    const r = actions.fuse(sel[0], sel[1]);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    if (r.success) toast(I18N.t("FG_FUSE_OK", rarityLabel(r.result.rarity)), "good");
    else toast(I18N.t("FG_FUSE_FAIL"), "bad");
    setSel([]);
  }
  const cost = first ? D.FORGE.FUSION_COST[first.rarity] : 0;
  const rate = first ? D.FORGE.FUSION_RATE[first.rarity] : 0;
  const canFuse = sel.length === 2;
  const balOk = (g.liquid + g.locked) >= cost;

  return (
    <div>
      <div className="flex between center wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div className="mono muted" style={{ fontSize: 13 }}>{first ? I18N.t("FG_PICK_SAME", rarityLabel(first.rarity)) : I18N.t("FG_FUSION_HINT")}</div>
        {canFuse && (
          <div className="flex gap12 center">
            <span className="pill" style={{ color: "var(--elec)" }}>{I18N.t("FG_SUCCESS_RATE")} {Math.round(rate * 100)}%</span>
            <button className="btn btn-forge" disabled={!balOk} onClick={doFuse}>{I18N.t("FG_FUSE_BTN", cost)}</button>
          </div>
        )}
      </div>
      {!balOk && canFuse && <div className="mono" style={{ color: "var(--alert)", fontSize: 12, marginBottom: 10 }}>{I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)}</div>}
      <div className="grid-cards">
        {sorted.map((b) => (
          <div key={b.id} style={{ opacity: clickable(b) ? 1 : 0.32, pointerEvents: clickable(b) ? "auto" : "none", transition: "opacity .2s" }}>
            <CreatureCard beast={b} selectable selected={sel.includes(b.id)} onClick={() => toggle(b)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ForgeReroll() {
  const { g, actions, toast } = useFA();
  const [sel, setSel] = useState(null);
  const beast = sel ? g.roster.find((b) => b.id === sel) : null;
  const cost = beast ? Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count)) : 0;
  const balOk = (g.liquid + g.locked) >= cost;
  function doReroll() {
    const r = actions.reroll(sel);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("FG_REROLL_OK"), "good");
  }
  return (
    <div>
      <div className="flex between center wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div className="mono muted" style={{ fontSize: 13 }}>{I18N.t("FG_REROLL_HINT")}</div>
        {beast && (
          <div className="flex gap12 center">
            <span className="pill">reroll #{beast.reroll_count + 1}</span>
            <button className="btn btn-elec" disabled={!balOk} onClick={doReroll}>{I18N.t("FG_REROLL_BTN", cost)}</button>
          </div>
        )}
      </div>
      {!balOk && beast && <div className="mono" style={{ color: "var(--alert)", fontSize: 12, marginBottom: 10 }}>{I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)}</div>}
      <div className="grid-cards">
        {g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]).map((b) => (
          <CreatureCard key={b.id} beast={b} selectable selected={sel === b.id} onClick={() => setSel(sel === b.id ? null : b.id)} />
        ))}
      </div>
    </div>
  );
}

function ForgeSummon() {
  const { g, actions, toast } = useFA();
  const [last, setLast] = useState(null);
  const [rolling, setRolling] = useState(false);
  const cost = D.ECON.MINT_COST;
  const balOk = (g.liquid + g.locked) >= cost;
  function doSummon() {
    if (!balOk) { toast(I18N.t("INSUFFICIENT", g.liquid + g.locked, cost), "bad"); return; }
    setRolling(true); setLast(null);
    setTimeout(() => {
      const r = actions.summon();
      setRolling(false);
      if (!r.ok) { toast(r.reason, "bad"); return; }
      setLast(r.beast);
      toast(I18N.t("FG_SUMMON_OK", D.displayName(r.beast), rarityLabel(r.beast.rarity)), "good");
    }, 700);
  }
  const odds = [["Common", 70], ["Rare", 20], ["Epic", 8], ["Legendary", 2]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 26, alignItems: "start" }} className="summon-grid">
      <div>
        <div className="mono muted" style={{ fontSize: 13, marginBottom: 16 }}>{I18N.t("FG_SUMMON_HINT")}</div>
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {odds.map(([r, p]) => (
              <div key={r} className="flex between center">
                <span className="flex center gap8"><span style={{ width: 10, height: 10, background: D.RARITY_COLORS[r], display: "inline-block", clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} /><span style={{ color: D.RARITY_COLORS[r], fontWeight: 600 }}>{rarityLabel(r)}</span></span>
                <span className="mono" style={{ color: "var(--text-dim)" }}>{p}%</span>
              </div>
            ))}
          </div>
          <div className="divider" />
          <button className="btn btn-fire block lg" disabled={!balOk || rolling} onClick={doSummon}>{rolling ? "…" : I18N.t("FG_SUMMON_BTN", cost)}</button>
        </div>
      </div>
      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 18, minHeight: 300, display: "grid", placeItems: "center" }}>
        {rolling ? (
          <div className="mono" style={{ color: "var(--fire)", fontSize: 13, letterSpacing: 2 }}>FORGING…</div>
        ) : last ? (
          <div style={{ width: "100%" }}>
            <div className="eyebrow" style={{ textAlign: "center", marginBottom: 10, color: D.RARITY_COLORS[last.rarity] }}>{I18N.t("MINT_TITLE") || "FORGED"}</div>
            <CreatureCard beast={last} />
          </div>
        ) : (
          <div className="mono" style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center" }}>⬡<br />{I18N.t("FG_SUMMON")}</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- BOOSTS ---------------- */
function Boosts() {
  const { g, actions, toast } = useFA();
  const items = [
    { key: "xp_boost", name: I18N.t("BO_XP_NAME"), desc: I18N.t("BO_XP_DESC"), color: "var(--gold)", remaining: g.boosts.xp_boost, unit: "fights" },
    { key: "insurance", name: I18N.t("BO_INS_NAME"), desc: I18N.t("BO_INS_DESC"), color: "var(--success)", remaining: g.boosts.insurance, unit: "charges" },
    { key: "lucky_strike", name: I18N.t("BO_LUCKY_NAME"), desc: I18N.t("BO_LUCKY_DESC"), color: "var(--fire)", remaining: g.boosts.lucky_strike, unit: "fights" },
  ];
  function buy(key) {
    const r = actions.buyBoost(key);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("BO_BOUGHT"), "good");
  }
  return (
    <div className="container">
      <SectionHead eyebrow={I18N.t("BO_SUB")} title={I18N.t("BO_TITLE")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        {items.map((it) => {
          const def = D.BOOSTS[it.key];
          const active = it.remaining > 0;
          return (
            <div key={it.key} className="panel oct" style={{ border: `1px solid ${active ? it.color : "var(--line)"}`, padding: 20, display: "flex", flexDirection: "column", gap: 12, boxShadow: active ? `0 0 24px color-mix(in srgb, ${it.color} 22%, transparent)` : "none" }}>
              <div className="flex between center">
                <span className="h2" style={{ color: it.color, fontSize: 17 }}>{it.name}</span>
                {active && <span className="pill" style={{ color: it.color, borderColor: it.color }}>{I18N.t("BO_ACTIVE", it.remaining)}</span>}
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, minHeight: 56 }}>{it.desc}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{it.unit === "fights" ? `${def.fights || def.charges} combats` : `${def.charges} charges`}</div>
              <button className="btn block" style={{ "--c": it.color, marginTop: "auto" }} onClick={() => buy(it.key)}>{I18N.t("BO_BUY", def.cost)}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- WALLET ---------------- */
function Wallet() {
  const { g, actions, toast } = useFA();
  const [modal, setModal] = useState(null);
  return (
    <div className="container">
      <SectionHead eyebrow="FRACTALARENA" title={I18N.t("WL_TITLE")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="wallet-grid">
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>{I18N.t("WL_LIQUID")}</div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, color: "var(--gold)", margin: "6px 0" }}>{fmt(g.liquid)}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>{I18N.t("WL_LIQUID_DESC")}</div>
        </div>
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div className="eyebrow" style={{ color: "var(--fire)" }}>{I18N.t("WL_LOCKED")}</div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, color: "var(--fire)", margin: "6px 0" }}>{fmt(g.locked)}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>{I18N.t("WL_LOCKED_DESC")}</div>
        </div>
      </div>
      <div className="flex gap16" style={{ marginTop: 18 }}>
        <button className="btn btn-elec lg" style={{ flex: 1 }} onClick={() => setModal("deposit")}>↓ {I18N.t("WL_DEPOSIT")}</button>
        <button className="btn btn-gold lg" style={{ flex: 1 }} onClick={() => setModal("withdraw")}>↑ {I18N.t("WL_WITHDRAW")}</button>
      </div>

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} />}
      {modal === "withdraw" && <WithdrawModal onClose={() => setModal(null)} />}
    </div>
  );
}

function CopyAddr({ addr }) {
  const { toast } = useFA();
  const [done, setDone] = useState(false);
  return (
    <button className="btn ghost sm" onClick={() => {
      navigator.clipboard && navigator.clipboard.writeText(addr).catch(() => { });
      setDone(true); toast(I18N.t("WL_COPIED"), "good"); setTimeout(() => setDone(false), 1500);
    }}>
      <span className="mono" style={{ fontSize: 11 }}>{addr.slice(0, 8)}…{addr.slice(-6)}</span> · {done ? I18N.t("WL_COPIED") : I18N.t("WL_COPY")}
    </button>
  );
}

function DepositModal({ onClose }) {
  const { actions, toast } = useFA();
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  function go() {
    const tx = txid.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(tx)) { toast(I18N.t("WL_DEP_TXID_INVALID"), "bad"); return; }
    setBusy(true);
    setTimeout(() => {
      // simulate reading the deposited amount from the on-chain transaction
      let h = 0;
      for (let i = 0; i < tx.length; i++) h = (h * 31 + tx.charCodeAt(i)) >>> 0;
      const detected = D.ECON.DEPOSIT_MIN + (h % 50) * 100; // 100 → 5000, derived from txid
      actions.deposit(detected);
      setBusy(false);
      toast(I18N.t("WL_DEP_OK", detected), "good");
      onClose();
    }, 1600);
  }
  return (
    <Modal onClose={onClose} accent="var(--elec)">
      <div className="eyebrow" style={{ color: "var(--elec)" }}>{I18N.t("WL_DEPOSIT")}</div>
      <div className="h2" style={{ margin: "4px 0 10px" }}>{I18N.t("WL_DEP_TXID")}</div>
      <div className="muted mono" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{I18N.t("WL_DEP_INFO")}</div>
      <div className="mono" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16, color: "var(--elec)", background: "rgba(0,0,0,0.25)", border: "1px solid var(--elec)", borderRadius: 6, padding: "10px 12px" }}>{I18N.t("WL_DEP_CONFIRMS")}</div>
      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: "12px 14px", marginBottom: 16 }}>
        <div className="flex between center" style={{ gap: 10 }}>
          <span className="mono muted" style={{ fontSize: 12 }}>{I18N.t("WL_REWARD_POOL")}</span>
          <CopyAddr addr="bc1qhgnfujw5f6r0hct45vmrrwuyrkh4u8npjn0p4s" />
        </div>
      </div>
      <input className="field" style={{ fontSize: 12 }} value={txid} onChange={(e) => setTxid(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 64))} placeholder={I18N.t("WL_DEP_TXID_PH")} />
      <button className="btn btn-elec block lg" style={{ marginTop: 18 }} disabled={busy} onClick={go}>{busy ? I18N.t("WL_DEP_DETECT") : I18N.t("WL_DEP_SEND")}</button>
    </Modal>
  );
}

function WithdrawModal({ onClose }) {
  const { g, actions, toast } = useFA();
  const [amt, setAmt] = useState("500");
  const [busy, setBusy] = useState(false);
  function go() {
    const n = parseInt(amt, 10) || 0;
    const r = actions.withdraw(n);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    setBusy(true);
    setTimeout(() => { setBusy(false); toast(I18N.t("WL_WD_OK", n), "good"); onClose(); }, 1500);
  }
  return (
    <Modal onClose={onClose} accent="var(--gold)">
      <div className="eyebrow" style={{ color: "var(--gold)" }}>{I18N.t("WL_WITHDRAW")}</div>
      <div className="h2" style={{ margin: "4px 0 10px" }}>{I18N.t("WL_LIQUID")} : <span className="mono" style={{ color: "var(--gold)" }}>{fmt(g.liquid)}</span></div>
      <div className="muted mono" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>{I18N.t("WL_WD_INFO")}</div>
      <input className="field" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9]/g, ""))} placeholder="500" />
      <button className="btn btn-gold block lg" style={{ marginTop: 18 }} disabled={busy} onClick={go}>{busy ? I18N.t("WL_WD_PROC") : I18N.t("WL_WD_SEND")}</button>
    </Modal>
  );
}

/* ---------------- PERSO / VANITY ---------------- */
function Perso() {
  const { g, actions, toast } = useFA();
  const [tab, setTab] = useState("rename");
  const [sel, setSel] = useState(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState(g.playerTitle || "");

  function doRename() {
    if (!sel || !name.trim()) return;
    const r = actions.rename(sel, name.trim().slice(0, 24));
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("PE_RENAMED"), "good"); setName("");
  }
  function doTitle() {
    if (!title.trim()) return;
    const r = actions.setTitle(title.trim().slice(0, 32));
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("PE_TITLE_SET"), "good");
  }
  return (
    <div className="container">
      <SectionHead eyebrow="VANITY SINK" title={I18N.t("PE_TITLE")} />
      <div className="subtabs">
        <button className={cx("subtab", tab === "rename" && "on")} style={{ "--c": "var(--elec)" }} onClick={() => setTab("rename")}>{I18N.t("PE_RENAME")}</button>
        <button className={cx("subtab", tab === "title" && "on")} style={{ "--c": "var(--fire)" }} onClick={() => setTab("title")}>{I18N.t("PE_TITLE_TAB")}</button>
      </div>
      {tab === "rename" ? (
        <div>
          <div className="flex gap12 center wrap" style={{ marginBottom: 16 }}>
            <input className="field" style={{ flex: 1, minWidth: 200 }} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder={I18N.t("PE_NEW_NAME")} />
            <button className="btn btn-elec" disabled={!sel || !name.trim()} onClick={doRename}>{I18N.t("PE_RENAME_BTN", D.ECON.VANITY_RENAME)}</button>
          </div>
          {!sel && <div className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>{I18N.t("PE_PICK")}</div>}
          <div className="grid-cards">
            {g.roster.map((b) => (
              <CreatureCard key={b.id} beast={b} selectable selected={sel === b.id} onClick={() => setSel(sel === b.id ? null : b.id)} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
            <div className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>{I18N.t("PE_NEW_TITLE")}</div>
            <input className="field" maxLength={32} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Whale · Diamond Hands · …" />
            <button className="btn btn-fire block" style={{ marginTop: 16 }} disabled={!title.trim()} onClick={doTitle}>{I18N.t("PE_TITLE_BTN", D.ECON.VANITY_TITLE)}</button>
          </div>
          <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginTop: 16 }}>
            <div className="flex between center">
              <span className="h2" style={{ fontSize: 15, color: g.holderDays >= 360 ? "var(--fire)" : "var(--text)" }}>✦ {I18N.t("PE_BADGE")}</span>
              <span className="pill">{Math.min(360, g.holderDays)}/360</span>
            </div>
            <div className="muted mono" style={{ fontSize: 12, marginTop: 8 }}>{I18N.t("PE_BADGE_DESC", g.holderDays)}</div>
            <Bar frac={g.holderDays / 360} kind="xp" className="" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- OPTIONS ---------------- */
function Options() {
  const { g, actions, toast } = useFA();
  const [scanState, setScanState] = useState("idle"); // idle | scanning | done
  const [found, setFound] = useState([]);
  const [query, setQuery] = useState("");
  const langs = [["FR", "Français"], ["EN", "English"], ["ZH", "中文"]];

  function scan() {
    setScanState("scanning");
    setFound([]);
    setQuery("");
    setTimeout(() => {
      setFound(D.walletNameInscriptions(g.wallet));
      setScanState("done");
    }, 1300);
  }
  function selectName(name) {
    actions.setOrdinalName(name);
    toast(I18N.t("OP_ORDINAL_SELECTED"), "good");
  }
  function useAddress() {
    actions.setOrdinalName("");
    toast(I18N.t("OP_ORDINAL_CLEARED"), "info");
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? found.filter((ins) => ins.name.toLowerCase().includes(q)) : found;

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <SectionHead title={I18N.t("OP_TITLE")} />

      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginBottom: 16 }}>
        <div className="eyebrow" style={{ color: "var(--fire)", marginBottom: 12 }}>{I18N.t("OP_PROFILE")}</div>

        <div className="flex between center" style={{ marginBottom: 6 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("OP_ORDINAL")}</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: g.ordinalName ? "var(--elec)" : "var(--text-faint)" }}>
            {g.ordinalName || (g.wallet ? (g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4)) : "—")}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 14 }}>{I18N.t("OP_ORDINAL_HINT")}</div>

        {scanState === "idle" && (
          <button className="btn btn-elec block" onClick={scan}>⌕ {I18N.t("OP_ORDINAL_SCAN")}</button>
        )}
        {scanState === "scanning" && (
          <div className="mono" style={{ fontSize: 12, color: "var(--elec)", textAlign: "center", padding: "14px 0", letterSpacing: 1 }}>
            ⌕ {I18N.t("OP_ORDINAL_SCANNING")}
          </div>
        )}
        {scanState === "done" && (
          <div>
            <div className="flex between center" style={{ marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {found.length ? I18N.t("OP_ORDINAL_FOUND", found.length) : I18N.t("OP_ORDINAL_NONE")}
              </span>
              <button className="btn ghost sm" style={{ padding: "3px 9px" }} onClick={scan}>↻ {I18N.t("OP_ORDINAL_RESCAN")}</button>
            </div>

            {found.length > 8 && (
              <div className="flex between center" style={{ gap: 10, marginBottom: 10 }}>
                <input className="field" style={{ flex: 1, fontSize: 12, padding: "9px 12px" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={I18N.t("OP_ORDINAL_SEARCH")} />
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{I18N.t("OP_ORDINAL_SHOWING", filtered.length, found.length)}</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: found.length > 6 ? 290 : "none", overflowY: found.length > 6 ? "auto" : "visible", paddingRight: found.length > 6 ? 4 : 0, scrollbarWidth: "thin", scrollbarColor: "var(--line) transparent" }}>
              {filtered.length === 0 && (
                <div className="mono" style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", padding: "12px 0" }}>{I18N.t("OP_ORDINAL_NOMATCH")}</div>
              )}
              {filtered.map((ins) => {
                const sel = g.ordinalName === ins.name;
                return (
                  <button key={ins.name} onClick={() => selectName(ins.name)} className="oct-sm" style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    textAlign: "left", padding: "11px 14px", cursor: "pointer", flex: "none",
                    background: sel ? "color-mix(in srgb, var(--elec) 14%, var(--bg-panel))" : "rgba(255,255,255,0.022)",
                    border: `1px solid ${sel ? "var(--elec)" : "var(--line)"}`,
                    boxShadow: sel ? "0 0 18px color-mix(in srgb, var(--elec) 25%, transparent)" : "none",
                  }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: sel ? "var(--elec)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ins.name}</span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{I18N.t("OP_ORDINAL_INSCR")} #{ins.number} · {ins.sats} sats</span>
                    </span>
                    <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", border: `1px solid ${sel ? "var(--elec)" : "var(--line)"}`, background: sel ? "var(--elec)" : "transparent", color: "#06101a", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{sel ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>

            <button onClick={useAddress} className="oct-sm" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%",
              textAlign: "left", padding: "11px 14px", cursor: "pointer", marginTop: 8,
              background: !g.ordinalName ? "color-mix(in srgb, var(--text-dim) 14%, var(--bg-panel))" : "rgba(255,255,255,0.022)",
              border: `1px solid ${!g.ordinalName ? "var(--text-dim)" : "var(--line)"}`,
            }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("OP_ORDINAL_USE_ADDR")}</span>
              <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", border: `1px solid ${!g.ordinalName ? "var(--text-dim)" : "var(--line)"}`, background: !g.ordinalName ? "var(--text-dim)" : "transparent", color: "#06101a", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{!g.ordinalName ? "✓" : ""}</span>
            </button>
          </div>
        )}

        <div className="flex between center" style={{ gap: 14, borderTop: "1px solid var(--line-soft)", paddingTop: 12, marginTop: 14 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("OP_WALLET_ADDR")}</span>
          {g.wallet ? <CopyAddr addr={g.wallet} /> : <span className="mono muted" style={{ fontSize: 12 }}>—</span>}
        </div>
      </div>

      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
        <Row label={I18N.t("OP_LANG")}>
          <div className="lang-switch">
            {langs.map(([code, lbl]) => (
              <button key={code} className={g.lang === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
            ))}
          </div>
        </Row>
        <Row label={I18N.t("OP_ANIM")}>
          <Toggle on={g.options.anim} onClick={() => actions.setOption("anim", !g.options.anim)} />
        </Row>
        <Row label={I18N.t("OP_SOUND")}>
          <Toggle on={g.options.sound} onClick={() => actions.setOption("sound", !g.options.sound)} />
        </Row>
      </div>
      <div className="flex gap12" style={{ marginTop: 18 }}>
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => { actions.disconnect(); }}>{I18N.t("OP_DISCONNECT")}</button>
      </div>
    </div>
  );
}
function Row({ label, children }) {
  return (
    <div className="flex between center" style={{ gap: 16 }}>
      <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>{label}</span>
      {children}
    </div>
  );
}
function Toggle({ on, onClick }) {
  return (
    <span onClick={onClick} style={{ cursor: "pointer", width: 46, height: 24, background: on ? "var(--elec)" : "#1a2238", position: "relative", borderRadius: 12, transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </span>
  );
}

Object.assign(window, { Team, Forge, Boosts, Wallet, Perso, Options });
