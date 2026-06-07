/* ============================================================
   FRACTAL ARENA — Combat engine (auto, faithful)
   Produces a timed event stream the UI replays.
   ============================================================ */
(function () {
  "use strict";
  const D = window.FA_DATA;
  const ROUND_CAP = 22;
  const CRIT_CHANCE = 0.12;
  const CRIT_MULT = 1.6;
  const SPECIAL_MISS = 0.4;
  const RAGE_PER_ROUND = 0.16;

  function eff(b, k) { return Math.floor(b["base_" + k] * (1 + 0.03 * (b.level - 1))); }

  // ---- live combatant from a beast ----
  function toUnit(beast, side, idx) {
    return {
      ref: beast, side, idx,
      name: D.displayName(beast),
      preset: beast.preset,
      rarity: beast.rarity,
      image_key: beast.image_key,
      level: beast.level,
      maxHp: eff(beast, "hp"),
      hp: eff(beast, "hp"),
      atk: eff(beast, "atk"),
      def: eff(beast, "def"),
      spd: eff(beast, "spd"),
      mag: eff(beast, "mag"),
      alive: true,
    };
  }
  function alive(team) { return team.filter((u) => u.alive); }

  function snapshot(p1, p2) {
    return {
      p1: p1.map((u) => ({ hp: u.hp, maxHp: u.maxHp, alive: u.alive })),
      p2: p2.map((u) => ({ hp: u.hp, maxHp: u.maxHp, alive: u.alive })),
    };
  }

  // ---- targeting ----
  function chooseTarget(unit, oppTeam) {
    const live = alive(oppTeam);
    if (!live.length) return null;
    // finish rule: any enemy under 32% HP → finish lowest
    const wounded = live.filter((u) => u.hp / u.maxHp < 0.32);
    if (wounded.length) {
      return wounded.reduce((a, b) => (b.hp < a.hp ? b : a));
    }
    // preset preference
    const byMax = (k) => live.reduce((a, b) => (b[k] > a[k] ? b : a));
    const byMinHp = () => live.reduce((a, b) => (b.hp < a.hp ? b : a));
    switch (unit.preset) {
      case "aggressive": return byMax("maxHp");
      case "berserker": return byMax("maxHp");
      case "controller": return byMax("spd");
      case "sniper": return byMax("mag");
      case "tactician": return byMinHp();
      case "lifesteal": return byMinHp();
      default: {
        // weighted random favoring wounded
        const weights = live.map((u) => 1 + (1 - u.hp / u.maxHp) * 2);
        let r = Math.random() * weights.reduce((s, w) => s + w, 0);
        for (let i = 0; i < live.length; i++) { r -= weights[i]; if (r <= 0) return live[i]; }
        return live[0];
      }
    }
  }
  function useSpecial(unit, target) {
    switch (unit.preset) {
      case "aggressive": case "controller": case "sniper": return true;
      case "berserker": case "lifesteal": return false;
      case "tactician": {
        const md = unit.mag * 1.5 - target.def * 0.5;
        const ad = unit.atk - target.def * 0.5;
        return md > ad;
      }
      default: return false;
    }
  }
  function mostWoundedAlly(unit, myTeam) {
    const live = alive(myTeam);
    let best = null, bestR = 2;
    for (const u of live) {
      const r = u.hp / u.maxHp;
      if (r < bestR) { bestR = r; best = u; }
    }
    return best && best.hp < best.maxHp ? best : (live.find((u) => u !== unit) || unit);
  }

  // ---- full visual battle ----
  function runBattle(playerBeasts, enemyBeasts) {
    const p1 = playerBeasts.map((b, i) => toUnit(b, "p1", i));
    const p2 = enemyBeasts.map((b, i) => toUnit(b, "p2", i));
    const events = [];
    let cumP1 = 0, cumP2 = 0;
    let round = 0;
    let winner = null;

    function teamAlive(t) { return t.some((u) => u.alive); }
    function hpFrac(t) { return t.reduce((s, u) => s + Math.max(0, u.hp) / u.maxHp, 0); }

    while (round < ROUND_CAP) {
      if (!teamAlive(p1)) { winner = "p2"; break; }
      if (!teamAlive(p2)) { winner = "p1"; break; }
      round++;
      const rageMult = 1 + RAGE_PER_ROUND * (round - 1);
      const lifeDecay = Math.max(0.4, 1 - 0.04 * (round - 1));

      events.push({ t: "round", round, state: snapshot(p1, p2) });

      // order by SPD desc with random tiebreak
      const order = alive(p1).concat(alive(p2));
      order.forEach((u) => (u._roll = Math.random()));
      order.sort((a, b) => (b.spd - a.spd) || (b._roll - a._roll));

      for (const unit of order) {
        if (!unit.alive) continue;
        const myTeam = unit.side === "p1" ? p1 : p2;
        const oppTeam = unit.side === "p1" ? p2 : p1;
        if (!teamAlive(oppTeam)) break;
        let target = chooseTarget(unit, oppTeam);
        if (!target) continue;

        const special = useSpecial(unit, target);
        let dmg = 0, kind = "atk", crit = false, missed = false;

        if (special) {
          if (Math.random() < SPECIAL_MISS) {
            missed = true;
            events.push({ t: "miss", side: unit.side, idx: unit.idx, name: unit.name, state: snapshot(p1, p2) });
          } else {
            const base = unit.mag * 1.5 * D.rand(1.0, 1.34);
            crit = Math.random() < CRIT_CHANCE;
            dmg = Math.max(1, Math.round((base - target.def * 0.5) * rageMult * (crit ? CRIT_MULT : 1)));
            kind = "sp";
          }
        } else {
          const base = unit.atk * D.rand(1.0, 1.34);
          crit = Math.random() < CRIT_CHANCE;
          dmg = Math.max(1, Math.round((base - target.def * 0.5) * rageMult * (crit ? CRIT_MULT : 1)));
          kind = "atk";
        }

        if (!missed) {
          target.hp = Math.max(0, target.hp - dmg);
          const downed = target.hp <= 0;
          if (downed) target.alive = false;
          events.push({
            t: crit ? "crit" : kind, side: unit.side, idx: unit.idx, name: unit.name,
            tside: target.side, tidx: target.idx, tname: target.name, dmg, crit,
            down: downed, state: snapshot(p1, p2),
          });
          // lifesteal heal
          if (unit.preset === "lifesteal" && dmg > 0) {
            const ally = mostWoundedAlly(unit, myTeam);
            if (ally && ally.alive) {
              const heal = Math.max(1, Math.round(dmg * 0.25 * lifeDecay));
              ally.hp = Math.min(ally.maxHp, ally.hp + heal);
              events.push({ t: "heal", side: ally.side, idx: ally.idx, name: ally.name, heal, state: snapshot(p1, p2) });
            }
          }
        }
        if (!teamAlive(oppTeam)) break;
      }

      cumP1 += hpFrac(p1);
      cumP2 += hpFrac(p2);
    }

    if (!winner) {
      // round cap → cumulative HP%
      winner = cumP1 >= cumP2 ? "p1" : "p2";
      events.push({ t: "timeout", winner, state: snapshot(p1, p2) });
    }
    events.push({ t: winner === "p1" ? "win" : "lose", winner, state: snapshot(p1, p2) });
    return { events, winner, rounds: round };
  }

  // ====================================================================
  //  DIFFICULTY CALIBRATOR (compact)
  //  Fast headless sim → binary search a multiplier giving target WR.
  // ====================================================================
  const SIM_N = 46, BIN_IT = 9;
  const RMULT = { Common: 0.925, Rare: 1.04, Epic: 1.14, Legendary: 1.24 };
  // unit array: [mhp,hp,atk,def,spd,mag,preset]
  const _MHP = 0, _HP = 1, _ATK = 2, _DEF = 3, _SPD = 4, _MAG = 5, _PRE = 6;

  function calibUnitFromBeast(b) {
    return [eff(b, "hp"), eff(b, "hp"), eff(b, "atk"), eff(b, "def"), eff(b, "spd"), eff(b, "mag"), b.preset];
  }
  function calibMakeUnit(tname, rarity, dm) {
    const tpl = D.TEMPLATES[tname];
    const v = (RMULT[rarity] || 1) * dm;
    const mhp = Math.max(1, Math.floor(tpl.hp * v));
    return [mhp, mhp, Math.max(1, Math.floor(tpl.atk * v)), Math.max(1, Math.floor(tpl.def * v)),
    Math.max(1, Math.floor(tpl.spd * v)), Math.max(1, Math.floor(tpl.mag * v)), D.TYPE_TO_PRESET[tpl.type]];
  }
  function calibGenEnemy(rarity, dm) {
    const types = ["HASH", "MINING", "LEDGER", "NETWORK", "BLOCK", "GENESIS"];
    for (let i = types.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[types[i], types[j]] = [types[j], types[i]]; }
    const ct = types.slice(0, 3), en = [];
    for (let i = 0; i < 3; i++) {
      const gn = D.pick(D.TEMPLATES_BY_TYPE[ct[i]]);
      en.push(calibMakeUnit(gn, rarity, dm * (0.96 + Math.random() * 0.08)));
    }
    return en;
  }
  function cFindMaxHp(t) { let bi = -1, bv = -1; for (let i = 0; i < 3; i++) if (t[i][_HP] > 0 && t[i][_HP] > bv) { bv = t[i][_HP]; bi = i; } return bi; }
  function cFindMinHp(t) { let bi = -1, bv = 1e9; for (let i = 0; i < 3; i++) if (t[i][_HP] > 0 && t[i][_HP] < bv) { bv = t[i][_HP]; bi = i; } return bi; }
  function cFindMaxK(t, k) { let bi = -1, bv = -1; for (let i = 0; i < 3; i++) if (t[i][_HP] > 0 && t[i][k] > bv) { bv = t[i][k]; bi = i; } return bi; }
  function cWounded(t, si) {
    const sr = t[si][_HP] / Math.max(1, t[si][_MHP]); let bi = si, br = sr;
    for (let i = 0; i < 3; i++) { if (i === si || t[i][_HP] <= 0) continue; const r = t[i][_HP] / Math.max(1, t[i][_MHP]); if (r < sr - 0.1 && r < br) { br = r; bi = i; } }
    return bi;
  }
  function cDecide(pre, my, opp, si) {
    switch (pre) {
      case "aggressive": return { up: true, ti: cFindMaxHp(opp), hi: -1 };
      case "berserker": return { up: false, ti: cFindMaxHp(opp), hi: -1 };
      case "controller": return { up: true, ti: cFindMaxK(opp, _SPD), hi: -1 };
      case "sniper": return { up: true, ti: cFindMaxK(opp, _MAG), hi: -1 };
      case "lifesteal": return { up: false, ti: cFindMinHp(opp), hi: cWounded(my, si) };
      case "tactician": {
        const ti = cFindMinHp(opp); let att = null;
        for (const b of my) if (b[_HP] > 0) { att = b; break; }
        if (!att) return { up: false, ti, hi: -1 };
        const md = att[_MAG] * 1.5 - opp[ti][_DEF] * 0.5, ad = att[_ATK] - opp[ti][_DEF] * 0.5;
        return { up: md > ad, ti, hi: -1 };
      }
      default: return { up: false, ti: cFindMinHp(opp), hi: -1 };
    }
  }
  function cRound(tp, te) {
    const comb = [];
    for (let i = 0; i < 3; i++) { if (tp[i][_HP] > 0) comb.push({ b: tp[i], my: tp, opp: te, idx: i }); if (te[i][_HP] > 0) comb.push({ b: te[i], my: te, opp: tp, idx: i }); }
    for (let i = comb.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[comb[i], comb[j]] = [comb[j], comb[i]]; }
    for (const c of comb) {
      if (c.b[_HP] <= 0) continue;
      let aliveOpp = false; for (let i = 0; i < 3; i++) if (c.opp[i][_HP] > 0) { aliveOpp = true; break; }
      if (!aliveOpp) break;
      let myIdx = 0; for (let i = 0; i < 3; i++) if (c.my[i] === c.b) { myIdx = i; break; }
      const dec = cDecide(c.b[_PRE], c.my, c.opp, myIdx);
      let ti = dec.ti;
      if (ti < 0 || c.opp[ti][_HP] <= 0) { ti = -1; for (let i = 0; i < 3; i++) if (c.opp[i][_HP] > 0) { ti = i; break; } }
      if (ti < 0) break;
      let dmg;
      if (dec.up) { if (Math.random() < 0.4) continue; dmg = Math.max(1, Math.floor(c.b[_MAG] * 1.5 - c.opp[ti][_DEF] / 2)); }
      else dmg = Math.max(1, Math.floor(c.b[_ATK] - c.opp[ti][_DEF] / 2));
      c.opp[ti][_HP] = Math.max(0, c.opp[ti][_HP] - dmg);
      if (dec.hi >= 0 && dmg > 0) c.my[dec.hi][_HP] = Math.min(c.my[dec.hi][_MHP], c.my[dec.hi][_HP] + Math.max(1, Math.floor(dmg / 4)));
    }
  }
  function cSimOne(playerSim, rarity, dm) {
    const tp = playerSim.map((b) => b.slice());
    const te = calibGenEnemy(rarity, dm);
    for (let r = 0; r < 60; r++) {
      if (!tp.some((b) => b[_HP] > 0)) break;
      if (!te.some((b) => b[_HP] > 0)) break;
      cRound(tp, te);
    }
    return tp.some((b) => b[_HP] > 0) && !te.some((b) => b[_HP] > 0);
  }
  function cEstimate(playerSim, rarity, dm) { let w = 0; for (let i = 0; i < SIM_N; i++) if (cSimOne(playerSim, rarity, dm)) w++; return w / SIM_N; }
  function cBinary(playerSim, rarity, target, lo, hi) {
    for (let i = 0; i < BIN_IT; i++) { const mid = (lo + hi) / 2; const wr = cEstimate(playerSim, rarity, mid); if (wr > target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function buildSequence(team) {
    if (team.length < 3) return [];
    const rarity = D.avgRarity(team);
    const sim = team.map(calibUnitFromBeast);
    const med = cBinary(sim, rarity, 0.62, 0.3, 3.5);
    const easy = cBinary(sim, rarity, 0.85, 0.3, med);
    const hard = cBinary(sim, rarity, 0.35, med, 3.5);
    const seq = [];
    for (let i = 0; i < 30; i++) seq.push(easy * (0.95 + Math.random() * 0.1));
    for (let i = 0; i < 50; i++) seq.push(med * (0.97 + Math.random() * 0.06));
    for (let i = 0; i < 20; i++) seq.push(hard * (0.95 + Math.random() * 0.1));
    for (let i = seq.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[seq[i], seq[j]] = [seq[j], seq[i]]; }
    return seq;
  }

  window.FA_ENGINE = { runBattle, buildSequence, ROUND_CAP };
})();
