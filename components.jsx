/* ============================================================
   FRACTAL ARENA — shared components + context
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;
const D = window.FA_DATA;
const I18N = window.FA_I18N;

const FA_Ctx = createContext(null);
const useFA = () => useContext(FA_Ctx);

function cx(...a) { return a.filter(Boolean).join(" "); }
function fmt(n) { return (n | 0).toLocaleString("en-US").replace(/,/g, " "); }
function presetLabel(p) { return I18N.t(p); }
function rarityLabel(r) { return I18N.t(r); }

// Small ◎ coin glyph
function Coin({ c }) {
  return <span style={{ color: c || "var(--gold)", fontWeight: 700 }}>◎</span>;
}

function Bar({ frac, kind, className }) {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  let mod = "";
  if (kind === "hp") { if (pct < 30) mod = "low"; else if (pct < 60) mod = "mid"; }
  return (
    <div className={cx("bar", kind, mod, className)}>
      <i style={{ width: pct + "%" }} />
    </div>
  );
}

function StatGrid({ beast, compact }) {
  const stats = [
    ["HP", D.eff(beast, "hp")],
    ["ATK", D.eff(beast, "atk")],
    ["DEF", D.eff(beast, "def")],
    ["SPD", D.eff(beast, "spd")],
    ["MAG", D.eff(beast, "mag")],
  ];
  const show = compact ? stats.slice(1) : stats;
  return (
    <div className="stat-row">
      {show.map(([k, v]) => (
        <div className="stat" key={k}>
          <div className="k">{k}</div>
          <div className="v" style={{ color: k === "HP" ? "var(--success)" : "var(--text)" }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// Collection / selection card
function CreatureCard({ beast, selected, onClick, selectable, showXp, badge }) {
  const rc = D.RARITY_COLORS[beast.rarity];
  const pc = D.PRESET_COLORS[beast.preset];
  const xpMax = D.xpToNext(beast);
  return (
    <div
      className={cx("card", selectable && "selectable", selected && "sel")}
      style={{ "--rc": rc }}
      onClick={onClick}
    >
      <div className="art">
        <img src={D.ART[beast.image_key]} alt={beast.name} draggable="false" />
        <div className="rar-tag">{rarityLabel(beast.rarity)}</div>
        <div className="lvl-tag">LV {beast.level}</div>
        {selectable && <div className="sel-check">✓</div>}
        {badge}
      </div>
      <div className="body">
        <div className="flex between center" style={{ gap: 6 }}>
          <div className="cname" title={D.displayName(beast)}>{D.displayName(beast)}</div>
        </div>
        <div className="cpreset" style={{ color: pc }}>{presetLabel(beast.preset)}</div>
        <StatGrid beast={beast} compact />
        {showXp && (
          <div style={{ marginTop: 9 }}>
            <div className="bar-label"><span>XP</span><span>{beast.xp}/{xpMax}</span></div>
            <Bar frac={beast.xp / xpMax} kind="xp" />
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ children, onClose, wide, accent }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={cx("modal", wide && "wide")} style={accent ? { borderColor: accent } : null}>
        {onClose && (
          <button className="btn ghost sm" style={{ position: "absolute", top: 14, right: 14, padding: "5px 10px" }} onClick={onClose}>✕</button>
        )}
        {children}
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="h1">{title}</div>
      {sub && <div className="muted mono" style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Stat bars used in forge preview
function MiniStats({ beast }) {
  const rows = [["HP", D.eff(beast, "hp")], ["ATK", D.eff(beast, "atk")], ["DEF", D.eff(beast, "def")], ["SPD", D.eff(beast, "spd")], ["MAG", D.eff(beast, "mag")]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex center" style={{ gap: 8 }}>
          <span className="mono" style={{ width: 34, fontSize: 11, color: "var(--text-dim)" }}>{k}</span>
          <div className="bar" style={{ flex: 1, height: 6 }}><i style={{ width: Math.min(100, v / 2.2) + "%", background: "linear-gradient(90deg,var(--elec),#7af6ff)" }} /></div>
          <span className="mono" style={{ width: 34, fontSize: 12, textAlign: "right", fontWeight: 700 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { FA_Ctx, useFA, cx, fmt, presetLabel, rarityLabel, Coin, Bar, StatGrid, CreatureCard, Modal, SectionHead, MiniStats });
