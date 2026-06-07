/* ============================================================
   FRACTAL ARENA — i18n FR / EN / ZH
   window.FA_I18N.t(key, ...args) ; supports %s / %d
   ============================================================ */
(function () {
  "use strict";

  const T = {
    // nav
    NAV_TEAM: { FR: "Équipe", EN: "Team", ZH: "队伍" },
    NAV_ARENA: { FR: "Arène", EN: "Arena", ZH: "竞技场" },
    NAV_FORGE: { FR: "Forge", EN: "Forge", ZH: "熔炉" },
    NAV_WALLET: { FR: "Wallet", EN: "Wallet", ZH: "钱包" },
    NAV_BOOSTS: { FR: "Boosts", EN: "Boosts", ZH: "强化" },
    NAV_PERSO: { FR: "Perso", EN: "Vanity", ZH: "外观" },
    NAV_OPTIONS: { FR: "Options", EN: "Options", ZH: "设置" },

    // header
    LOCKED_CHIP: { FR: "Verrouillé", EN: "Locked", ZH: "锁定" },

    // onboarding
    OB_TAG: { FR: "AUTO-BATTLER ON-CHAIN", EN: "ON-CHAIN AUTO-BATTLER", ZH: "链上自动战斗" },
    OB_CONNECT: { FR: "Connecte ton wallet", EN: "Connect your wallet", ZH: "连接你的钱包" },
    OB_SUB: {
      FR: "Entre ton adresse Fractal Bitcoin (UniSat) pour recevoir ton cadeau de bienvenue de 1 000 FRACTALARENA verrouillés.",
      EN: "Enter your Fractal Bitcoin (UniSat) address to receive your 1,000 locked FRACTALARENA welcome gift.",
      ZH: "输入你的 Fractal Bitcoin（UniSat）地址，领取 1,000 锁定 FRACTALARENA 欢迎礼物。",
    },
    OB_PLACEHOLDER: { FR: "bc1p… ou bc1q…", EN: "bc1p… or bc1q…", ZH: "bc1p… 或 bc1q…" },
    OB_BTN: { FR: "Connecter", EN: "Connect", ZH: "连接" },
    OB_INVALID: { FR: "Adresse invalide — vérifie ton wallet UniSat", EN: "Invalid address — check your UniSat wallet", ZH: "地址无效 — 请检查你的 UniSat 钱包" },
    OB_CHECKING: { FR: "Vérification on-chain…", EN: "Checking on-chain…", ZH: "链上验证中…" },
    OB_GIFT: { FR: "1 000 verrouillés + 5 combats gratuits/jour", EN: "1,000 locked + 5 free fights/day", ZH: "1,000 锁定 + 每日 5 场免费战斗" },
    OB_WALLET_REQUIRED: { FR: "Wallet obligatoire pour jouer", EN: "Wallet required to play", ZH: "游玩需连接钱包" },

    // team
    TEAM_TITLE: { FR: "Ma collection", EN: "My collection", ZH: "我的收藏" },
    TEAM_HINT: { FR: "Sélectionne 3 entités pour ton équipe", EN: "Select 3 entities for your team", ZH: "选择 3 个实体组成队伍" },
    TEAM_SELECTED: { FR: "%d / 3 sélectionnées", EN: "%d / 3 selected", ZH: "已选 %d / 3" },
    TEAM_ENTER: { FR: "Entrer dans l'arène", EN: "Enter the arena", ZH: "进入竞技场" },
    TEAM_FULL: { FR: "Équipe pleine (3 max)", EN: "Team full (3 max)", ZH: "队伍已满（最多3个）" },
    TEAM_COUNT: { FR: "%d entités", EN: "%d entities", ZH: "%d 个实体" },

    // arena
    AR_VERSUS: { FR: "FRACTAL", EN: "FRACTAL", ZH: "分形" },
    AR_YOU: { FR: "Toi", EN: "You", ZH: "你" },
    AR_LOG: { FR: "Journal de combat", EN: "Battle log", ZH: "战斗日志" },
    AR_BET: { FR: "Mise", EN: "Bet", ZH: "下注" },
    AR_FREE: { FR: "Gratuit", EN: "Free", ZH: "免费" },
    AR_BRONZE: { FR: "Bronze", EN: "Bronze", ZH: "青铜" },
    AR_SILVER: { FR: "Argent", EN: "Silver", ZH: "白银" },
    AR_GOLD: { FR: "Or", EN: "Gold", ZH: "黄金" },
    AR_FIGHT: { FR: "Combat", EN: "Fight", ZH: "战斗" },
    AR_LOOP_ON: { FR: "Boucle : ON", EN: "Loop : ON", ZH: "循环：开" },
    AR_LOOP_OFF: { FR: "Boucle : OFF", EN: "Loop : OFF", ZH: "循环：关" },
    AR_USE_LOCKED: { FR: "Utiliser verrouillé", EN: "Use locked", ZH: "使用锁定" },
    AR_FREE_LEFT: { FR: "%d combat(s) gratuit(s) aujourd'hui", EN: "%d free fight(s) today", ZH: "今日剩余 %d 场免费战斗" },
    AR_FREE_EMPTY: { FR: "Plus de combats gratuits aujourd'hui", EN: "No more free fights today", ZH: "今日免费战斗已用完" },
    AR_NEED3: { FR: "Sélectionne 3 entités d'abord", EN: "Select 3 entities first", ZH: "请先选择 3 个实体" },
    AR_INSUFF: { FR: "Solde insuffisant", EN: "Insufficient balance", ZH: "余额不足" },
    AR_LOCKED_EMPTY: { FR: "Solde verrouillé épuisé — boucle arrêtée (le disponible n'est pas misé)", EN: "Locked balance used up — loop stopped (available balance is not bet)", ZH: "锁定余额已用完 — 循环已停止（不会动用可用余额）" },
    AR_PICK_BET: { FR: "Choisis une mise — plus de combats gratuits", EN: "Pick a bet — no free fights left", ZH: "请选择下注 — 免费战斗已用完" },
    AR_WINRATE: { FR: "V %d · D %d · TV %d%%", EN: "W %d · L %d · WR %d%%", ZH: "胜 %d · 败 %d · 胜率 %d%%" },
    AR_NEXT_MS: { FR: "Milestone dans %d", EN: "Milestone in %d", ZH: "里程碑还差 %d" },
    AR_TICKETS: { FR: "Tickets — Argent %d · Or %d", EN: "Tickets — Silver %d · Gold %d", ZH: "券 — 白银 %d · 黄金 %d" },
    AR_LOOP_CAP: { FR: "Limite loop atteinte — repli sur Bronze", EN: "Loop cap reached — falling back to Bronze", ZH: "循环已达上限 — 回退至青铜" },
    AR_ROUND: { FR: "Round %d", EN: "Round %d", ZH: "回合 %d" },

    // combat log
    L_START: { FR: "COMBAT LANCÉ", EN: "FIGHT STARTED", ZH: "战斗开始" },
    L_FREE: { FR: "COMBAT GRATUIT — gains verrouillés", EN: "FREE FIGHT — locked gains", ZH: "免费战斗 — 锁定收益" },
    L_BET: { FR: "Mise %s : -%d FA", EN: "Bet %s: -%d FA", ZH: "%s 下注：-%d FA" },
    L_ENEMY: { FR: "Adversaire : %s niv.%d", EN: "Enemy: %s Lv.%d", ZH: "敌人：%s %d级" },
    L_ATK: { FR: "%s → %s  -%d", EN: "%s → %s  -%d", ZH: "%s → %s  -%d" },
    L_SP: { FR: "%s ⚡ %s  -%d", EN: "%s ⚡ %s  -%d", ZH: "%s ⚡ %s  -%d" },
    L_CRIT: { FR: "%s ✦CRIT %s  -%d", EN: "%s ✦CRIT %s  -%d", ZH: "%s ✦暴击 %s  -%d" },
    L_MISS: { FR: "%s rate son attaque", EN: "%s misses", ZH: "%s 未命中" },
    L_HEAL: { FR: "%s vol de vie +%d", EN: "%s lifesteal +%d", ZH: "%s 吸血 +%d" },
    L_DOWN: { FR: "%s est vaincu", EN: "%s is defeated", ZH: "%s 被击败" },
    L_WIN: { FR: "VICTOIRE", EN: "VICTORY", ZH: "胜利" },
    L_LOSE: { FR: "DÉFAITE", EN: "DEFEAT", ZH: "失败" },
    L_TIMEOUT: { FR: "Limite de rounds — décision au %%PV", EN: "Round cap — decided on HP%%", ZH: "回合上限 — 按血量判定" },
    L_LEVELUP: { FR: "⬆ %s passe niveau %d", EN: "⬆ %s reached level %d", ZH: "⬆ %s 升至 %d级" },
    L_RARITYUP: { FR: "✦ UPGRADE RARETÉ — %s → %s", EN: "✦ RARITY UPGRADE — %s → %s", ZH: "✦ 稀有度提升 — %s → %s" },

    // result
    RES_WIN: { FR: "VICTOIRE", EN: "VICTORY", ZH: "胜利" },
    RES_LOSE: { FR: "DÉFAITE", EN: "DEFEAT", ZH: "失败" },
    RES_GAIN: { FR: "Gain", EN: "Payout", ZH: "收益" },
    RES_NET: { FR: "Net", EN: "Net", ZH: "净值" },
    RES_XP: { FR: "XP par entité", EN: "XP per entity", ZH: "每实体经验" },
    RES_POOL: { FR: "Pool liquidité", EN: "Liquidity pool", ZH: "流动性池" },
    RES_BURN: { FR: "Burn", EN: "Burn", ZH: "销毁" },
    RES_MILESTONE: { FR: "MILESTONE — +%d verrouillé", EN: "MILESTONE — +%d locked", ZH: "里程碑 — +%d 锁定" },
    RES_CONTINUE: { FR: "Continuer", EN: "Continue", ZH: "继续" },
    RES_LOCKED_GAIN: { FR: "Gain verrouillé (combat gratuit)", EN: "Locked gain (free fight)", ZH: "锁定收益（免费战斗）" },

    // forge
    FG_TITLE: { FR: "Forge", EN: "Forge", ZH: "熔炉" },
    FG_SUB: { FR: "70% du coût → Reward Pool · 30% → Burn", EN: "70% of fee → Reward Pool · 30% → Burn", ZH: "费用 70% → 奖励池 · 30% → 销毁" },
    FG_FUSION: { FR: "Fusion", EN: "Fusion", ZH: "融合" },
    FG_REROLL: { FR: "Reroll", EN: "Reroll", ZH: "重铸" },
    FG_SUMMON: { FR: "Invoquer", EN: "Summon", ZH: "召唤" },
    FG_FUSION_HINT: { FR: "Sélectionne 2 entités de même rareté. Succès → rareté supérieure.", EN: "Select 2 entities of the same rarity. Success → higher rarity.", ZH: "选择 2 个相同稀有度的实体。成功 → 提升稀有度。" },
    FG_REROLL_HINT: { FR: "Redistribue aléatoirement les stats. Total conservé.", EN: "Randomly redistribute stats. Total preserved.", ZH: "随机重新分配属性。总和保持不变。" },
    FG_SUMMON_HINT: { FR: "Forge une nouvelle entité. Rareté 70/20/8/2%.", EN: "Forge a new entity. Rarity 70/20/8/2%.", ZH: "铸造新实体。稀有度 70/20/8/2%。" },
    FG_PICK2: { FR: "Sélectionne deux entités", EN: "Select two entities", ZH: "选择两个实体" },
    FG_PICK1: { FR: "Sélectionne une entité", EN: "Select one entity", ZH: "选择一个实体" },
    FG_PICK_SAME: { FR: "Choisis une 2ᵉ entité %s", EN: "Pick a 2nd %s entity", ZH: "选择第二个 %s 实体" },
    FG_SUCCESS_RATE: { FR: "Chance de succès", EN: "Success chance", ZH: "成功率" },
    FG_FUSE_BTN: { FR: "Fusionner  −%d", EN: "Fuse  −%d", ZH: "融合  −%d" },
    FG_REROLL_BTN: { FR: "Reroll  −%d", EN: "Reroll  −%d", ZH: "重铸  −%d" },
    FG_SUMMON_BTN: { FR: "Invoquer  −%d", EN: "Summon  −%d", ZH: "召唤  −%d" },
    FG_FUSE_OK: { FR: "FUSION RÉUSSIE → %s", EN: "FUSION SUCCESS → %s", ZH: "融合成功 → %s" },
    FG_FUSE_FAIL: { FR: "FUSION ÉCHEC — entité sacrifiée perdue", EN: "FUSION FAILED — sacrifice lost", ZH: "融合失败 — 牺牲品丢失" },
    FG_REROLL_OK: { FR: "Stats redistribuées", EN: "Stats redistributed", ZH: "属性已重新分配" },
    FG_SUMMON_OK: { FR: "Invoqué : %s [%s]", EN: "Summoned: %s [%s]", ZH: "召唤：%s [%s]" },
    FG_NOT_FUSABLE: { FR: "Légendaire non fusable", EN: "Legendary not fusable", ZH: "传说无法融合" },

    // boosts
    BO_TITLE: { FR: "Boosts", EN: "Boosts", ZH: "强化" },
    BO_SUB: { FR: "Consommables — payés en FRACTALARENA", EN: "Consumables — paid in FRACTALARENA", ZH: "消耗品 — 用 FRACTALARENA 支付" },
    BO_XP_NAME: { FR: "XP ×2", EN: "XP ×2", ZH: "双倍经验" },
    BO_XP_DESC: { FR: "Double l'XP gagnée pendant 50 combats.", EN: "Doubles XP earned for 50 fights.", ZH: "50 场战斗内双倍经验。" },
    BO_INS_NAME: { FR: "Insurance", EN: "Insurance", ZH: "保险" },
    BO_INS_DESC: { FR: "Annule la perte de mise sur 5 défaites payantes (hors loop).", EN: "Cancels bet loss on 5 paid defeats (no loop).", ZH: "5 次付费失败不扣注（非循环）。" },
    BO_LUCKY_NAME: { FR: "Lucky Strike", EN: "Lucky Strike", ZH: "幸运打击" },
    BO_LUCKY_DESC: { FR: "25% par victoire de gagner +50% bonus pendant 15 combats.", EN: "25% per win to earn +50% bonus for 15 fights.", ZH: "15 场内每次胜利 25% 几率获得 +50% 奖励。" },
    BO_BUY: { FR: "Acheter — %d FA", EN: "Buy — %d FA", ZH: "购买 — %d FA" },
    BO_ACTIVE: { FR: "Actif — %d restants", EN: "Active — %d left", ZH: "激活 — 剩 %d" },
    BO_CHARGES: { FR: "%d charge(s)", EN: "%d charge(s)", ZH: "%d 次充能" },
    BO_BOUGHT: { FR: "Boost acquis", EN: "Boost acquired", ZH: "强化已获得" },

    // wallet
    WL_TITLE: { FR: "Wallet", EN: "Wallet", ZH: "钱包" },
    WL_LIQUID: { FR: "Liquide", EN: "Liquid", ZH: "可用" },
    WL_LOCKED: { FR: "Verrouillé", EN: "Locked", ZH: "锁定" },
    WL_LIQUID_DESC: { FR: "Misable + retirable", EN: "Bettable + withdrawable", ZH: "可下注 + 可提取" },
    WL_LOCKED_DESC: { FR: "Misable uniquement", EN: "Bettable only", ZH: "仅可下注" },
    WL_DEPOSIT: { FR: "Dépôt on-chain", EN: "Deposit on-chain", ZH: "链上充值" },
    WL_WITHDRAW: { FR: "Retrait on-chain", EN: "Withdraw on-chain", ZH: "链上提取" },
    WL_DEP_INFO: { FR: "Envoie tes FRACTALARENA à l'adresse du Reward Pool, puis colle le TXID de ta transaction. Ton solde Liquide sera crédité après détection on-chain.", EN: "Send your FRACTALARENA to the Reward Pool address, then paste your transaction TXID. Your Liquid balance is credited after on-chain detection.", ZH: "将 FRACTALARENA 发送到奖励池地址，然后粘贴你的交易 TXID。链上检测后将充值至可用余额。" },
    WL_AMOUNT: { FR: "Montant", EN: "Amount", ZH: "金额" },
    WL_DEP_TXID: { FR: "TXID de la transaction", EN: "Transaction TXID", ZH: "交易 TXID" },
    WL_DEP_TXID_PH: { FR: "Colle le txid (64 caractères hex)", EN: "Paste txid (64 hex chars)", ZH: "粘贴 txid（64 位十六进制）" },
    WL_DEP_TXID_INVALID: { FR: "TXID invalide — 64 caractères hexadécimaux attendus", EN: "Invalid TXID — 64 hex characters expected", ZH: "TXID 无效 — 需 64 位十六进制字符" },
    WL_DEP_SEND: { FR: "J'ai envoyé — détecter", EN: "Sent — detect", ZH: "已发送 — 检测" },
    WL_DEP_DETECT: { FR: "Détection on-chain…", EN: "Detecting on-chain…", ZH: "链上检测中…" },
    WL_DEP_OK: { FR: "Dépôt confirmé — +%d Liquide", EN: "Deposit confirmed — +%d Liquid", ZH: "充值成功 — +%d 可用" },
    WL_DEP_MIN: { FR: "Minimum %d FA", EN: "Minimum %d FA", ZH: "最低 %d FA" },
    WL_WD_INFO: { FR: "Retire ton solde Liquide vers ton wallet. Minimum 500, maximum 20 000 / jour.", EN: "Withdraw your Liquid balance to your wallet. Min 500, max 20,000/day.", ZH: "将可用余额提取到你的钱包。最低 500，每日最高 20,000。" },
    WL_WD_SEND: { FR: "Confirmer le retrait", EN: "Confirm withdrawal", ZH: "确认提取" },
    WL_WD_PROC: { FR: "Traitement…", EN: "Processing…", ZH: "处理中…" },
    WL_WD_OK: { FR: "Retrait confirmé — %d FA envoyés", EN: "Withdrawal confirmed — %d FA sent", ZH: "提取成功 — 已发送 %d FA" },
    WL_WD_MIN: { FR: "Minimum de retrait : %d FA", EN: "Minimum withdrawal: %d FA", ZH: "最低提取：%d FA" },
    WL_WD_MAX: { FR: "Maximum : %d FA / jour", EN: "Maximum: %d FA / day", ZH: "最高：%d FA / 天" },
    WL_WD_INSUFF: { FR: "Solde Liquide insuffisant", EN: "Insufficient Liquid balance", ZH: "可用余额不足" },
    WL_REWARD_POOL: { FR: "Reward Pool", EN: "Reward Pool", ZH: "奖励池" },
    WL_COPY: { FR: "Copier", EN: "Copy", ZH: "复制" },
    WL_COPIED: { FR: "Copié !", EN: "Copied!", ZH: "已复制！" },

    // perso / vanity
    PE_TITLE: { FR: "Personnalisation", EN: "Vanity", ZH: "个性化" },
    PE_RENAME: { FR: "Renommer une entité", EN: "Rename an entity", ZH: "重命名实体" },
    PE_TITLE_TAB: { FR: "Titre joueur", EN: "Player title", ZH: "玩家称号" },
    PE_PICK: { FR: "Sélectionne une entité", EN: "Select an entity", ZH: "选择一个实体" },
    PE_NEW_NAME: { FR: "Nouveau nom (24 max)", EN: "New name (24 max)", ZH: "新名称（最多24）" },
    PE_NEW_TITLE: { FR: "Nouveau titre (32 max)", EN: "New title (32 max)", ZH: "新称号（最多32）" },
    PE_RENAME_BTN: { FR: "Renommer — %d FA", EN: "Rename — %d FA", ZH: "重命名 — %d FA" },
    PE_TITLE_BTN: { FR: "Confirmer — %d FA", EN: "Confirm — %d FA", ZH: "确认 — %d FA" },
    PE_RENAMED: { FR: "Entité renommée", EN: "Entity renamed", ZH: "实体已重命名" },
    PE_TITLE_SET: { FR: "Titre mis à jour", EN: "Title updated", ZH: "称号已更新" },
    PE_BADGE: { FR: "Badge fidélité", EN: "Loyalty badge", ZH: "忠诚徽章" },
    PE_BADGE_DESC: { FR: "%d / 360 jours ≥ 1 000 000 FA on-chain", EN: "%d / 360 days ≥ 1,000,000 FA on-chain", ZH: "%d / 360 天 ≥ 1,000,000 链上 FA" },

    // options
    OP_TITLE: { FR: "Options", EN: "Options", ZH: "设置" },
    OP_PROFILE: { FR: "Profil joueur", EN: "Player profile", ZH: "玩家资料" },
    OP_ORDINAL: { FR: "Nom ordinal", EN: "Ordinal name", ZH: "Ordinal 名称" },
    OP_ORDINAL_HINT: { FR: "Affiché à la place de ton adresse wallet dans tout le jeu.", EN: "Shown instead of your wallet address everywhere in-game.", ZH: "在游戏中代替你的钱包地址显示。" },
    OP_ORDINAL_SCAN: { FR: "Rechercher mes noms ordinaux", EN: "Find my ordinal names", ZH: "查找我的 Ordinal 名称" },
    OP_ORDINAL_RESCAN: { FR: "Rescanner le wallet", EN: "Rescan wallet", ZH: "重新扫描钱包" },
    OP_ORDINAL_SCANNING: { FR: "Scan des inscriptions on-chain…", EN: "Scanning on-chain inscriptions…", ZH: "正在扫描链上铭文…" },
    OP_ORDINAL_FOUND: { FR: "%d inscription(s) de nom trouvée(s)", EN: "%d name inscription(s) found", ZH: "找到 %d 个名称铭文" },
    OP_ORDINAL_SEARCH: { FR: "Filtrer par nom…", EN: "Filter by name…", ZH: "按名称筛选…" },
    OP_ORDINAL_SHOWING: { FR: "%d sur %d", EN: "%d of %d", ZH: "%d / %d" },
    OP_ORDINAL_NOMATCH: { FR: "Aucun nom ne correspond", EN: "No name matches", ZH: "无匹配名称" },
    OP_ORDINAL_NONE: { FR: "Aucune inscription de nom dans ce wallet", EN: "No name inscriptions in this wallet", ZH: "此钱包中无名称铭文" },
    OP_ORDINAL_USE_ADDR: { FR: "Utiliser l'adresse du wallet", EN: "Use wallet address", ZH: "使用钱包地址" },
    OP_ORDINAL_SELECTED: { FR: "Nom ordinal sélectionné", EN: "Ordinal name selected", ZH: "已选择 Ordinal 名称" },
    OP_ORDINAL_INSCR: { FR: "Inscription", EN: "Inscription", ZH: "铭文" },
    OP_ORDINAL_CLEARED: { FR: "Affichage : adresse du wallet", EN: "Display: wallet address", ZH: "显示：钱包地址" },
    OP_WALLET_ADDR: { FR: "Adresse du wallet", EN: "Wallet address", ZH: "钱包地址" },
    OP_LANG: { FR: "Langue", EN: "Language", ZH: "语言" },
    OP_SOUND: { FR: "Effets sonores", EN: "Sound effects", ZH: "音效" },
    OP_ANIM: { FR: "Animations de combat", EN: "Combat animations", ZH: "战斗动画" },
    OP_SPEED: { FR: "Vitesse de combat", EN: "Combat speed", ZH: "战斗速度" },
    OP_RESET: { FR: "Réinitialiser la progression", EN: "Reset progress", ZH: "重置进度" },
    OP_RESET_CONFIRM: { FR: "Effacer toute la progression ?", EN: "Erase all progress?", ZH: "清除所有进度？" },
    OP_RESET_DONE: { FR: "Progression réinitialisée", EN: "Progress reset", ZH: "进度已重置" },
    OP_DISCONNECT: { FR: "Déconnecter le wallet", EN: "Disconnect wallet", ZH: "断开钱包" },

    // misc
    INSUFFICIENT: { FR: "Solde insuffisant (%d / %d)", EN: "Insufficient balance (%d / %d)", ZH: "余额不足（%d / %d）" },
    CANCEL: { FR: "Annuler", EN: "Cancel", ZH: "取消" },
    CLOSE: { FR: "Fermer", EN: "Close", ZH: "关闭" },
    LIFESTEAL: { FR: "Vol de vie", EN: "Lifesteal", ZH: "吸血" },
    aggressive: { FR: "Agressive", EN: "Aggressive", ZH: "攻击型" },
    berserker: { FR: "Berserker", EN: "Berserker", ZH: "狂战士" },
    tactician: { FR: "Tacticien", EN: "Tactician", ZH: "战术师" },
    lifesteal: { FR: "Vol de vie", EN: "Lifesteal", ZH: "吸血" },
    controller: { FR: "Contrôleur", EN: "Controller", ZH: "控制者" },
    sniper: { FR: "Sniper", EN: "Sniper", ZH: "狙击手" },
    Common: { FR: "Commune", EN: "Common", ZH: "普通" },
    Rare: { FR: "Rare", EN: "Rare", ZH: "稀有" },
    Epic: { FR: "Épique", EN: "Epic", ZH: "史诗" },
    Legendary: { FR: "Légendaire", EN: "Legendary", ZH: "传说" },
  };

  let lang = "FR";
  function setLang(l) { if (["FR", "EN", "ZH"].includes(l)) lang = l; }
  function getLang() { return lang; }

  function fmt(str, args) {
    let i = 0;
    return str.replace(/%[sd]/g, () => {
      const v = args[i++];
      return v == null ? "" : String(v);
    }).replace(/%%/g, "%");
  }

  function t(key, ...args) {
    const entry = T[key];
    if (!entry) return key;
    const s = entry[lang] || entry.EN || key;
    return args.length ? fmt(s, args) : s;
  }

  window.FA_I18N = { t, setLang, getLang, T };
})();
