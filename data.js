/* ============================================================
   FRACTAL ARENA — Game data & beast factory
   (mirrors fractal_arena_source.gd constants)
   ============================================================ */
(function () {
  "use strict";

  // ---- Rarity ----
  const RARITY_ORDER = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };
  const RARITY_LIST = ["Common", "Rare", "Epic", "Legendary"];
  const RARITY_COLORS = {
    Common: "#9CA3AF", Rare: "#3B82F6", Epic: "#B026FF", Legendary: "#F7931A",
  };
  const RARITY_UPGRADE = { Common: "Rare", Rare: "Epic", Epic: "Legendary", Legendary: "Legendary" };
  // Mint odds
  const MINT_ODDS = [ ["Common", 0.70], ["Rare", 0.20], ["Epic", 0.08], ["Legendary", 0.02] ];

  // ---- Presets ----
  const PRESET_COLORS = {
    aggressive: "#FF3B5C", berserker: "#F7931A", tactician: "#9F00FF",
    controller: "#00F0FF", lifesteal: "#27E08A", sniper: "#FFE600",
  };
  const TYPE_TO_PRESET = {
    HASH: "aggressive", MINING: "berserker", LEDGER: "tactician",
    NETWORK: "controller", BLOCK: "lifesteal", GENESIS: "sniper",
  };

  // ---- Creature art (real assets) ----
  const ART = {
    HashByte: "assets/HASHBYTE.png",
    Miner: "assets/MINER.png",
    LEDGER: "assets/LEDGER.png",
    NETWORK: "assets/NETWORK.png",
    BLOCK: "assets/BLOCK.png",
    GENESIS: "assets/GENESIS.png",
  };
  // Display names per type
  const TYPE_LABEL = {
    HASH: "HashByte", MINING: "Miner", LEDGER: "Ledger",
    NETWORK: "Network", BLOCK: "Block", GENESIS: "Genesis",
  };

  // ---- Templates (18) ----
  const TEMPLATES = {
    "HashByte-1": { hp: 90, atk: 14, def: 4, spd: 11, mag: 16, type: "HASH", img: "HashByte" },
    "HashByte-2": { hp: 85, atk: 16, def: 3, spd: 13, mag: 18, type: "HASH", img: "HashByte" },
    "HashByte-3": { hp: 95, atk: 12, def: 5, spd: 9, mag: 14, type: "HASH", img: "HashByte" },
    "Miner-1": { hp: 120, atk: 13, def: 6, spd: 9, mag: 8, type: "MINING", img: "Miner" },
    "Miner-2": { hp: 130, atk: 11, def: 8, spd: 7, mag: 7, type: "MINING", img: "Miner" },
    "Miner-3": { hp: 115, atk: 14, def: 5, spd: 10, mag: 9, type: "MINING", img: "Miner" },
    "Ledger-1": { hp: 105, atk: 11, def: 6, spd: 10, mag: 17, type: "LEDGER", img: "LEDGER" },
    "Ledger-2": { hp: 100, atk: 10, def: 7, spd: 9, mag: 19, type: "LEDGER", img: "LEDGER" },
    "Ledger-3": { hp: 110, atk: 12, def: 5, spd: 11, mag: 16, type: "LEDGER", img: "LEDGER" },
    "Network-1": { hp: 88, atk: 15, def: 4, spd: 12, mag: 17, type: "NETWORK", img: "NETWORK" },
    "Network-2": { hp: 92, atk: 13, def: 5, spd: 14, mag: 15, type: "NETWORK", img: "NETWORK" },
    "Network-3": { hp: 95, atk: 14, def: 3, spd: 13, mag: 18, type: "NETWORK", img: "NETWORK" },
    "Block-1": { hp: 125, atk: 12, def: 7, spd: 8, mag: 9, type: "BLOCK", img: "BLOCK" },
    "Block-2": { hp: 128, atk: 10, def: 9, spd: 6, mag: 8, type: "BLOCK", img: "BLOCK" },
    "Block-3": { hp: 118, atk: 13, def: 6, spd: 9, mag: 10, type: "BLOCK", img: "BLOCK" },
    "Genesis-1": { hp: 110, atk: 15, def: 7, spd: 11, mag: 20, type: "GENESIS", img: "GENESIS" },
    "Genesis-2": { hp: 105, atk: 16, def: 6, spd: 12, mag: 19, type: "GENESIS", img: "GENESIS" },
    "Genesis-3": { hp: 115, atk: 14, def: 8, spd: 10, mag: 21, type: "GENESIS", img: "GENESIS" },
  };
  const TEMPLATE_KEYS = Object.keys(TEMPLATES);
  const TEMPLATES_BY_TYPE = {};
  TEMPLATE_KEYS.forEach((k) => {
    const ty = TEMPLATES[k].type;
    (TEMPLATES_BY_TYPE[ty] = TEMPLATES_BY_TYPE[ty] || []).push(k);
  });

  // ---- Economy ----
  const ECON = {
    MINT_COST: 20000,
    FREE_FIGHTS_PER_DAY: 5,
    BET: { bronze: 10, silver: 25, gold: 50 },
    BET_GAIN: { bronze: 7, silver: 17, gold: 35 }, // net win
    PAYOUT_MULT: 1.7,
    MILESTONE_EVERY: 50,
    MILESTONE_REWARD: 50,
    DEFEAT_POOL_RATIO: 0.667,
    LOOP_SILVER_MAX: 100,
    LOOP_GOLD_MAX: 50,
    TICKET_SILVER_PER_MS: 10,
    TICKET_GOLD_PER_MS: 5,
    WITHDRAW_MIN: 500,
    WITHDRAW_MAX: 20000,
    DEPOSIT_MIN: 100,
    XP_PER_VICTORY: 50,
    MAX_LEVEL_UPGRADE: 100,
    WELCOME_LOCKED: 1000,
    WELCOME_LIQUID: 0,
    VANITY_RENAME: 1000,
    VANITY_TITLE: 5000,
  };

  const FORGE = {
    FUSION_COST: { Common: 3000, Rare: 8000, Epic: 25000 },
    FUSION_RATE: { Common: 0.6, Rare: 0.45, Epic: 0.3 },
    REROLL_BASE: { Common: 1000, Rare: 3000, Epic: 8000, Legendary: 25000 },
  };

  const BOOSTS = {
    xp_boost: { cost: 4000, fights: 50, color: "#FFE600" },
    insurance: { cost: 6000, charges: 5, color: "#27E08A" },
    lucky_strike: { cost: 5000, fights: 15, color: "#F7931A" },
  };

  // ---- helpers ----
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function levelMult(level) { return 1 + 0.03 * (level - 1); }

  function rarityVariance(rarity) {
    switch (rarity) {
      case "Common": return rand(0.85, 1.0);
      case "Rare": return rand(1.0, 1.15);
      case "Epic": return rand(1.15, 1.3);
      case "Legendary": return rand(1.3, 1.4);
      default: return 1.0;
    }
  }
  function rollRarity() {
    const r = Math.random();
    let acc = 0;
    for (const [name, p] of MINT_ODDS) { acc += p; if (r < acc) return name; }
    return "Common";
  }

  let _idc = 0;
  function newId() { return "beast_" + (_idc++) + "_" + ((Math.random() * 1e6) | 0); }

  // Effective stat getters
  function eff(beast, key) { return Math.floor(beast["base_" + key] * levelMult(beast.level)); }
  function maxHp(b) { return eff(b, "hp"); }

  // Make a beast from template
  function mintBeast(templateName, forceRarity, idx) {
    const tpl = TEMPLATES[templateName];
    const rarity = forceRarity || rollRarity();
    const v = rarityVariance(rarity);
    const b = {
      id: newId(),
      template_name: templateName,
      type: tpl.type,
      image_key: tpl.img,
      preset: TYPE_TO_PRESET[tpl.type],
      rarity,
      base_hp: Math.floor(tpl.hp * v),
      base_atk: Math.floor(tpl.atk * v),
      base_def: Math.floor(tpl.def * v),
      base_spd: Math.floor(tpl.spd * v),
      base_mag: Math.floor(tpl.mag * v),
      level: 1,
      xp: 0,
      reroll_count: 0,
      name: TYPE_LABEL[tpl.type] + " #" + (idx == null ? ((Math.random() * 900 + 100) | 0) : idx),
      custom_name: null,
    };
    return b;
  }

  function starterRoster() {
    return [
      mintBeast("HashByte-1", "Common", 1),
      mintBeast("Block-1", "Common", 2),
      mintBeast("Ledger-1", "Common", 3),
    ];
  }

  function xpToNext(beast) { return beast.level * 100; }
  function displayName(b) { return b.custom_name || b.name; }

  // ---- Simulated on-chain name-inscription scan ----
  // Deterministic per wallet: a seeded RNG picks a handful of ".fb" names the
  // wallet "owns". In a real build this would query the wallet's inscriptions.
  const _NAME_POOL = [
    "FractalArena", "Satoshi", "BlockForge", "HashKing", "DeepMiner", "Ordinal",
    "ChainBreaker", "GenesisBlock", "MerkleRoot", "NodeRunner", "ProofOfWork",
    "DiamondHands", "WhaleGod", "ByteLord", "CryptoSamurai", "LedgerWolf",
    "MoonMiner", "FractalKnight", "BitForge", "VoidWalker",
  ];
  function _seedFromStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function _mulberry(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function walletNameInscriptions(address) {
    if (!address) return [];
    const rng = _mulberry(_seedFromStr(address));
    // Most wallets hold a handful; ~1 in 4 is a "collector" with many names.
    const collector = rng() < 0.25;
    const n = collector ? 30 + Math.floor(rng() * 110) : 2 + Math.floor(rng() * 5);
    const out = [];
    const seen = new Set();
    let guard = 0;
    while (out.length < n && guard++ < n * 6) {
      const base = _NAME_POOL[Math.floor(rng() * _NAME_POOL.length)];
      // numeric suffix keeps large collections unique (e.g. Satoshi420.fb)
      const suffix = out.length < 4 && rng() < 0.5 ? "" : String(Math.floor(rng() * 9000) + 100);
      const name = base + suffix + ".fb";
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        number: 4000000000 + Math.floor(rng() * 900000000),
        sats: 330,
        days: 1 + Math.floor(rng() * 120),
      });
    }
    return out;
  }

  // Grant XP to a team, returns events
  function grantXp(team, xp) {
    const events = [];
    for (const b of team) {
      b.xp += xp;
      while (b.xp >= xpToNext(b)) {
        b.xp -= xpToNext(b);
        b.level += 1;
        events.push({ type: "levelup", beast: b });
        if (b.level >= ECON.MAX_LEVEL_UPGRADE && b.rarity !== "Legendary") {
          upgradeRarity(b);
          events.push({ type: "rarity_up", beast: b });
          break;
        }
      }
    }
    return events;
  }

  function upgradeRarity(b) {
    const nr = RARITY_UPGRADE[b.rarity];
    if (nr === b.rarity) return;
    const curHp = maxHp(b), curAtk = eff(b, "atk"), curDef = eff(b, "def"),
      curSpd = eff(b, "spd"), curMag = eff(b, "mag");
    const v = rarityVariance(nr);
    b.rarity = nr;
    b.base_hp = Math.floor(curHp * v);
    b.base_atk = Math.floor(curAtk * v);
    b.base_def = Math.floor(curDef * v);
    b.base_spd = Math.floor(curSpd * v);
    b.base_mag = Math.floor(curMag * v);
    b.level = 1;
    b.xp = 0;
  }

  // Average / majority rarity of a team
  function avgRarity(team) {
    const counts = { Common: 0, Rare: 0, Epic: 0, Legendary: 0 };
    team.forEach((c) => { counts[c.rarity]++; });
    let best = "Common", bc = 0;
    for (const r of RARITY_LIST) {
      if (counts[r] > bc) { bc = counts[r]; best = r; }
      else if (counts[r] === bc && RARITY_ORDER[r] > RARITY_ORDER[best]) best = r;
    }
    return best;
  }
  function avgLevel(team) {
    if (!team.length) return 1;
    return Math.round(team.reduce((s, c) => s + c.level, 0) / team.length);
  }

  // Generate a mirror-style enemy team with a difficulty multiplier
  function generateEnemyTeam(playerTeam, diffMult) {
    const types = ["HASH", "MINING", "LEDGER", "NETWORK", "BLOCK", "GENESIS"];
    // shuffle
    for (let i = types.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[types[i], types[j]] = [types[j], types[i]]; }
    const chosen = types.slice(0, 3);
    const enemies = [];
    for (let i = 0; i < 3; i++) {
      const ptype = chosen[i];
      const tname = pick(TEMPLATES_BY_TYPE[ptype]);
      const mirrorRarity = playerTeam[i].rarity;
      const g = mintBeast(tname, mirrorRarity);
      g.level = playerTeam[i].level;
      g.xp = 0;
      g.name = TYPE_LABEL[ptype];
      const m = diffMult * (0.96 + Math.random() * 0.08);
      g.base_hp = Math.max(1, Math.floor(g.base_hp * m));
      g.base_atk = Math.max(1, Math.floor(g.base_atk * m));
      g.base_def = Math.max(1, Math.floor(g.base_def * m));
      g.base_spd = Math.max(1, Math.floor(g.base_spd * m));
      g.base_mag = Math.max(1, Math.floor(g.base_mag * m));
      enemies.push(g);
    }
    // shuffle final
    for (let i = enemies.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[enemies[i], enemies[j]] = [enemies[j], enemies[i]]; }
    return enemies;
  }

  window.FA_DATA = {
    RARITY_ORDER, RARITY_LIST, RARITY_COLORS, RARITY_UPGRADE, MINT_ODDS,
    PRESET_COLORS, TYPE_TO_PRESET, TYPE_LABEL, ART,
    TEMPLATES, TEMPLATE_KEYS, TEMPLATES_BY_TYPE,
    ECON, FORGE, BOOSTS,
    rand, pick, levelMult, rarityVariance, rollRarity, newId,
    eff, maxHp, mintBeast, starterRoster, xpToNext, displayName,
    grantXp, upgradeRarity, avgRarity, avgLevel, generateEnemyTeam,
    walletNameInscriptions,
  };
})();
