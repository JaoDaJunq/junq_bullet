(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // Build the plaza once: one repeated 1024px canvas, with details baked in.
  // Nothing in the ground creates world objects or new chunks while the player moves.
  const floorTexture = document.createElement('canvas');
  const floorSize = floorTexture.width = floorTexture.height = 1024;
  const floorTextureCtx = floorTexture.getContext('2d');
  const floorColors = ['#192522', '#1b2825', '#1c2926', '#1a2624', '#1d2926'];
  let floorSeed = 824731;
  const floorRand = () => { floorSeed = (floorSeed * 16807) % 2147483647; return (floorSeed - 1) / 2147483646; };
  floorTextureCtx.fillStyle = '#17211f'; floorTextureCtx.fillRect(0, 0, floorSize, floorSize);
  for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 16; gx++) {
    const x = gx * 64, y = gy * 64;
    floorTextureCtx.fillStyle = floorColors[Math.floor(floorRand() * floorColors.length)];
    floorTextureCtx.fillRect(x + 1, y + 1, 62, 62);
    floorTextureCtx.fillStyle = 'rgba(7,14,14,.22)';
    floorTextureCtx.fillRect(x, y, 64, 1.5); floorTextureCtx.fillRect(x, y, 1.5, 64);
    floorTextureCtx.fillStyle = 'rgba(111,139,124,.055)';
    floorTextureCtx.fillRect(x + 2, y + 2, 60, 1);
    const flecks = Math.floor(floorRand() * 3);
    for (let i = 0; i < flecks; i++) {
      floorTextureCtx.fillStyle = floorRand() > .5 ? 'rgba(116,146,132,.12)' : 'rgba(5,12,12,.16)';
      floorTextureCtx.fillRect(x + 8 + floorRand() * 48, y + 8 + floorRand() * 48, 1 + floorRand() * 2, 1);
    }
  }
  // A few fine, static pavement cracks add a hand-drawn urban feel without per-frame work.
  floorTextureCtx.lineWidth = 1.2; floorTextureCtx.lineCap = 'round';
  for (let i = 0; i < 13; i++) {
    const x = 36 + floorRand() * 952, y = 36 + floorRand() * 952, bend = floorRand() * 10 - 5;
    floorTextureCtx.strokeStyle = 'rgba(5,12,12,.28)'; floorTextureCtx.beginPath();
    floorTextureCtx.moveTo(x, y); floorTextureCtx.lineTo(x + 8 + floorRand() * 10, y + bend);
    floorTextureCtx.lineTo(x + 13 + floorRand() * 18, y + bend + floorRand() * 7 - 3); floorTextureCtx.stroke();
  }
  // Small drain detail, baked into the same repeating texture.
  floorTextureCtx.fillStyle = '#121b19'; floorTextureCtx.fillRect(744, 704, 44, 30);
  floorTextureCtx.strokeStyle = 'rgba(123,151,135,.32)'; floorTextureCtx.lineWidth = 1;
  floorTextureCtx.strokeRect(744.5, 704.5, 43, 29);
  floorTextureCtx.strokeStyle = 'rgba(123,151,135,.25)';
  for (let y = 709; y < 732; y += 5) { floorTextureCtx.beginPath(); floorTextureCtx.moveTo(748, y); floorTextureCtx.lineTo(784, y); floorTextureCtx.stroke(); }
  const floorPattern = ctx.createPattern(floorTexture, 'repeat');
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'), screen: $('screen'), menu: $('menu'), characterSelect: $('character-select'), upgrade: $('upgrade-panel'), pause: $('pause-panel'), over: $('gameover-panel'),
    health: $('health-fill'), healthText: $('health-text'), xp: $('xp-fill'), level: $('level'), timer: $('timer'), kills: $('kills'),
    options: $('upgrade-options'), upgradeEyebrow: $('upgrade-eyebrow'), upgradeTitle: $('upgrade-title'), upgradeHint: $('upgrade-hint'), joystickPosition: $('joystick-position'), joystickPositionLabel: $('joystick-position-label'), joystickSize: $('joystick-size'), joystickSizeLabel: $('joystick-size-label'), handednessToggle: $('handedness-toggle'), autoUltimateToggle: $('auto-ultimate-toggle'), toast: $('toast'), chest: $('chest-status'), chestLabel: $('chest-label'), chestFill: $('chest-fill'),
    pickup: $('pickup-status'), pickupLabel: $('pickup-label'), desktopUlt: $('desktop-ultimate'), desktopUltIcon: $('desktop-ultimate-icon'), desktopUltFill: $('desktop-ult-fill'), desktopUltStatus: $('desktop-ult-status'),
    joystick: $('joystick'), stick: $('stick'), ult: $('ultimate-button'), ultIcon: $('ultimate-icon'), ultLabel: $('ultimate-label'), ultFill: $('ult-fill'), toastUse: $('toast-use'), toastCount: $('toast-count')
  };
  let w = innerWidth, h = innerHeight, dpr = 1, state = 'menu', last = 0, toastTimer = 0, needsRender = true;
  let elapsed = 0, kills = 0, spawnTimer = 0, fireTimer = 0, companionTimer = 0, chestTimer = 55, chest = null, chestProgress = 0, ultimateVfx = null, selectedCharacter = 'jao', bossSpawned = false;
  let toastCount = 0;
  let runStats = { xp: 0, chests: 0, ultimates: 0, upgrades: 0, evolutions: [], bossDefeated: false };
  let batteryReserved = 0, coffeeTimer = 0, shieldHits = 0, doubleXpOrbs = 0;
  const MAX_ENEMIES = 50, MAX_PARTICLES = 160, MAX_XP_ORBS = 100;
  const keys = new Set(), enemies = [], bullets = [], xpOrbs = [], particles = [], floating = [], companions = [], items = [], jaoTrail = [];
  let jaoTrailTimer = 0;
  const player = { character: 'jao', x: 0, y: 0, vx: 0, vy: 0, speed: 205, hp: 100, maxHp: 100, damage: 20, fireRate: .62, shotSpeed: 440, multishot: 1, pierce: 0, critChance: .05, xpGain: 1.4, level: 1, xp: 0, nextXp: 6, invuln: 0, facing: 0, walk: 0, ult: 0, ultMax: 18, ultRadius: 600, ultDamage: 1, nailPower: 1, nailElement: -1, pickup: 160, companion: 0, companionDamage: .55, companionRate: .82, jaoEvolution: 0, jaoEvolutionPath: null, jaoEvolutionFinal: null, jaoChainDamage: 1, jaoChainRadius: 125, jaoChainStun: .22, jaoTrailDamage: .2, jaoTrailLife: 1.25, jaoTrailWidth: 8, jaoTrailSlow: .75, jaoTrailStun: 0, jaoTrailTick: .55, jaoPulseRadius: 105, jaoPulseDamage: .75, jaoPulseStun: .45, jaoPulseShield: false, aliceEvolution: 0, aliceEvolutionPath: null, aliceEvolutionFinal: null, alicePoisonSpread: 0, alicePoisonRadius: 100, alicePoisonDpsBonus: 1, alicePoisonSlow: 0, aliceSlowDuration: 1, aliceSlowSplash: 0, aliceSlowRadius: 85, aliceSlowStun: 0, aliceSlowDamageBonus: 1, aliceLifeStealBonus: 0, aliceKillHeal: 0, aliceCharmTime: 1, aliceCharmMultiplier: 1.25, aliceCharmSpread: 0, guiEvolution: 0, guiEvolutionPath: null, guiEvolutionFinal: null, guiCloseRange: 135, guiCloseDamageBonus: 0, guiCloseStun: 0, guiRicochets: 0, guiRicochetDamage: .62, guiRicochetRange: 125, guiCardDamageBonus: 0, guiUltimateCardBonus: 0, guiUltimateDamageBonus: 0, guiUltimateStunBonus: 0, guiUltimateSpread: 0, kills: 0, shotFlash: 0, aimX: 1, aimY: 0 };
  const atlas = new Image();
  atlas.src = 'assets/jao-walk.png';
  const aliceAtlas = new Image();
  aliceAtlas.src = 'assets/alice-walk.png';
  const guiAtlas = new Image();
  guiAtlas.src = 'assets/gui-walk.png';
  const loadEvolutionAtlas = (file) => { const image = new Image(); image.src = `assets/evolutions/${file}.png`; return image; };
  const evolutionAtlases = {
    jao: { 1: loadEvolutionAtlas('jao-stage1'), 2: loadEvolutionAtlas('jao-stage2') },
    gui: { 1: loadEvolutionAtlas('gui-stage1'), 2: loadEvolutionAtlas('gui-stage2') },
    alice: {
      poison: { 1: loadEvolutionAtlas('alice-poison-stage1'), 2: loadEvolutionAtlas('alice-poison-stage2') },
      slow: { 1: loadEvolutionAtlas('alice-slow-stage1'), 2: loadEvolutionAtlas('alice-slow-stage2') },
      lifesteal: { 1: loadEvolutionAtlas('alice-lifesteal-stage1'), 2: loadEvolutionAtlas('alice-lifesteal-stage2') },
      charm: { 1: loadEvolutionAtlas('alice-charm-stage1'), 2: loadEvolutionAtlas('alice-charm-stage2') }
    }
  };
  const enemySprites = {};
  for (const kind of ['blob', 'bat', 'wolf', 'roach', 'boss']) { enemySprites[kind] = new Image(); enemySprites[kind].src = `assets/enemy-${kind}.png`; }
  const toastSprite = new Image();
  toastSprite.src = 'assets/toastada-gorda.png';
  const atlasFrames = [
    [[115,13,173,300],[85,12,177,302],[51,13,173,301],[27,12,177,302]],
    [[115,6,173,304],[85,6,177,304],[51,6,177,303],[26,0,172,310]],
    [[109,4,173,309],[86,3,183,310],[65,7,177,306],[34,6,170,307]],
    [[109,0,168,296],[79,0,173,296],[45,0,178,296],[28,0,171,293]]
  ];
  let joystickPointer = null, joyX = 0, joyY = 0;
  let audioCtx;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const cardinalFacing = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2) : (dy > 0 ? 0 : Math.PI);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.25); w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize); resize();
  const mobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const frameInterval = mobile ? 1000 / 30 : 1000 / 60;
  const controlSettings = { size: 116, position: 24, side: 'left', autoUltimate: false };
  try {
    const saved = JSON.parse(localStorage.getItem('junqBulletControls') || '{}');
    controlSettings.size = clamp(Number(saved.size) || 116, 96, 148);
    controlSettings.position = clamp(Number(saved.position) || 24, 12, 38);
    controlSettings.side = saved.side === 'right' ? 'right' : 'left';
    controlSettings.autoUltimate = saved.autoUltimate === true;
  } catch (_) {}
  function applyControlSettings(save = false) {
    document.documentElement.style.setProperty('--joystick-size', `${controlSettings.size}px`);
    document.documentElement.style.setProperty('--joystick-position', `${controlSettings.position}vw`);
    document.body.classList.toggle('controls-right', controlSettings.side === 'right');
    ui.joystickPosition.value = controlSettings.position; ui.joystickPositionLabel.textContent = `${controlSettings.position}%`;
    ui.joystickSize.value = controlSettings.size; ui.joystickSizeLabel.textContent = `${controlSettings.size} px`;
    ui.handednessToggle.textContent = `Joystick: lado ${controlSettings.side === 'left' ? 'esquerdo' : 'direito'}`;
    ui.autoUltimateToggle.textContent = `Ultimate automática: ${controlSettings.autoUltimate ? 'ligada' : 'desligada'}`;
    ui.autoUltimateToggle.setAttribute('aria-pressed', String(controlSettings.autoUltimate));
    if (save) { try { localStorage.setItem('junqBulletControls', JSON.stringify(controlSettings)); } catch (_) {} }
  }
  applyControlSettings();

  function showToast(text) { ui.toast.textContent = text; ui.toast.classList.remove('hidden'); toastTimer = 2.3; }
  function setMode(next) {
    state = next;
    needsRender = true;
    ui.screen.classList.toggle('hidden', next === 'running');
    ui.menu.classList.toggle('hidden', next !== 'menu'); ui.characterSelect.classList.toggle('hidden', next !== 'select'); ui.upgrade.classList.toggle('hidden', next !== 'upgrade');
    ui.pause.classList.toggle('hidden', next !== 'paused'); ui.over.classList.toggle('hidden', next !== 'gameover');
    ui.hud.classList.toggle('hidden', next === 'menu' || next === 'select');
    ui.joystick.classList.toggle('hidden', !mobile || next !== 'running'); ui.ult.classList.toggle('hidden', !mobile || next !== 'running');
    ui.desktopUlt.classList.toggle('hidden', mobile || next !== 'running');
    ui.toastUse.classList.toggle('hidden', next !== 'running' || toastCount <= 0);
  }
  function selectCharacter(character) {
    selectedCharacter = character;
    for (const id of ['jao', 'alice', 'gui']) {
      const card = $(`character-${id}`), active = id === character;
      card.classList.toggle('selected', active); card.setAttribute('aria-pressed', String(active));
      card.querySelector('.character-selected-label').textContent = active ? 'SELECIONADO' : `ESCOLHER ${id.toUpperCase()}`;
    }
    $('play-button').textContent = `JOGAR COM ${character === 'alice' ? 'ALICE' : character === 'gui' ? 'GUI' : 'JÃO'}`;
  }
  setMode('menu');
  function reset() {
    elapsed = 0; kills = 0; runStats = { xp: 0, chests: 0, ultimates: 0, upgrades: 0, evolutions: [], bossDefeated: false }; spawnTimer = 0; fireTimer = .25; companionTimer = 0; chestTimer = 55; chest = null; chestProgress = 0; ultimateVfx = null; bossSpawned = false;
    toastCount = 0; batteryReserved = 0; coffeeTimer = 0; shieldHits = 0; doubleXpOrbs = 0; jaoTrail.length = 0; jaoTrailTimer = 0;
    enemies.length = bullets.length = xpOrbs.length = particles.length = floating.length = companions.length = items.length = 0;
    Object.assign(player, { character: selectedCharacter, x: 0, y: 0, vx: 0, vy: 0, speed: 205, hp: 100, maxHp: 100, damage: 20, fireRate: .62, shotSpeed: 440, multishot: 1, pierce: 0, critChance: .05, xpGain: 1.4, level: 1, xp: 0, nextXp: 6, invuln: 0, facing: 0, walk: 0, ult: 0, ultMax: 18, ultRadius: 600, ultDamage: 1, nailPower: 1, nailElement: -1, pickup: 160, companion: 0, companionDamage: .55, companionRate: .82, jaoEvolution: 0, jaoEvolutionPath: null, jaoEvolutionFinal: null, jaoChainDamage: 1, jaoChainRadius: 125, jaoChainStun: .22, jaoTrailDamage: .2, jaoTrailLife: 1.25, jaoTrailWidth: 8, jaoTrailSlow: .75, jaoTrailStun: 0, jaoTrailTick: .55, jaoPulseRadius: 105, jaoPulseDamage: .75, jaoPulseStun: .45, jaoPulseShield: false, aliceEvolution: 0, aliceEvolutionPath: null, aliceEvolutionFinal: null, alicePoisonSpread: 0, alicePoisonRadius: 100, alicePoisonDpsBonus: 1, alicePoisonSlow: 0, aliceSlowDuration: 1, aliceSlowSplash: 0, aliceSlowRadius: 85, aliceSlowStun: 0, aliceSlowDamageBonus: 1, aliceLifeStealBonus: 0, aliceKillHeal: 0, aliceCharmTime: 1, aliceCharmMultiplier: 1.25, aliceCharmSpread: 0, guiEvolution: 0, guiEvolutionPath: null, guiEvolutionFinal: null, guiCloseRange: 135, guiCloseDamageBonus: 0, guiCloseStun: 0, guiRicochets: 0, guiRicochetDamage: .62, guiRicochetRange: 125, guiCardDamageBonus: 0, guiUltimateCardBonus: 0, guiUltimateDamageBonus: 0, guiUltimateStunBonus: 0, guiUltimateSpread: 0, kills: 0, shotFlash: 0, aimX: 1, aimY: 0 });
    if (selectedCharacter === 'jao') Object.assign(player, { speed: 225 });
    if (selectedCharacter === 'gui') Object.assign(player, { speed: 198, damage: 20, fireRate: .82, shotSpeed: 485, ultMax: 21 });
    ui.chest.classList.add('hidden'); ui.pickup.classList.add('hidden'); setMode('running'); updateHud();
  }
  $('start-button').addEventListener('click', () => setMode('select'));
  $('back-to-menu').addEventListener('click', () => setMode('menu'));
  $('character-jao').addEventListener('click', () => selectCharacter('jao'));
  $('character-alice').addEventListener('click', () => selectCharacter('alice'));
  $('character-gui').addEventListener('click', () => selectCharacter('gui'));
  $('play-button').addEventListener('click', () => { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); reset(); });
  $('retry-button').addEventListener('click', reset);
  $('resume-button').addEventListener('click', () => setMode('running'));
  ui.joystickPosition.addEventListener('input', () => { controlSettings.position = Number(ui.joystickPosition.value); applyControlSettings(true); });
  ui.joystickSize.addEventListener('input', () => { controlSettings.size = Number(ui.joystickSize.value); applyControlSettings(true); });
  ui.handednessToggle.addEventListener('click', () => { controlSettings.side = controlSettings.side === 'left' ? 'right' : 'left'; applyControlSettings(true); });
  ui.autoUltimateToggle.addEventListener('click', () => { controlSettings.autoUltimate = !controlSettings.autoUltimate; applyControlSettings(true); });
  $('pause-button').addEventListener('click', () => { if (state === 'running') setMode('paused'); });
  $('ultimate-button').addEventListener('pointerdown', (e) => { e.preventDefault(); castUltimate(); });
  ui.toastUse.addEventListener('click', useToast);
  addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase(); keys.add(key);
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
    if ((key === 'p' || key === 'escape') && state === 'running') setMode('paused');
    else if ((key === 'p' || key === 'escape') && state === 'paused') setMode('running');
    if (key === ' ' && state === 'running') castUltimate();
    if (key === 'f' && state === 'running') useToast();
    if (state === 'upgrade' && ['1','2','3','4'].includes(key) && Number(key) <= currentChoices.length) chooseUpgrade(Number(key) - 1);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  ui.joystick.addEventListener('pointerdown', e => { if (state !== 'running') return; joystickPointer = e.pointerId; ui.joystick.setPointerCapture(e.pointerId); moveStick(e); });
  ui.joystick.addEventListener('pointermove', e => { if (e.pointerId === joystickPointer) moveStick(e); });
  function endStick(e) { if (e.pointerId !== joystickPointer) return; joystickPointer = null; joyX = joyY = 0; ui.stick.style.transform = ''; }
  ui.joystick.addEventListener('pointerup', endStick); ui.joystick.addEventListener('pointercancel', endStick);
  function moveStick(e) { const r = ui.joystick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), len = Math.hypot(dx, dy), travel = r.width * .28, scale = Math.min(1, len / travel); joyX = len ? dx / len * scale : 0; joyY = len ? dy / len * scale : 0; ui.stick.style.transform = `translate(${joyX * travel}px,${joyY * travel}px)`; }

  function sound(freq = 520, duration = .07, type = 'sine', volume = .035) {
    if (!audioCtx) return;
    try { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(volume, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration); } catch (_) {}
  }
  function emit(x, y, color, count = 7, force = 1) { for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) { const a = Math.random() * Math.PI * 2, s = rand(35, 150) * force; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.2, .55), max: .55, color, size: rand(2, 5) }); } }
  function floatText(x, y, text, color = '#fff') { floating.push({ x, y, text, color, life: .8 }); }
  function spawnEnemy(forcedKind = null) {
    if (enemies.length >= MAX_ENEMIES) return;
    const a = rand(0, Math.PI * 2), r = forcedKind === 'boss' ? Math.min(w, h) * .64 : Math.max(w, h) * .62 + rand(35, 100), t = elapsed;
    const roll = Math.random();
    let kind = forcedKind || 'blob';
    if (!forcedKind) { if (t > 14 && roll > .6) kind = 'bat'; if (t > 25 && roll > .79) kind = 'wolf'; if (t > 34 && roll > .91) kind = 'roach'; }
    const stats = kind === 'boss' ? { hp: 1500 + t * 7, speed: 24, radius: 38, damage: 32, color: '#39d9ff', xp: 30 } :
      kind === 'roach' ? { hp: 205 + t * 1.5, speed: 27, radius: 27, damage: 24, color: '#df7a33', xp: 7 } :
      kind === 'wolf' ? { hp: 145 + t * 1.25, speed: 50, radius: 23, damage: 19, color: '#cf7750', xp: 6 } :
      kind === 'bat' ? { hp: 34 + t * .22, speed: 88, radius: 12, damage: 10, color: '#bb78ff', xp: 2 } :
      { hp: 46 + t * .4, speed: 48, radius: 15, damage: 12, color: '#e95d70', xp: 2 };
    enemies.push({ x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r, ...stats, max: stats.hp, kind, hit: 0, wobble: rand(0, 8), bossAttackCooldown: 3.2, bossAttackWindup: 0, bossAttackCount: 0, bossAttackType: 'slam', bossAimX: 0, bossAimY: 0, bossAttackRadius: 152 });
  }
  function damagePlayer(amount) {
    if (player.invuln > 0 || state !== 'running') return false;
    player.invuln = .62;
    if (shieldHits > 0) { shieldHits--; emit(player.x, player.y, '#8ed6ff', 18, 1.1); sound(460, .12, 'triangle', .04); showToast(`Crachá bloqueou o golpe! ${shieldHits ? `Restam ${shieldHits}.` : ''}`); return false; }
    player.hp -= amount; emit(player.x, player.y, '#ff6478', 8); sound(120, .12, 'sawtooth', .035);
    if (player.character === 'jao' && player.jaoEvolutionPath === 'charge') triggerJaoPulse();
    if (player.hp <= 0) gameOver();
    return true;
  }
  function startBossAttack(boss) {
    boss.bossAttackType = boss.bossAttackCount++ % 2 === 0 ? 'slam' : 'beam';
    boss.bossAttackWindup = 1.05; boss.bossAttackCooldown = 5.1;
    if (boss.bossAttackType === 'beam') {
      const dx = player.x - boss.x, dy = player.y - boss.y, length = Math.hypot(dx, dy) || 1;
      boss.bossAimX = boss.x + dx / length * 620; boss.bossAimY = boss.y + dy / length * 620;
      showToast('REI DO POSTE: prepara o raio! Sai da linha!');
    } else showToast('REI DO POSTE: impacto carregando! Sai da área!');
  }
  function resolveBossAttack(boss) {
    if (boss.bossAttackType === 'slam') {
      ultimateVfx = { x: boss.x, y: boss.y, radius: boss.bossAttackRadius, life: .34, max: .34, targets: [], color: '#ff596f', type: 'bossImpact' };
      if (dist2(player, boss) <= (boss.bossAttackRadius + 12) ** 2) { floatText(player.x, player.y - 32, 'IMPACTO!', '#ff8290'); damagePlayer(25); }
    } else {
      const a = { x: boss.x, y: boss.y }, b = { x: boss.bossAimX, y: boss.bossAimY }, abx = b.x - a.x, aby = b.y - a.y;
      const t = clamp(((player.x - a.x) * abx + (player.y - a.y) * aby) / (abx * abx + aby * aby || 1), 0, 1);
      const dx = player.x - (a.x + t * abx), dy = player.y - (a.y + t * aby);
      ultimateVfx = { x: boss.x, y: boss.y, radius: 0, life: .28, max: .28, targets: [{ x: boss.bossAimX, y: boss.bossAimY, phase: 0 }], color: '#ff596f', type: 'chain' };
      if (dx * dx + dy * dy <= 36 ** 2 && t > .04) { floatText(player.x, player.y - 32, 'RAIO!', '#ff8290'); damagePlayer(22); }
    }
    emit(boss.x, boss.y, '#ff6478', 16, 1.2); sound(105, .28, 'sawtooth', .05);
  }
  function nearestEnemy(from = player) { let best = null, bd = Infinity; for (const e of enemies) { const d = dist2(from, e); if (d < bd) { best = e; bd = d; } } return best; }
  const petTypes = ['quokka', 'capybara', 'firefly', 'polish', 'robot', 'raccoon'];
  function petWorldPosition(c) { return { x: player.x + Math.cos(c.angle) * c.orbitX, y: player.y + Math.sin(c.angle) * c.orbitY }; }
  const aliceElements = [
    { id: 'poison', name: 'Verde venenoso', short: 'VENENO', color: '#71e56d' },
    { id: 'slow', name: 'Azul congelante', short: 'LENTO', color: '#63caff' },
    { id: 'lifesteal', name: 'Vermelho vampírico', short: 'ROUBO', color: '#ff5d75' },
    { id: 'charm', name: 'Rosa encantado', short: 'CHARME', color: '#ff79c8' }
  ];
  function fire(target, damage = player.damage, speed = player.shotSpeed, color = '#54dcff', count = 1, element = null, scratch = false, origin = player) {
    if (!target) return;
    const dx = target.x - origin.x, dy = target.y - origin.y, len = Math.hypot(dx, dy) || 1;
    const aim = Math.atan2(dy, dx);
    for (let i = 0; i < count; i++) { const angle = aim + (i - (count - 1) / 2) * .12; bullets.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, life: 1.5, color, element, scratch, basic: origin === player, r: 6, age: 0, trail: [], phase: rand(0, 6.28), pierce: player.pierce, hitEnemies: new Set() }); }
    if (color === '#54dcff' || scratch) { player.aimX = dx / len; player.aimY = dy / len; player.shotFlash = .14; }
    emit(origin.x + dx / len * 14, origin.y + dy / len * 14, color === '#54dcff' ? '#c9f8ff' : color, 4, .45); sound(680, .045, 'triangle', .018);
  }
  function fireCardVolley(target, options = {}) {
    if (!target && !options.allowNoTarget) return;
    let aimX = player.aimX, aimY = player.aimY;
    if (target) {
      const dx = target.x - player.x, dy = target.y - player.y, len = Math.hypot(dx, dy) || 1;
      aimX = dx / len; aimY = dy / len; player.aimX = aimX; player.aimY = aimY;
    } else if (Math.hypot(player.vx, player.vy) > 20) {
      const len = Math.hypot(player.vx, player.vy); aimX = player.vx / len; aimY = player.vy / len;
      player.aimX = aimX; player.aimY = aimY;
    }
    const center = Math.atan2(aimY, aimX), count = options.count ?? 3, spread = options.spread ?? .52;
    const sharedHits = new Set(), speed = options.speed || player.shotSpeed;
    const damageScale = options.damageScale ?? (options.ultimate ? 1.15 : .30);
    const evolutionScale = options.ultimate ? 1 + player.guiUltimateDamageBonus : 1 + player.guiCardDamageBonus;
    const damage = player.damage * damageScale * evolutionScale;
    for (let i = 0; i < count; i++) {
      const angle = center + (count === 1 ? 0 : (i / (count - 1) - .5) * spread);
      const cardColor = options.ultimate ? (i % 2 ? '#ffd16b' : '#fff0ce') : (i % 2 ? '#f25566' : '#f4ead0');
      bullets.push({ x: player.x + aimX * 15, y: player.y + aimY * 15, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage, life: options.life ?? (options.ultimate ? 1.4 : .62), color: cardColor, card: true, ultimate: !!options.ultimate, stun: options.stun || 0,
        r: options.ultimate ? 8 : 6, age: 0, trail: [], phase: rand(0, 6.28), pierce: options.pierce ?? player.pierce, hitEnemies: options.ultimate ? sharedHits : new Set(), guiBouncesLeft: options.ultimate ? 0 : player.guiRicochets });
    }
    player.shotFlash = options.ultimate ? .42 : .14;
    emit(player.x + aimX * 18, player.y + aimY * 18, options.ultimate ? '#ffd16b' : '#fff0ce', options.ultimate ? 30 : 6, options.ultimate ? 1.25 : .45);
    sound(options.ultimate ? 510 : 760, options.ultimate ? .25 : .05, options.ultimate ? 'triangle' : 'square', options.ultimate ? .055 : .025);
  }
  function startUltimateCooldown() { player.ult = player.ultMax * Math.max(.1, 1 - batteryReserved); batteryReserved = 0; }
  function castUltimate() {
    if (state !== 'running' || player.ult > 0) return;
    runStats.ultimates++;
    if (player.character === 'alice') {
      player.nailElement = (player.nailElement + 1) % aliceElements.length;
      const element = aliceElements[player.nailElement]; startUltimateCooldown();
      ultimateVfx = { x: player.x, y: player.y, radius: 135, life: .48, max: .48, targets: [], color: element.color, type: 'palette' };
      emit(player.x, player.y, element.color, 24, 1.25); floatText(player.x, player.y - 44, element.short, element.color);
      sound(540, .22, 'triangle', .045); showToast(`Esmalte ${element.name}: ${element.id === 'poison' ? 'veneno' : element.id === 'slow' ? 'lentidão' : element.id === 'lifesteal' ? 'roubo de vida' : 'inimigos recebem mais dano'}.`);
      updateHud(); return;
    }
    if (player.character === 'gui') {
      const target = nearestEnemy();
      fireCardVolley(target, { allowNoTarget: true, count: 13 + player.guiUltimateCardBonus, spread: 1.92 + player.guiUltimateSpread, speed: player.shotSpeed * 1.18, damageScale: 1.15, life: 1.4, pierce: 99, stun: .9 + player.guiUltimateStunBonus, ultimate: true });
      const angle = Math.atan2(player.aimY, player.aimX); startUltimateCooldown();
      ultimateVfx = { x: player.x, y: player.y, radius: 330, spread: 1.92, angle, life: .62, max: .62, targets: [], color: '#ffd16b', type: 'cardFan' };
      emit(player.x, player.y, '#ffd16b', 28, 1.5); floatText(player.x, player.y - 46, 'MÃO DE TRUNFO!', '#ffe39a');
      showToast('MÃO DE TRUNFO: leque perfurante com atordoamento!'); updateHud(); return;
    }
    const radius = player.ultRadius, radius2 = radius * radius;
    const chainTargets = enemies.filter(e => dist2(player, e) < radius2).sort((a, b) => b.hp - a.hp).slice(0, 4);
    const chainSet = new Set(chainTargets);
    startUltimateCooldown();
    ultimateVfx = { x: player.x, y: player.y, radius, life: .9, max: .9, targets: chainTargets.map(e => ({ x: e.x, y: e.y, phase: rand(0, 6.28) })) };
    emit(player.x, player.y, '#b9f7ff', 32, 2.2); sound(170, .32, 'sawtooth', .045);
    for (const e of enemies) {
      if (dist2(player, e) >= radius2) continue;
      e.hp -= player.damage * 1.1 * player.ultDamage * vulnerabilityMultiplier(e);
      e.hit = .3;
      emit(e.x, e.y, '#c5faff', chainSet.has(e) ? 7 : 2, .8);
      if (chainSet.has(e)) { e.hp -= player.damage * 1.5 * player.ultDamage * vulnerabilityMultiplier(e); e.stun = 1.2; floatText(e.x, e.y - 20, '⚡ STUN', '#89edff'); }
      if (e.hp <= 0) defeat(e);
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].hp <= 0) enemies.splice(i, 1);
    showToast('ULTIMATE: RAJADA DE CHOQUE!');
  }
  function applyNailEffect(enemy, element, damage) {
    if (!element) return;
    if (element.id === 'poison') {
      enemy.poisonTimer = Math.max(enemy.poisonTimer || 0, 4 * player.nailPower);
      enemy.poisonDps = Math.max(enemy.poisonDps || 0, player.damage * .22 * player.nailPower * player.alicePoisonDpsBonus);
      if (player.alicePoisonSlow > 0) enemy.slowTimer = Math.max(enemy.slowTimer || 0, player.alicePoisonSlow);
      if (player.character === 'alice' && player.aliceEvolutionPath === 'poison' && player.alicePoisonSpread > 0) {
        const spreadTargets = enemies.filter(other => other !== enemy && other.hp > 0 && dist2(enemy, other) <= player.alicePoisonRadius ** 2)
          .sort((a, b) => dist2(enemy, a) - dist2(enemy, b)).slice(0, 4);
        for (const other of spreadTargets) {
          other.poisonTimer = Math.max(other.poisonTimer || 0, 4 * player.nailPower);
          other.poisonDps = Math.max(other.poisonDps || 0, player.damage * .22 * player.nailPower * player.alicePoisonDpsBonus * player.alicePoisonSpread);
          if (player.alicePoisonSlow > 0) other.slowTimer = Math.max(other.slowTimer || 0, player.alicePoisonSlow);
          emit(other.x, other.y, '#8cef78', 1, .28);
        }
      }
    } else if (element.id === 'slow') {
      const duration = 2.4 * player.nailPower * player.aliceSlowDuration;
      enemy.slowTimer = Math.max(enemy.slowTimer || 0, duration);
      if (player.aliceSlowStun > 0) enemy.stun = Math.max(enemy.stun || 0, player.aliceSlowStun);
      if (player.character === 'alice' && player.aliceEvolutionPath === 'slow' && player.aliceSlowSplash > 0) {
        const splashTargets = enemies.filter(other => other !== enemy && other.hp > 0 && dist2(enemy, other) <= player.aliceSlowRadius ** 2)
          .sort((a, b) => dist2(enemy, a) - dist2(enemy, b)).slice(0, 4);
        for (const other of splashTargets) {
          other.slowTimer = Math.max(other.slowTimer || 0, duration);
          other.hp -= player.damage * player.aliceSlowSplash; other.hit = .12;
          if (other.hp <= 0) defeat(other);
          if (player.aliceSlowStun > 0) other.stun = Math.max(other.stun || 0, player.aliceSlowStun);
          emit(other.x, other.y, '#77ccff', 2, .32);
        }
      }
    } else if (element.id === 'lifesteal') {
      enemy.aliceLifestealMark = true;
      player.hp = Math.min(player.maxHp, player.hp + damage * Math.min(.65, .22 * player.nailPower + player.aliceLifeStealBonus));
    } else if (element.id === 'charm') {
      const duration = 4 * player.nailPower * player.aliceCharmTime;
      enemy.vulnerableTimer = Math.max(enemy.vulnerableTimer || 0, duration); enemy.aliceCharmMark = true;
      if (player.character === 'alice' && player.aliceEvolutionPath === 'charm' && player.aliceCharmSpread > 0) {
        const charmTargets = enemies.filter(other => other !== enemy && other.hp > 0 && dist2(enemy, other) <= player.aliceCharmSpread ** 2)
          .sort((a, b) => dist2(enemy, a) - dist2(enemy, b)).slice(0, 4);
        for (const other of charmTargets) { other.vulnerableTimer = Math.max(other.vulnerableTimer || 0, 2 * player.nailPower); other.aliceCharmMark = true; }
      }
    }
  }
  function defeat(e) { if (e.defeated) return; e.defeated = true; if (e.kind === 'boss') runStats.bossDefeated = true; if (player.character === 'alice' && player.aliceEvolutionPath === 'lifesteal' && e.aliceLifestealMark && player.aliceKillHeal > 0) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * player.aliceKillHeal); kills++; player.kills++; emit(e.x, e.y, e.color, 9); if (xpOrbs.length >= MAX_XP_ORBS) xpOrbs.shift(); xpOrbs.push({ x: e.x, y: e.y, value: e.xp, r: 6, phase: rand(0, 6) }); sound(250 + Math.random() * 100, .05, 'square', .012); }
  function vulnerabilityMultiplier(enemy) { return enemy.vulnerableTimer > 0 ? (player.character === 'alice' && player.aliceEvolutionPath === 'charm' ? player.aliceCharmMultiplier : 1.25) : 1; }
  function chainShock(first, baseDamage) {
    const linked = [first], targets = [];
    let current = first;
    for (let hop = 1; hop < 3; hop++) {
      const next = enemies.filter(e => e.hp > 0 && !linked.includes(e) && dist2(current, e) <= player.jaoChainRadius ** 2)
        .sort((a, b) => dist2(current, a) - dist2(current, b))[0];
      if (!next) break;
      linked.push(next);
      const damage = baseDamage * (hop === 1 ? .7 : .5) * player.jaoChainDamage * vulnerabilityMultiplier(next);
      next.hp -= damage; next.hit = .18; next.stun = Math.max(next.stun || 0, player.jaoChainStun);
      emit(next.x, next.y, '#6ceaff', 5, .52);
      floatText(next.x, next.y - next.radius - 5, `⚡ ${Math.round(damage)}`, '#a4f4ff');
      targets.push({ x: next.x, y: next.y, phase: rand(0, 6.28) });
      if (next.hp <= 0) defeat(next);
      current = next;
    }
    if (targets.length) ultimateVfx = { x: first.x, y: first.y, radius: 0, life: .24, max: .24, targets, color: '#55dcff', type: 'chain' };
  }
  function triggerJaoPulse() {
    const radius2 = player.jaoPulseRadius ** 2;
    ultimateVfx = { x: player.x, y: player.y, radius: player.jaoPulseRadius, life: .36, max: .36, targets: [], color: '#bd91ff', type: 'pulse' };
    emit(player.x, player.y, '#bd91ff', 18, .8);
    for (const e of enemies) {
      if (dist2(player, e) > radius2) continue;
      e.hp -= player.damage * player.jaoPulseDamage; e.hit = .2;
      e.stun = Math.max(e.stun || 0, player.jaoPulseStun);
      emit(e.x, e.y, '#c6a5ff', 3, .45);
    }
    if (player.jaoPulseShield) shieldHits = Math.min(2, shieldHits + 1);
  }
  function jaoEvolutionChoices(tier) {
    const choice = (id, icon, title, desc, color, apply) => ({ id, icon, title, desc, color, rarity: 'legendary', category: `EVOLUÇÃO ${tier === 16 ? 'I' : 'II'}`, evolution: tier, apply });
    if (tier === 16) return [
      choice('trail', 'ϟ', 'Rastro de Trovão', 'Enquanto corre, deixa raios no chão que ferem e desaceleram quem passar por cima.', '#5deaff', () => {
        player.jaoEvolutionPath = 'trail'; player.jaoEvolution = 1;
      }),
      choice('chain', '↯', 'Condutor de Horda', 'Seu choque em cadeia ganha alcance e força. Continua limitado a três inimigos por tiro.', '#ffe174', () => {
        player.jaoEvolutionPath = 'chain'; player.jaoEvolution = 1; player.jaoChainDamage = 1.3; player.jaoChainRadius = 150;
      }),
      choice('charge', '◉', 'Pulso de Contracarga', 'Ao sofrer um golpe, libera uma descarga ao redor que causa dano e atordoa os inimigos.', '#c49aff', () => {
        player.jaoEvolutionPath = 'charge'; player.jaoEvolution = 1;
      })
    ];
    const finish = (id, icon, title, desc, color, apply) => choice(id, icon, title, desc, color, () => {
      apply(); player.jaoEvolution = 2; player.jaoEvolutionFinal = id;
    });
    const branches = {
      trail: [
        finish('storm-road', 'ϟ', 'Tempestade de Asfalto', 'O rastro dura mais e cada raio causa dano maior.', '#5deaff', () => { player.jaoTrailLife += .7; player.jaoTrailDamage += .14; player.jaoTrailWidth += 4; }),
        finish('paralyzing-trail', '❄', 'Rastro Paralisante', 'Os raios deixam a horda ainda mais lenta e aplicam pequenos atordoamentos.', '#8cefff', () => { player.jaoTrailSlow += .5; player.jaoTrailStun = .16; }),
        finish('conductor-step', '➤', 'Passo Condutor', 'Ganha 12% de velocidade; o rastro fica mais largo e doloroso.', '#b3f7ff', () => { player.speed *= 1.12; player.jaoTrailWidth += 5; player.jaoTrailDamage += .08; })
      ],
      chain: [
        finish('hot-arc', '↯', 'Arco Superaquecido', 'Os saltos elétricos causam muito mais dano.', '#ffe174', () => { player.jaoChainDamage += .5; }),
        finish('wide-network', '⌁', 'Rede Condutora', 'O choque alcança alvos mais distantes, sem passar do limite de três.', '#fff0ae', () => { player.jaoChainRadius += 75; }),
        finish('long-shock', 'ϟ', 'Choque Prolongado', 'Cada inimigo atingido pelo encadeamento fica atordoado por mais tempo.', '#ffd87c', () => { player.jaoChainStun += .42; })
      ],
      charge: [
        finish('volt-shield', '⬡', 'Escudo Voltaico', 'Cada contragolpe também recarrega um bloqueio de dano.', '#c49aff', () => { player.jaoPulseShield = true; }),
        finish('wide-pulse', '◉', 'Pulso Expandido', 'A descarga ganha muito mais alcance e dano.', '#d6b8ff', () => { player.jaoPulseRadius += 70; player.jaoPulseDamage += .45; }),
        finish('deep-resonance', 'ϟ', 'Ressonância Profunda', 'O pulso atordoa por mais tempo e a ultimate recarrega 10% mais rápido.', '#a98aff', () => { player.jaoPulseStun += .45; player.ultMax *= .9; })
      ]
    };
    return branches[player.jaoEvolutionPath] || [];
  }
  function aliceEvolutionChoices(tier) {
    const choice = (id, icon, title, desc, color, apply) => ({ id, icon, title, desc, color, rarity: 'legendary', category: `EVOLUÇÃO ${tier === 16 ? 'I' : 'II'}`, evolution: tier, apply });
    if (tier === 16) return [
      choice('poison', '☠', 'Jardim Tóxico', 'O esmalte verde espalha veneno para até quatro inimigos próximos.', '#80e36e', () => {
        player.aliceEvolutionPath = 'poison'; player.aliceEvolution = 1; player.alicePoisonSpread = .55;
      }),
      choice('slow', '❄', 'Esmalte Glacial', 'O azul desacelera por mais tempo e o arranhão espalha uma onda de frio.', '#68cfff', () => {
        player.aliceEvolutionPath = 'slow'; player.aliceEvolution = 1; player.aliceSlowDuration = 1.3; player.aliceSlowSplash = .12; player.aliceSlowRadius = 95;
      }),
      choice('lifesteal', '♥', 'Vermelho Vampírico', 'O vermelho rouba mais vida e marca inimigos para recuperar vida ao derrotá-los.', '#ff637a', () => {
        player.aliceEvolutionPath = 'lifesteal'; player.aliceEvolution = 1; player.aliceLifeStealBonus = .12;
      }),
      choice('charm', '✿', 'Rosa Hipnótico', 'O rosa marca alvos por mais tempo e aumenta o dano que eles recebem.', '#ff82ce', () => {
        player.aliceEvolutionPath = 'charm'; player.aliceEvolution = 1; player.aliceCharmTime = 1.25; player.aliceCharmMultiplier = 1.45;
      })
    ];
    const finish = (id, icon, title, desc, color, apply) => choice(id, icon, title, desc, color, () => {
      apply(); player.aliceEvolution = 2; player.aliceEvolutionFinal = id;
    });
    const branches = {
      poison: [
        finish('green-tide', '☠', 'Maré Verde', 'O contágio alcança uma área maior e espalha veneno mais potente.', '#80e36e', () => { player.alicePoisonRadius += 65; player.alicePoisonSpread += .2; }),
        finish('caustic-claws', '✦', 'Garras Cáusticas', 'Seu veneno causa 45% mais dano ao longo do tempo.', '#a9f28b', () => { player.alicePoisonDpsBonus += .45; }),
        finish('noxious-mist', '♧', 'Névoa Nociva', 'Inimigos envenenados também ficam lentos por mais de um segundo.', '#72dba0', () => { player.alicePoisonSlow = 1.25; })
      ],
      slow: [
        finish('ice-shards', '❄', 'Estilhaço Gélido', 'A onda azul fica maior e seus estilhaços causam dano extra.', '#68cfff', () => { player.aliceSlowRadius += 30; player.aliceSlowSplash += .14; }),
        finish('deep-freeze', '✧', 'Geada Profunda', 'A lentidão dura mais e o arranhão congela os alvos por um instante.', '#9ceaff', () => { player.aliceSlowDuration += .65; player.aliceSlowStun = .22; }),
        finish('brittle-point', '◇', 'Ponto de Ruptura', 'Alvos lentos recebem 30% mais dano dos ataques da Alice.', '#7ab9ff', () => { player.aliceSlowDamageBonus = 1.3; })
      ],
      lifesteal: [
        finish('deep-siphon', '♥', 'Sifão Profundo', 'O esmalte vermelho rouba ainda mais vida a cada arranhão.', '#ff637a', () => { player.aliceLifeStealBonus += .16; }),
        finish('blood-banquet', '♨', 'Banquete Carmesim', 'Derrotar um alvo marcado recupera 4% da vida máxima.', '#ff8b8b', () => { player.aliceKillHeal = .04; }),
        finish('red-velocity', '➤', 'Velocidade Rubra', 'Roubar vida também deixa a Alice 10% mais rápida.', '#ff536c', () => { player.speed *= 1.1; player.aliceLifeStealBonus += .06; })
      ],
      charm: [
        finish('fatal-fascination', '✿', 'Fascínio Fatal', 'Alvos rosa recebem ainda mais dano de todos os ataques.', '#ff82ce', () => { player.aliceCharmMultiplier = 1.7; }),
        finish('lasting-mark', '♡', 'Marca Duradoura', 'A vulnerabilidade do esmalte rosa dura mais que o dobro.', '#ffa5dd', () => { player.aliceCharmTime = 2.25; }),
        finish('charm-wave', '❀', 'Encanto em Cadeia', 'O rosa também marca até quatro inimigos ao redor do alvo atingido.', '#f775c3', () => { player.aliceCharmSpread = 120; })
      ]
    };
    return branches[player.aliceEvolutionPath] || [];
  }
  function guiEvolutionChoices(tier) {
    const choice = (id, icon, title, desc, color, apply) => ({ id, icon, title, desc, color, rarity: 'legendary', category: `EVOLUÇÃO ${tier === 16 ? 'I' : 'II'}`, evolution: tier, apply });
    if (tier === 16) return [
      choice('close-range', '▣', 'Doze de Baralho', 'As cartas causam mais dano quando acertam inimigos bem de perto, mantendo o cone curto.', '#ff9b47', () => {
        player.guiEvolutionPath = 'close'; player.guiEvolution = 1; player.guiCloseDamageBonus = .3; player.guiCloseRange = 135;
      }),
      choice('ricochet', '↗', 'Cartas Ricochete', 'Cada carta básica que acerta pode saltar para mais um inimigo próximo.', '#74e7ff', () => {
        player.guiEvolutionPath = 'ricochet'; player.guiEvolution = 1; player.guiRicochets = 1;
      }),
      choice('trump', '♛', 'Trunfo Premiado', 'Suas cartas ganham força e a Mão de Trunfo dispara ainda mais cartas.', '#ffd16b', () => {
        player.guiEvolutionPath = 'trump'; player.guiEvolution = 1; player.guiCardDamageBonus = .15; player.guiUltimateCardBonus = 4;
      })
    ];
    const finish = (id, icon, title, desc, color, apply) => choice(id, icon, title, desc, color, () => {
      apply(); player.guiEvolution = 2; player.guiEvolutionFinal = id;
    });
    const branches = {
      close: [
        finish('heavy-hand', '▣', 'Mão Pesada', 'Aumenta ainda mais o dano das cartas a curtíssima distância.', '#ff9b47', () => { player.guiCloseDamageBonus += .4; }),
        finish('knockout', '✹', 'Nocaute no Baralho', 'Cartas que acertam de perto também atordoam o alvo.', '#ffbd67', () => { player.guiCloseStun = .28; }),
        finish('close-range', '➤', 'Alcance de Braço', 'A zona de dano máximo fica maior e você recebe 10% de velocidade.', '#ffd58a', () => { player.guiCloseRange += 65; player.speed *= 1.1; })
      ],
      ricochet: [
        finish('chain-deck', '↗', 'Embaralhamento Selvagem', 'Cada carta pode ricochetear em até dois inimigos adicionais.', '#74e7ff', () => { player.guiRicochets += 2; }),
        finish('sharp-edges', '✦', 'Bordas Afiadas', 'Os ricochetes perdem menos dano ao saltar.', '#a5f2ff', () => { player.guiRicochetDamage += .22; }),
        finish('long-bounce', '⌁', 'Salto de Mestre', 'As cartas ricocheteiam entre alvos mais distantes.', '#8bdcff', () => { player.guiRicochetRange += 90; })
      ],
      trump: [
        finish('full-house', '♛', 'Mão Cheia', 'A Mão de Trunfo lança mais seis cartas no leque.', '#ffd16b', () => { player.guiUltimateCardBonus += 6; }),
        finish('royal-flush', '♠', 'Flush Real', 'A ultimate causa mais dano e mantém os inimigos atordoados por mais tempo.', '#ffe6a0', () => { player.guiUltimateDamageBonus += .35; player.guiUltimateStunBonus += .45; }),
        finish('quick-shuffle', '⟳', 'Embaralha Rápido', 'A ultimate recarrega 18% mais rápido; suas cartas básicas ficam 10% mais fortes.', '#ffbd67', () => { player.ultMax *= .82; player.guiCardDamageBonus += .1; })
      ]
    };
    return branches[player.guiEvolutionPath] || [];
  }
  function ricochetGuiCard(bullet, hitEnemy) {
    if (player.character !== 'gui' || player.guiEvolutionPath !== 'ricochet' || bullet.ultimate || bullet.guiBouncesLeft <= 0) return;
    const next = enemies.filter(enemy => enemy !== hitEnemy && enemy.hp > 0 && !bullet.hitEnemies.has(enemy) && dist2(hitEnemy, enemy) <= player.guiRicochetRange ** 2)
      .sort((a, b) => dist2(hitEnemy, a) - dist2(hitEnemy, b))[0];
    if (!next) return;
    const dx = next.x - hitEnemy.x, dy = next.y - hitEnemy.y, length = Math.hypot(dx, dy) || 1;
    const hitEnemies = new Set(bullet.hitEnemies);
    bullets.push({ x: hitEnemy.x, y: hitEnemy.y, vx: dx / length * player.shotSpeed * 1.08, vy: dy / length * player.shotSpeed * 1.08,
      damage: bullet.damage * player.guiRicochetDamage, life: 1.05, color: '#8cecff', card: true, ultimate: false, stun: 0,
      r: 6, age: 0, trail: [], phase: rand(0, 6.28), pierce: 0, hitEnemies, guiBouncesLeft: bullet.guiBouncesLeft - 1 });
    emit(hitEnemy.x, hitEnemy.y, '#8cecff', 3, .35);
  }
  function addXp(value) { const gained = Math.round(value * player.xpGain); runStats.xp += gained; player.xp += gained; if (player.xp >= player.nextXp) { player.xp -= player.nextXp; player.level++; player.nextXp = Math.round(player.nextXp * 1.28 + 2); makeUpgradeOptions(); setMode('upgrade'); sound(740, .15, 'sine', .04); } }
  const upgrades = [
    { id: 'rapid', rarity: 'rare', icon: '⚡', category: 'COMBATE', title: 'Gatilho rápido', desc: 'Atira 18% mais rápido.', apply: () => player.fireRate = Math.max(.16, player.fireRate * .82) },
    { id: 'damage', rarity: 'epic', icon: '✦', category: 'COMBATE', title: 'Carga forte', desc: 'Seus tiros causam 30% mais dano.', apply: () => player.damage *= 1.3 },
    { id: 'speed', rarity: 'common', icon: '➤', category: 'MOVIMENTO', title: 'Passo ligeiro', desc: 'Move 12% mais rápido.', apply: () => player.speed *= 1.12 },
    { id: 'toughness', rarity: 'common', icon: '▰', category: 'SOBREVIVÊNCIA', title: 'Casca grossa', desc: '+15 de vida máxima e recupera 15.', apply: () => { player.maxHp += 15; player.hp = Math.min(player.maxHp, player.hp + 15); } },
    { id: 'heart', rarity: 'rare', icon: '♥', category: 'SOBREVIVÊNCIA', title: 'Fôlego extra', desc: '+25 de vida máxima e recupera 25.', apply: () => { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); } },
    { id: 'magnet', rarity: 'common', icon: '◉', category: 'SUPORTE', title: 'Ímã de XP', desc: 'Atrai experiência de mais longe.', apply: () => player.pickup += 45 },
    { id: 'companion', rarity: 'legendary', icon: '◈', category: 'SUPORTE', title: 'Mini parceiro', desc: 'Um pet entra na equipe e dispara contra os inimigos.', apply: () => { player.companion++; if (companions.length < player.companion) { const index = companions.length, base = companions[0]?.angle ?? Math.random() * Math.PI * 2, ring = Math.floor(index / petTypes.length); companions.push({ type: petTypes[index % petTypes.length], angle: base + index * (Math.PI * 2 / petTypes.length), orbitX: 38 + ring * 12, orbitY: 22 + ring * 8 }); } } },
    { id: 'xp', rarity: 'common', icon: '✧', category: 'PROGRESSÃO', title: 'Instinto de sobrevivência', desc: 'Ganha 20% mais XP ao coletar orbes.', apply: () => player.xpGain *= 1.2 },
    { id: 'shot-speed', rarity: 'rare', icon: '➤', category: 'COMBATE', title: 'Disparo veloz', desc: 'Seus projéteis viajam 22% mais rápido.', apply: () => player.shotSpeed *= 1.22 },
    { id: 'multishot', rarity: 'rare', icon: '»', category: 'COMBATE', title: 'Tiro duplo', desc: 'Dispara +1 projétil em leque a cada ataque.', apply: () => player.multishot = Math.min(5, player.multishot + 1) },
    { id: 'pierce', rarity: 'epic', icon: '↠', category: 'COMBATE', title: 'Perfuração', desc: 'Cada projétil atravessa +1 inimigo.', apply: () => player.pierce = Math.min(4, player.pierce + 1) },
    { id: 'critical', rarity: 'epic', icon: '✹', category: 'COMBATE', title: 'Ponto fraco', desc: '+10% de chance de causar o dobro de dano.', apply: () => player.critChance = Math.min(.65, player.critChance + .1) },
    { id: 'ultimate', rarity: 'epic', icon: 'ϟ', category: 'ULTIMATE', title: 'Bateria carregada', desc: 'Reduz em 18% o tempo de recarga da ultimate.', apply: () => player.ultMax = Math.max(8, player.ultMax * .82) },
    { id: 'companion-bond', rarity: 'legendary', icon: '✺', category: 'SUPORTE', title: 'Laço elétrico', desc: 'Mini parceiros causam 40% mais dano e atiram 20% mais rápido.', apply: () => { player.companionDamage *= 1.4; player.companionRate = Math.max(.3, player.companionRate * .8); } },
    { id: 'ult-field', rarity: 'legendary', icon: 'ϟ', category: 'ULTIMATE', title: 'Campo absoluto', desc: 'A ultimate ganha alcance e dano; esmaltes da Alice ficam mais fortes.', apply: () => { player.ultRadius *= 1.18; player.ultDamage *= 1.2; player.nailPower *= 1.18; } }
  ];
  const rarityNames = { common: 'COMUM', rare: 'RARO', epic: 'ÉPICO', legendary: 'LENDÁRIO' };
  const rarityChances = { common: 45, rare: 30, epic: 18, legendary: 7 };
  let currentChoices = [];
  function rollRarity(available) { const pool = Object.entries(rarityChances).filter(([rarity]) => available.has(rarity)); const total = pool.reduce((sum, [, weight]) => sum + weight, 0); let roll = Math.random() * total; for (const [rarity, weight] of pool) { roll -= weight; if (roll < 0) return rarity; } return pool[pool.length - 1][0]; }
  function makeUpgradeOptions() {
    const evolutionLevel = player.character === 'jao' && player.level === 16 && player.jaoEvolution === 0 ? 16 :
      player.character === 'jao' && player.level === 36 && player.jaoEvolution === 1 ? 36 :
      player.character === 'alice' && player.level === 16 && player.aliceEvolution === 0 ? 16 :
      player.character === 'alice' && player.level === 36 && player.aliceEvolution === 1 ? 36 :
      player.character === 'gui' && player.level === 16 && player.guiEvolution === 0 ? 16 :
      player.character === 'gui' && player.level === 36 && player.guiEvolution === 1 ? 36 : 0;
    const isAlice = player.character === 'alice', isGui = player.character === 'gui';
    currentChoices = evolutionLevel ? (isAlice ? aliceEvolutionChoices(evolutionLevel) : isGui ? guiEvolutionChoices(evolutionLevel) : jaoEvolutionChoices(evolutionLevel)) : [];
    ui.options.classList.toggle('evolution-four', isAlice && evolutionLevel === 16);
    if (evolutionLevel) {
      const pathNames = isAlice
        ? { poison: 'JARDIM TÓXICO', slow: 'ESMALTE GLACIAL', lifesteal: 'VERMELHO VAMPÍRICO', charm: 'ROSA HIPNÓTICO' }
        : isGui ? { close: 'DOZE DE BARALHO', ricochet: 'CARTAS RICOCHETE', trump: 'TRUNFO PREMIADO' }
          : { trail: 'RASTRO DE TROVÃO', chain: 'CONDUTOR DE HORDA', charge: 'PULSO DE CONTRACARGA' };
      const selectedPath = isAlice ? player.aliceEvolutionPath : isGui ? player.guiEvolutionPath : player.jaoEvolutionPath;
      const characterName = isAlice ? 'DA ALICE' : isGui ? 'DO GUI' : 'DO JÃO';
      ui.upgradeEyebrow.textContent = evolutionLevel === 16 ? `NÍVEL 16 · EVOLUÇÃO ${characterName}` : `NÍVEL 36 · ${pathNames[selectedPath] || 'FORMA FINAL'}`;
      ui.upgradeTitle.textContent = evolutionLevel === 16 ? (isAlice ? 'Escolhe teu esmalte supremo.' : isGui ? 'Escolhe como vai dominar o baralho.' : 'Escolhe teu caminho elétrico.') : 'Desperta a forma final.';
      ui.upgradeHint.textContent = evolutionLevel === 16
        ? (isAlice ? 'Escolhe uma cor para evoluir. O esmalte reforça uma habilidade e muda o visual da Alice.' : isGui ? 'Escolhe uma rota: cartas mais fortes de perto, ricochetes ou uma Mão de Trunfo ainda maior.' : 'Escolhe uma habilidade exclusiva. Ela muda teu estilo de jogo e a aparência do Jão.')
        : `Escolhe como evoluir o caminho que tu abriu no nível 16. ${isAlice ? 'O esmalte escolhido define as três opções.' : isGui ? 'Cada estilo de baralho tem três formas finais.' : 'Cada rota tem uma forma final.'}`;
    } else {
      const remaining = [...upgrades];
      while (currentChoices.length < 3 && remaining.length) {
        const rarity = rollRarity(new Set(remaining.map(u => u.rarity))), pool = remaining.filter(u => u.rarity === rarity);
        const chosen = pool[Math.floor(Math.random() * pool.length)]; currentChoices.push(chosen); remaining.splice(remaining.indexOf(chosen), 1);
      }
      ui.upgradeEyebrow.textContent = 'NÍVEL ALCANÇADO · ESCOLHE 1';
      ui.upgradeTitle.textContent = 'Qual vai ser teu próximo poder?';
      ui.upgradeHint.innerHTML = 'Usa <b>1, 2 ou 3</b> para escolher. Chance por card: <b>comum 45% · raro 30% · épico 18% · lendário 7%</b>.';
    }
    ui.options.innerHTML = '';
    currentChoices.forEach((u, i) => {
      const chance = rarityChances[u.rarity], b = document.createElement('button'), guaranteed = !!u.evolution;
      b.className = `upgrade-card rarity-${u.rarity}${guaranteed ? ' evolution-choice' : ''}`;
      if (guaranteed) { b.style.setProperty('--card-accent', u.color); b.style.setProperty('--card-glow', u.color); }
      b.setAttribute('aria-label', guaranteed ? `${u.category}: ${u.title}. ${u.desc}` : `${rarityNames[u.rarity]} (${chance}% por card) · ${i + 1}: ${u.title}. ${u.desc}`);
      const badge = guaranteed ? `EVOLUÇÃO · NV ${u.evolution}` : `${rarityNames[u.rarity]} · ${chance}%`;
      b.innerHTML = `<span class="card-rarity">${badge}</span><span class="card-kicker">${u.category}</span><span class="card-symbol">${u.icon}</span><span class="card-key">${i + 1}</span><h3>${u.title}</h3><p>${u.desc}</p><span class="card-pick">ESCOLHER <b>↗</b></span>`;
      b.addEventListener('click', () => chooseUpgrade(i)); ui.options.appendChild(b);
    });
  }
  function chooseUpgrade(i) { if (state !== 'upgrade' || !currentChoices[i]) return; const choice = currentChoices[i]; choice.apply(); runStats.upgrades++; if (choice.evolution) runStats.evolutions.push(choice.title); setMode('running'); showToast(choice.evolution ? `${player.character === 'alice' ? 'Alice' : player.character === 'gui' ? 'Gui' : 'Jão'} evoluiu: ${choice.title}!` : `${choice.title} adquirido!`); }
  function spawnChest() { const a = rand(0, 6.28), r = rand(230, 380); chest = { x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r, opened: false, pulse: 0 }; showToast('Um baú apareceu por perto. Procura no mapa!'); }
  const chestDrops = [
    { kind: 'toast', name: 'Torrada da Gorda', weight: 40, color: '#ffd76b', icon: '🍞' },
    { kind: 'battery', name: 'Bateria de bolso', weight: 20, color: '#79eaff', icon: 'ϟ' },
    { kind: 'coffee', name: 'Café gelado', weight: 18, color: '#c99565', icon: '☕' },
    { kind: 'shield', name: 'Crachá blindado', weight: 12, color: '#8ed6ff', icon: '⬡' },
    { kind: 'xp-snack', name: 'Snack de XP', weight: 10, color: '#ad9aff', icon: '✦' }
  ];
  function openChest() {
    runStats.chests++;
    const total = chestDrops.reduce((sum, drop) => sum + drop.weight, 0); let roll = Math.random() * total, reward = chestDrops[0];
    for (const drop of chestDrops) { roll -= drop.weight; if (roll < 0) { reward = drop; break; } }
    items.push({ x: chest.x, y: chest.y, kind: reward.kind, pulse: 0, age: 0 }); chestProgress = 0;
    emit(chest.x, chest.y, reward.color, 35, 1.6); sound(880, .3, 'triangle', .05); floatText(chest.x, chest.y - 35, reward.icon, reward.color);
    showToast(`Baú aberto: ${reward.name} caiu! Chega perto para pegar.`); chest = null; ui.chest.classList.add('hidden');
  }
  function applyChestItem(item) {
    const reward = chestDrops.find(drop => drop.kind === item.kind); if (!reward) return;
    if (item.kind === 'battery') {
      const wasCooling = player.ult > 0;
      if (wasCooling) player.ult = Math.max(0, player.ult - player.ultMax * .5);
      else batteryReserved = Math.min(.8, batteryReserved + .5);
      showToast(wasCooling ? 'Bateria: metade da recarga da ultimate concluída.' : `Bateria guardada: próxima recarga da ultimate será ${Math.round(batteryReserved * 100)}% menor.`);
    } else if (item.kind === 'coffee') {
      coffeeTimer = Math.max(coffeeTimer, 8); showToast('Café gelado: +20% velocidade de ataque por 8s.');
    } else if (item.kind === 'shield') {
      shieldHits = Math.min(2, shieldHits + 1); showToast(`Crachá blindado: bloqueia ${shieldHits} golpe${shieldHits > 1 ? 's' : ''}.`);
    } else if (item.kind === 'xp-snack') {
      doubleXpOrbs = Math.min(9, doubleXpOrbs + 3); showToast(`Snack de XP: próximos ${doubleXpOrbs} orbes valem o dobro.`);
    }
    emit(item.x, item.y, reward.color, 20, 1); floatText(item.x, item.y - 25, reward.name, reward.color);
  }

  function useToast() {
    if (toastCount <= 0) { showToast('Não tem Torrada da Gorda no inventário.'); return; }
    if (player.hp >= player.maxHp) { showToast('Tua vida já está cheia. Guarda a torrada para depois!'); return; }
    const healed = Math.min(18, player.maxHp - player.hp);
    player.hp += healed; toastCount--;
    emit(player.x, player.y, '#8dffb0', 18, .9); floatText(player.x, player.y - 34, `+${Math.round(healed)} VIDA`, '#a9ffbe');
    sound(740, .2, 'sine', .04); showToast(`Torrada da Gorda usada: +${Math.round(healed)} de vida.`); updateHud();
  }

  function update(dt) {
    elapsed += dt; coffeeTimer = Math.max(0, coffeeTimer - dt); player.ult = Math.max(0, player.ult - dt); player.invuln = Math.max(0, player.invuln - dt); player.shotFlash = Math.max(0, player.shotFlash - dt); if (ultimateVfx && (ultimateVfx.life -= dt) <= 0) ultimateVfx = null;
    if (controlSettings.autoUltimate && elapsed > 3 && enemies.length && player.ult <= 0) castUltimate();
    let ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joyX;
    let iy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + joyY;
    const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const moving = Math.hypot(ix, iy) > .09;
    if (moving) { player.facing = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 2 : 3) : (iy < 0 ? 1 : 0); player.walk += dt * 9; }
    player.vx = ix * player.speed; player.vy = iy * player.speed; player.x += player.vx * dt; player.y += player.vy * dt;
    if (player.character === 'jao' && player.jaoEvolutionPath === 'trail') {
      jaoTrailTimer -= dt;
      if (moving && jaoTrailTimer <= 0) { jaoTrail.push({ x: player.x, y: player.y, life: player.jaoTrailLife, max: player.jaoTrailLife, phase: rand(0, 6.28) }); jaoTrailTimer = .11; }
      for (let i = jaoTrail.length - 1; i >= 0; i--) { jaoTrail[i].life -= dt; if (jaoTrail[i].life <= 0) jaoTrail.splice(i, 1); }
      while (jaoTrail.length > 28) jaoTrail.shift();
    }
    spawnTimer -= dt; const spawnEvery = Math.max(.28, 1.2 - elapsed * .004); if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = spawnEvery; if (elapsed > 70 && Math.random() < .22) spawnEnemy(); }
    if (!bossSpawned && elapsed >= 45 && enemies.length < MAX_ENEMIES) { bossSpawned = true; spawnEnemy('boss'); showToast('O REI DO POSTE apareceu!'); sound(180, .5, 'sawtooth', .06); }
    fireTimer -= dt; if (fireTimer <= 0) { const target = nearestEnemy(); if (player.character === 'gui') fireCardVolley(target); else { const element = player.character === 'alice' && player.nailElement >= 0 ? aliceElements[player.nailElement] : null; const color = player.character === 'alice' ? (element?.color || '#e8e0e8') : '#54dcff'; fire(target, player.damage, player.shotSpeed, color, player.multishot, element, player.character === 'alice'); } fireTimer = player.fireRate / (coffeeTimer > 0 ? 1.2 : 1); }
    if (player.companion) { companionTimer -= dt; if (companionTimer <= 0) { for (const c of companions) { const origin = petWorldPosition(c); fire(nearestEnemy(origin), player.damage * player.companionDamage, player.shotSpeed * .86, '#b98cff', 1, null, false, origin); } companionTimer = player.companionRate; } for (const c of companions) c.angle += dt * 1.1; }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], dx = player.x - e.x, dy = player.y - e.y, len = Math.hypot(dx, dy) || 1;
      e.poisonTimer = Math.max(0, (e.poisonTimer || 0) - dt); e.slowTimer = Math.max(0, (e.slowTimer || 0) - dt); e.vulnerableTimer = Math.max(0, (e.vulnerableTimer || 0) - dt);
      if (player.character === 'jao' && player.jaoEvolutionPath === 'trail') {
        e.jaoTrailCooldown = Math.max(0, (e.jaoTrailCooldown || 0) - dt);
        let onTrail = false;
        for (const spark of jaoTrail) if (dist2(e, spark) < (e.radius + player.jaoTrailWidth) ** 2) { onTrail = true; break; }
        if (onTrail) {
          e.slowTimer = Math.max(e.slowTimer, player.jaoTrailSlow);
          if (e.jaoTrailCooldown <= 0) {
            e.hp -= player.damage * player.jaoTrailDamage; e.hit = .14; e.jaoTrailCooldown = player.jaoTrailTick;
            if (player.jaoTrailStun > 0) e.stun = Math.max(e.stun || 0, player.jaoTrailStun);
            emit(e.x, e.y, '#77eaff', 2, .35);
          }
        }
      }
      if (e.poisonTimer > 0) e.hp -= e.poisonDps * dt;
      if (e.hp <= 0) { defeat(e); enemies.splice(i, 1); continue; }
      e.stun = Math.max(0, (e.stun || 0) - dt);
      if (e.stun > 0) { e.hit = Math.max(e.hit, .08); continue; }
      if (e.kind === 'boss') {
        e.bossAttackCooldown -= dt;
        if (e.bossAttackWindup > 0) {
          e.bossAttackWindup = Math.max(0, e.bossAttackWindup - dt); e.hit = Math.max(e.hit, .04); e.wobble += dt * 2;
          if (e.bossAttackWindup <= 0) resolveBossAttack(e);
          continue;
        }
        if (e.bossAttackCooldown <= 0) { startBossAttack(e); continue; }
      }
      const moveSpeed = e.speed * (e.slowTimer > 0 ? .55 : 1); e.x += dx / len * moveSpeed * dt; e.y += dy / len * moveSpeed * dt; e.hit = Math.max(0, e.hit - dt); e.wobble += dt * 5;
      if (len < e.radius + 17) damagePlayer(e.damage);
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].hp <= 0) { defeat(enemies[i]); enemies.splice(i, 1); }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.card) { b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.pop(); }
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt; b.phase += dt * 14; b.life -= dt;
      let gone = b.life <= 0;
      for (let j = enemies.length - 1; j >= 0 && !gone; j--) {
        const e = enemies[j];
        if (e.hp <= 0 || b.hitEnemies.has(e) || dist2(b, e) >= (e.radius + b.r) ** 2) continue;
        b.hitEnemies.add(e);
        const critical = Math.random() < player.critChance, vulnerable = vulnerabilityMultiplier(e);
        const slowBonus = player.character === 'alice' && player.aliceEvolutionPath === 'slow' && e.slowTimer > 0 ? player.aliceSlowDamageBonus : 1;
        const closeRange = player.character === 'gui' && player.guiEvolutionPath === 'close' && b.card && !b.ultimate && dist2(player, e) <= player.guiCloseRange ** 2;
        const closeBonus = closeRange ? 1 + player.guiCloseDamageBonus : 1;
        const damage = b.damage * (critical ? 2 : 1) * vulnerable * slowBonus * closeBonus;
        e.hp -= damage; e.hit = .12;
        if (b.stun || (closeRange && player.guiCloseStun > 0)) { e.stun = Math.max(e.stun || 0, b.stun || player.guiCloseStun); floatText(e.x, e.y - e.radius - 5, 'ATORDOADO', '#ffd979'); }
        if (player.character === 'gui') ricochetGuiCard(b, e);
        applyNailEffect(e, b.element, damage); emit(b.x, b.y, b.color, 6, .62);
        floatText(e.x, e.y - e.radius, `${critical ? 'CRIT! ' : ''}${Math.round(damage)}`, critical ? '#ffe27c' : b.card ? '#ffe4a1' : '#bdf4ff');
        if (b.basic && player.character === 'jao' && !b.chainTriggered) { b.chainTriggered = true; chainShock(e, damage); }
        if (b.pierce > 0) b.pierce--; else gone = true;
        if (e.hp <= 0) { defeat(e); enemies.splice(j, 1); }
      }
      if (gone) bullets.splice(i, 1);
    }
    for (let i = xpOrbs.length - 1; i >= 0 && state === 'running'; i--) { const o = xpOrbs[i], d = Math.sqrt(dist2(o, player)); o.phase += dt * 5; if (d < player.pickup) { const k = 1 - d / player.pickup; o.x += (player.x - o.x) * Math.min(1, dt * (2.5 + k * 9)); o.y += (player.y - o.y) * Math.min(1, dt * (2.5 + k * 9)); } if (d < 23) { addXp(o.value * (doubleXpOrbs > 0 ? 2 : 1)); if (doubleXpOrbs > 0) doubleXpOrbs--; emit(o.x, o.y, '#65dbff', 3, .35); xpOrbs.splice(i, 1); } }
    if (!chest) { chestTimer -= dt; if (chestTimer <= 0) { spawnChest(); chestTimer = 80; } }
    if (chest) { chest.pulse += dt * 4; const d = Math.sqrt(dist2(player, chest)); const still = !moving && d < 46; if (still) { chestProgress += dt; ui.chest.classList.remove('hidden'); ui.chestLabel.textContent = chestProgress >= 3 ? 'BAÚ ABERTO!' : 'Fica parado para abrir'; ui.chestFill.style.width = `${Math.min(100, chestProgress / 3 * 100)}%`; if (chestProgress >= 3) openChest(); } else { chestProgress = 0; ui.chest.classList.add('hidden'); if (d < 85) { ui.chest.classList.remove('hidden'); ui.chestLabel.textContent = 'Chega perto e fica parado'; ui.chestFill.style.width = '0%'; } } }
    let nearbyItem = null, nearbyItemDistance = Infinity;
    for (let i = items.length - 1; i >= 0; i--) { const item = items[i], d = Math.sqrt(dist2(player, item)); item.pulse += dt * 4; item.age += dt; if (d < nearbyItemDistance) { nearbyItem = item; nearbyItemDistance = d; } if (d < 34) { if (item.kind === 'toast') { toastCount++; emit(item.x, item.y, '#ffe59a', 28, 1.35); sound(920, .22, 'triangle', .045); floatText(item.x, item.y - 25, 'Torrada +1', '#ffe69a'); showToast(`Torrada da Gorda guardada no inventário (${toastCount}).`); } else { applyChestItem(item); sound(680, .18, 'triangle', .035); } items.splice(i, 1); nearbyItem = null; nearbyItemDistance = Infinity; } }
    if (nearbyItem && nearbyItemDistance < 92) { const reward = chestDrops.find(drop => drop.kind === nearbyItem.kind); ui.pickup.classList.remove('hidden'); ui.pickupLabel.textContent = nearbyItemDistance < 34 ? `Pega: ${reward?.name || 'Item'}` : `${reward?.name || 'Item'} no chão`; } else ui.pickup.classList.add('hidden');
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = floating.length - 1; i >= 0; i--) { const f = floating[i]; f.y -= 23 * dt; f.life -= dt; if (f.life <= 0) floating.splice(i, 1); }
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) ui.toast.classList.add('hidden');
    updateHud();
  }
  function gameOver() {
    player.hp = 0; $('final-time').textContent = fmt(elapsed); $('final-kills').textContent = kills; $('final-level').textContent = player.level;
    $('final-xp').textContent = runStats.xp; $('final-chests').textContent = runStats.chests; $('final-ults').textContent = runStats.ultimates;
    $('final-title').textContent = runStats.bossDefeated ? 'O Rei do Poste caiu!' : 'A horda levou essa.';
    $('final-boss').textContent = runStats.bossDefeated ? 'Chefe derrotado: Rei do Poste.' : bossSpawned ? 'O Rei do Poste escapou desta vez.' : 'O Rei do Poste não chegou a aparecer.';
    $('final-evolutions').textContent = `Melhorias escolhidas: ${runStats.upgrades}. Evoluções: ${runStats.evolutions.length ? runStats.evolutions.join(' → ') : 'nenhuma nesta run'}.`;
    try { const best = Math.max(Number(localStorage.getItem('junqBulletBest') || 0), Math.floor(elapsed)); localStorage.setItem('junqBulletBest', String(best)); } catch (_) {}
    setMode('gameover');
  }
  function updateHud() {
    ui.health.style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`; ui.healthText.textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
    ui.xp.style.width = `${player.xp / player.nextXp * 100}%`; ui.level.textContent = player.level; ui.timer.textContent = fmt(elapsed); ui.kills.textContent = kills;
    ui.ult.disabled = player.ult > 0; ui.ult.style.setProperty('--cooldown', player.ult > 0 ? .68 : 0); ui.ultFill.style.opacity = player.ult > 0 ? '.7' : '0'; ui.ultFill.style.clipPath = `inset(${100 - (1 - player.ult / player.ultMax) * 100}% 0 0 0)`;
    ui.desktopUltFill.style.width = `${clamp((1 - player.ult / player.ultMax) * 100, 0, 100)}%`; ui.desktopUltStatus.textContent = player.ult > 0 ? `${Math.ceil(player.ult)}S` : 'PRONTA'; ui.desktopUlt.classList.toggle('is-charging', player.ult > 0);
    const element = player.nailElement >= 0 ? aliceElements[player.nailElement] : null;
    const isGui = player.character === 'gui';
    const ultIcon = isGui ? '🃏' : player.character === 'alice' ? '💅' : '⚡';
    ui.ultIcon.textContent = ultIcon; ui.desktopUltIcon.textContent = ultIcon;
    ui.ultLabel.textContent = isGui ? 'TRUNFO' : player.character === 'alice' ? (element?.short || 'NAT') : 'ULT';
    ui.ult.setAttribute('aria-label', isGui ? 'Mão de Trunfo: leque de cartas que perfura e atordoa' : player.character === 'alice' ? `Trocar esmalte${element ? `; atual: ${element.name}` : ''}` : 'Ultimate de choque');
    const ultColor = element?.color || (isGui ? '#ffd16b' : '#dfe8ef');
    ui.ult.style.setProperty('--element-color', ultColor); ui.ult.classList.toggle('alice-ultimate', player.character === 'alice'); ui.ult.classList.toggle('gui-ultimate', isGui); ui.desktopUlt.classList.toggle('gui-ultimate', isGui);
    ui.toastCount.textContent = toastCount; ui.toastUse.classList.toggle('hidden', toastCount <= 0 || state !== 'running'); ui.toastUse.disabled = player.hp >= player.maxHp;
  }

  function drawFloor() {
    ctx.fillStyle = '#17211f'; ctx.fillRect(0, 0, w, h);
    const size = floorSize, ox = ((-player.x % size) + size) % size, oy = ((-player.y % size) + size) % size;
    ctx.save(); ctx.translate(ox, oy); ctx.fillStyle = floorPattern; ctx.fillRect(-ox, -oy, w + size, h + size); ctx.restore();
  }
  function screenPos(o) { return { x: o.x - player.x + w / 2, y: o.y - player.y + h / 2 }; }
  function drawJaoTrail() {
    if (!jaoTrail.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const spark of jaoTrail) {
      const p = screenPos(spark), fade = clamp(spark.life / spark.max, 0, 1), pulse = .8 + Math.sin(elapsed * 13 + spark.phase) * .2;
      ctx.globalAlpha = fade * .18; ctx.fillStyle = '#56dfff'; ctx.beginPath(); ctx.arc(p.x, p.y, player.jaoTrailWidth * 2.4 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fade * .8; ctx.strokeStyle = '#a9f5ff'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(p.x - 5, p.y - 5); ctx.lineTo(p.x + 1, p.y); ctx.lineTo(p.x - 2, p.y + 2); ctx.lineTo(p.x + 5, p.y + 7); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawChest() { if (!chest) return; const p = screenPos(chest); ctx.save(); ctx.translate(p.x,p.y+Math.sin(chest.pulse)*3); ctx.fillStyle='rgba(255,200,93,.16)';ctx.fillRect(-20,-18,40,40);ctx.fillStyle='#b96d26';ctx.fillRect(-15,-10,30,22);ctx.fillStyle='#edb84e';ctx.fillRect(-16,-14,32,9);ctx.fillStyle='#78421d';ctx.fillRect(-3,-7,6,17);ctx.fillStyle='#fff0a0';ctx.fillRect(-2,-7,4,5);ctx.restore(); }
  function drawItem(item) {
    const p = screenPos(item), bob = Math.sin(item.pulse) * 3, reward = chestDrops.find(drop => drop.kind === item.kind) || chestDrops[0];
    ctx.save(); ctx.translate(p.x, p.y - 6 - bob);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = reward.color; ctx.globalAlpha = .16 + Math.sin(item.pulse * 1.6) * .05;
    ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(item.pulse) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (item.kind === 'toast') {
      if (toastSprite.complete && toastSprite.naturalWidth) ctx.drawImage(toastSprite, -18, -18, 36, 36);
      else { ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🍞', 0, 0); }
    } else {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#17202b'; ctx.lineWidth = 5; ctx.fillStyle = reward.color;
      if (item.kind === 'battery') {
        ctx.beginPath(); ctx.roundRect(-10, -14, 20, 28, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#17202b'; ctx.fillRect(-4, -18, 8, 4);
        ctx.fillStyle = '#f4ffff'; ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(-5, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 10); ctx.lineTo(6, -3); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill();
      } else if (item.kind === 'coffee') {
        ctx.beginPath(); ctx.roundRect(-12, -10, 20, 22, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(9, -1, 6, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.strokeStyle = '#fff4dd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, -14); ctx.quadraticCurveTo(-11, -19, -7, -22); ctx.moveTo(1, -14); ctx.quadraticCurveTo(-3, -19, 1, -22); ctx.stroke();
      } else if (item.kind === 'shield') {
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(13, -10); ctx.lineTo(11, 4); ctx.quadraticCurveTo(8, 12, 0, 17); ctx.quadraticCurveTo(-8, 12, -11, 4); ctx.lineTo(-13, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f1fbff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.stroke();
      } else {
        ctx.fillStyle = reward.color; ctx.strokeStyle = '#17202b'; ctx.lineWidth = 4; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 15; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawUltimate() {
    if (!ultimateVfx) return;
    const v = ultimateVfx, p = screenPos(v), progress = 1 - v.life / v.max, fade = clamp(v.life / .38, 0, 1), radius = v.radius * Math.min(1, progress * 1.65);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const effectColor = v.color || '#42dfff';
    if (v.type === 'chain') {
      ctx.globalAlpha = fade * .95;
      let from = p;
      for (const target of v.targets) {
        const q = screenPos(target), dx = q.x - from.x, dy = q.y - from.y, len = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, progress * 5), endX = from.x + dx * reach, endY = from.y + dy * reach;
        ctx.strokeStyle = '#bdf8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(from.x, from.y);
        for (let s = 1; s < 4; s++) {
          const t = s / 4, offset = Math.sin(target.phase + s * 8 + progress * 45) * Math.min(8, len * .09);
          ctx.lineTo(from.x + dx * t - dy / len * offset, from.y + dy * t + dx / len * offset);
        }
        ctx.lineTo(endX, endY); ctx.stroke();
        ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.arc(endX, endY, 2.5 + Math.sin(progress * 28 + target.phase), 0, Math.PI * 2); ctx.fill();
        from = q;
      }
      ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return;
    }
    if (v.type === 'cardFan') {
      ctx.translate(p.x, p.y); ctx.rotate(v.angle); ctx.globalAlpha = fade * .2;
      ctx.fillStyle = '#ffc95f'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, Math.max(8, v.radius * progress), -v.spread / 2, v.spread / 2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = fade * .8; ctx.strokeStyle = '#ffe5a0'; ctx.lineWidth = 2;
      for (let i = 0; i <= 6; i++) { const a = (i / 6 - .5) * v.spread; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * v.radius * progress, Math.sin(a) * v.radius * progress); ctx.stroke(); }
      ctx.globalAlpha = fade * .95; ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, Math.max(5, v.radius * progress), -v.spread / 2, v.spread / 2); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return;
    }
    for (let ring = 0; ring < 2; ring++) {
      const r = Math.max(2, radius - ring * 22), alpha = fade * (1 - ring * .25) * (.38 + Math.sin(progress * 16 + ring) * .1);
      ctx.globalAlpha = alpha; ctx.strokeStyle = ring ? '#e5fbff' : effectColor; ctx.lineWidth = ring ? 2 : 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, progress * 2.8 + ring * .7, progress * 2.8 + ring * .7 + Math.PI * 1.86); ctx.stroke();
    }
    ctx.globalAlpha = fade * .85;
    for (const target of v.targets) {
      const q = screenPos(target), dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1, reach = Math.min(1, progress * 2.8);
      const endX = p.x + dx * reach, endY = p.y + dy * reach, segments = 5, seed = Math.sin(target.phase + progress * 41) * 5;
      ctx.strokeStyle = effectColor === '#42dfff' ? '#a7f6ff' : effectColor; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(p.x, p.y);
      for (let s = 1; s < segments; s++) { const t = s / segments, offset = Math.sin(target.phase + s * 9.2 + progress * 36) * Math.min(13, len * .055); ctx.lineTo(p.x + dx * t - dy / len * (offset + seed), p.y + dy * t + dx / len * (offset + seed)); }
      ctx.lineTo(endX, endY); ctx.stroke();
      ctx.fillStyle = '#e7ffff'; ctx.beginPath(); ctx.arc(endX, endY, 3.2 + Math.sin(progress * 30 + target.phase) * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = fade * (1 - progress * .35); ctx.fillStyle = effectColor === '#42dfff' ? '#dffcff' : effectColor; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + progress * 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawBullet(b) {
    const p = screenPos(b); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (b.card) {
      const angle = Math.atan2(b.vy, b.vx); ctx.translate(p.x, p.y); ctx.rotate(angle + Math.sin(b.phase) * .14);
      const cardW = b.ultimate ? 12 : 9, cardH = b.ultimate ? 18 : 13;
      ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = b.ultimate ? 1.5 : 1.1; ctx.strokeStyle = b.ultimate ? '#70451c' : '#29232a'; ctx.fillStyle = '#fff0d0';
      ctx.beginPath(); ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 1.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(2.2, 0); ctx.lineTo(0, 3); ctx.lineTo(-2.2, 0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .85; ctx.fillRect(-cardW / 2 + 1.2, -cardH / 2 + 1.2, 1.2, 1.2);
      ctx.restore(); return;
    }
    if (b.scratch) {
      const angle = Math.atan2(b.vy, b.vx); ctx.translate(p.x, p.y); ctx.rotate(angle); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const slash = (y, alpha, scale = 1) => {
        ctx.save(); ctx.globalAlpha = alpha; ctx.scale(scale, scale);
        ctx.beginPath(); ctx.moveTo(-12, y + 2); ctx.quadraticCurveTo(-2, y - 1, 10, y - 7); ctx.lineTo(13, y - 9); ctx.quadraticCurveTo(5, y - 1, -10, y + 5); ctx.closePath();
        ctx.fillStyle = b.color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#551239'; ctx.stroke(); ctx.restore();
      };
      for (let i = 0; i < b.trail.length; i += 2) {
        const t = b.trail[i], dx = t.x - b.x, dy = t.y - b.y, tx = dx * Math.cos(angle) + dy * Math.sin(angle), ty = -dx * Math.sin(angle) + dy * Math.cos(angle);
        ctx.save(); ctx.translate(tx, ty); for (let claw = -1; claw <= 1; claw++) slash(claw * 4, .1 * (1 - i / b.trail.length), .62); ctx.restore();
      }
      for (let claw = -1; claw <= 1; claw++) slash(claw * 4, .92);
      ctx.globalAlpha = .9; ctx.strokeStyle = '#fff1f8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, -2, 7, -5); ctx.stroke();
      ctx.restore(); return;
    }
    for (let i = b.trail.length - 1; i >= 0; i--) { const q = screenPos(b.trail[i]), fade = (1 - i / b.trail.length) * .42; ctx.globalAlpha = fade; ctx.fillStyle = i < 2 ? '#e3fcff' : b.color; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, b.r * (1 - i / (b.trail.length + 1)) * .72), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = .22; ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.fillStyle = b.color; ctx.beginPath(); ctx.ellipse(0, 0, b.r * 2.2, b.r * 1.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.75, b.r * .9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2ffff'; ctx.beginPath(); ctx.ellipse(1, 0, b.r * .82, b.r * .48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(Math.sin(b.phase) * .35); ctx.strokeStyle = '#aaf5ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = .8; ctx.beginPath(); ctx.moveTo(-b.r * 2.5, 0); ctx.lineTo(-b.r * 1.8, -3); ctx.lineTo(-b.r * 1.2, 2); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawEnemy(e) {
    const p = screenPos(e), bob = Math.sin(e.wobble) * (e.kind === 'boss' ? 1.5 : 2), r = e.radius, sprite = enemySprites[e.kind];
    const size = e.kind === 'boss' ? 132 : e.kind === 'wolf' || e.kind === 'roach' ? 76 : 48;
    const scale = sprite?.naturalWidth ? size / Math.max(sprite.naturalWidth, sprite.naturalHeight) : 1;
    const drawWidth = sprite?.naturalWidth ? sprite.naturalWidth * scale : size, drawHeight = sprite?.naturalHeight ? sprite.naturalHeight * scale : size;
    ctx.save(); ctx.translate(p.x, p.y + bob);
    if (sprite?.complete && sprite.naturalWidth) {
      ctx.globalAlpha = e.hit ? .72 : 1;
      ctx.drawImage(sprite, -drawWidth / 2, -drawHeight * .58, drawWidth, drawHeight);
      ctx.globalAlpha = 1;
      if (e.stun > 0) { ctx.strokeStyle = '#83efff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 1, r + 4, r * .72, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      const statusColor = e.poisonTimer > 0 ? '#78ed6f' : e.slowTimer > 0 ? '#66caff' : e.vulnerableTimer > 0 ? '#ff79c8' : e.color;
      ctx.fillStyle = e.stun > 0 ? '#83efff' : e.hit ? '#fff' : statusColor;
      if (e.kind === 'bat') { ctx.beginPath(); ctx.moveTo(-r, -2); ctx.lineTo(-r * 1.6, -r * .8); ctx.lineTo(-r * 1.35, r * .5); ctx.lineTo(0, r * .25); ctx.lineTo(r * 1.35, r * .5); ctx.lineTo(r * 1.6, -r * .8); ctx.lineTo(r, -2); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r * .88, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-r * .72, -r * .52, r * 1.44, r * 1.18); }
      ctx.fillStyle = '#17202a'; ctx.fillRect(-r * .45, -r * .14, 3, 4); ctx.fillRect(r * .18, -r * .14, 3, 4); ctx.fillStyle = '#fff'; ctx.fillRect(-r * .38, -r * .12, 1, 1);
    }
    ctx.restore();
    if (e.kind === 'boss' && e.bossAttackWindup > 0) {
      const blink = .42 + Math.sin(elapsed * 18) * .2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = blink;
      ctx.strokeStyle = '#ff506e'; ctx.fillStyle = '#ff506e';
      if (e.bossAttackType === 'slam') {
        ctx.globalAlpha *= .22; ctx.beginPath(); ctx.arc(p.x, p.y, e.bossAttackRadius, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = blink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, e.bossAttackRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, e.bossAttackRadius * (.45 + .45 * (1 - e.bossAttackWindup / 1.05)), 0, Math.PI * 2); ctx.stroke();
      } else {
        const end = screenPos({ x: e.bossAimX, y: e.bossAimY });
        ctx.globalAlpha *= .22; ctx.lineWidth = 72; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.globalAlpha = blink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.strokeStyle = '#fff1d8'; ctx.globalAlpha *= .62; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (e.hp < e.max) { const barWidth = e.kind === 'boss' ? r * 2.6 : r * 2, barY = p.y - drawHeight * .58 - 7; ctx.fillStyle = '#0d1014'; ctx.fillRect(p.x - barWidth / 2, barY, barWidth, 3); ctx.fillStyle = e.kind === 'boss' ? '#4bdfff' : '#ff6979'; ctx.fillRect(p.x - barWidth / 2, barY, barWidth * clamp(e.hp / e.max, 0, 1), 3); }
  }
  function drawPet(c, x, y, target, world) {
    const facing = target ? cardinalFacing(target.x - world.x, target.y - world.y) : 0;
    const ink = '#292431', shine = '#fff5df';
    const palette = {
      quokka: { body: '#bd7448', shade: '#874932', light: '#edb77a', accent: '#eab64f' },
      capybara: { body: '#a8744b', shade: '#704832', light: '#d9ae7a', accent: '#6eaa69' },
      firefly: { body: '#ddac36', shade: '#96612b', light: '#fff0a0', accent: '#a8dadd' },
      polish: { body: '#d95f9f', shade: '#783d67', light: '#ffaed4', accent: '#f8d9e7' },
      robot: { body: '#76b9c0', shade: '#3b6877', light: '#d4e8d9', accent: '#f1c454' },
      raccoon: { body: '#85808a', shade: '#4a4655', light: '#e0d7c6', accent: '#c89a59' }
    };
    const p = palette[c.type] || palette.robot;
    const limb = (x1, y1, x2, y2, color = p.shade, width = 4) => { ctx.strokeStyle = ink; ctx.lineWidth = width + 1.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };
    const eye = (x, y, r = 1.65) => { ctx.fillStyle = '#fff1cf'; ctx.beginPath(); ctx.ellipse(x, y, r + .6, r + .9, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y + .35, r * .65, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - .25, y - .5, .7, .7); };
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#07101077'; ctx.beginPath(); ctx.ellipse(0, 10, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .14; ctx.fillStyle = c.type === 'firefly' ? '#ffe775' : p.body; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.rotate(facing); ctx.scale(1.25, 1.25); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = ink;
    if (c.type === 'quokka') {
      limb(-5, 7, -6, 12); limb(5, 7, 6, 12);
      ctx.fillStyle = p.shade; ctx.beginPath(); ctx.arc(-6.5, -4, 4.7, 0, Math.PI * 2); ctx.arc(6.5, -4, 4.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.body; ctx.beginPath(); ctx.ellipse(0, 1, 10.5, 12.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.light; ctx.beginPath(); ctx.ellipse(-4.5, 1, 2, 3.1, -.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4d7ab'; ctx.beginPath(); ctx.ellipse(0, 6.6, 6.2, 4.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      eye(-3.2, 1.3, 1.25); eye(3.2, 1.3, 1.25); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 5.1, 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#633c32'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1.5, 8.2); ctx.quadraticCurveTo(0, 9.5, 1.5, 8.2); ctx.stroke();
      limb(-8, 0, -11, 3, p.body, 2.4); ctx.fillStyle = p.accent; ctx.beginPath(); ctx.roundRect(-10, 4, 6, 5, 1.2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff0ae'; ctx.fillRect(-8.5, 5, 2, 1);
    } else if (c.type === 'capybara') {
      limb(-6, 7, -7, 12); limb(6, 7, 7, 12);
      ctx.fillStyle = p.body; ctx.beginPath(); ctx.ellipse(0, 2, 11.2, 11.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.light; ctx.beginPath(); ctx.ellipse(-6, -5.2, 2.3, 2.8, -.25, 0, Math.PI * 2); ctx.ellipse(6, -5.2, 2.3, 2.8, .25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.body; ctx.beginPath(); ctx.ellipse(0, 1.4, 8.8, 8.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.light; ctx.beginPath(); ctx.ellipse(0, 6.5, 6.2, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      eye(-3.4, -.4, 1.1); eye(3.4, -.4, 1.1); ctx.fillStyle = '#40302b'; ctx.beginPath(); ctx.ellipse(0, 5, 1.5, 1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.shade; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4.5, 8); ctx.lineTo(4.5, 8); ctx.stroke();
      ctx.fillStyle = '#598d5a'; ctx.beginPath(); ctx.ellipse(-8, 1, 3, 2, -.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d89f56'; ctx.beginPath(); ctx.arc(0, -8, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (c.type === 'firefly') {
      ctx.fillStyle = '#d8eeee'; ctx.beginPath(); ctx.ellipse(-8.5, -4.5, 6.5, 3.6, -.42, 0, Math.PI * 2); ctx.ellipse(8.5, -4.5, 6.5, 3.6, .42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#a4c9cd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-12, -5); ctx.moveTo(3, -4); ctx.lineTo(12, -5); ctx.stroke();
      ctx.fillStyle = p.shade; ctx.beginPath(); ctx.ellipse(0, 2, 7.2, 10.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.body; ctx.beginPath(); ctx.ellipse(0, 1, 6, 9.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4cf5a'; ctx.beginPath(); ctx.ellipse(0, 8, 5.5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.light; ctx.beginPath(); ctx.ellipse(0, 8, 3.2, 2.3, 0, 0, Math.PI * 2); ctx.fill();
      eye(-2.4, -2, 1.15); eye(2.4, -2, 1.15);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -7); ctx.quadraticCurveTo(-7, -13, -8, -9); ctx.moveTo(2, -7); ctx.quadraticCurveTo(7, -13, 8, -9); ctx.stroke();
    } else if (c.type === 'polish') {
      limb(-6, 7, -7, 11, p.shade, 2.2); limb(6, 7, 7, 11, p.shade, 2.2);
      ctx.fillStyle = '#603554'; ctx.beginPath(); ctx.roundRect(-6, -13, 12, 7, 1.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a94782'; ctx.fillRect(-4.5, -12, 2, 4); ctx.fillRect(-1, -12, 2, 4); ctx.fillRect(2.5, -12, 2, 4);
      ctx.fillStyle = p.shade; ctx.beginPath(); ctx.roundRect(-10, -7, 20, 19, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.body; ctx.beginPath(); ctx.roundRect(-8.5, -6, 17, 16, 3.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.light; ctx.beginPath(); ctx.roundRect(-6, -4, 4, 11, 2); ctx.fill();
      ctx.fillStyle = p.accent; ctx.beginPath(); ctx.roundRect(-5, 2.5, 10, 4, 1.5); ctx.fill();
      eye(-3, -1, 1.25); eye(3, -1, 1.25);
      ctx.strokeStyle = '#6f315d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, 3); ctx.quadraticCurveTo(0, 4.3, 2, 3); ctx.stroke();
      limb(9, 0, 13, -5, '#d6b7aa', 1.8); ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(13.5, -6, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (c.type === 'robot') {
      ctx.strokeStyle = p.shade; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -14); ctx.stroke(); ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(0, -14.5, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      limb(-8, 0, -12, 3, p.shade, 2.4); limb(8, 0, 12, 3, p.shade, 2.4); limb(-4, 8, -5, 12, p.shade, 2.4); limb(4, 8, 5, 12, p.shade, 2.4);
      ctx.fillStyle = p.shade; ctx.beginPath(); ctx.roundRect(-10, -9, 20, 20, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.light; ctx.beginPath(); ctx.roundRect(-8, -10, 16, 18, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.body; ctx.beginPath(); ctx.roundRect(-7, -5, 14, 8, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#143341'; ctx.beginPath(); ctx.roundRect(-5, -3.5, 10, 5, 2); ctx.fill();
      ctx.fillStyle = '#9ff5fa'; ctx.beginPath(); ctx.arc(0, -1, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-.7, -2, 1, 1);
      ctx.fillStyle = p.accent; ctx.fillRect(-5, 5, 10, 2); ctx.fillStyle = '#eff1d1'; ctx.fillRect(-3.5, 5, 2, 1);
    } else if (c.type === 'raccoon') {
      ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 5); ctx.quadraticCurveTo(10, 5, 10, 12); ctx.stroke();
      ctx.strokeStyle = '#c8c0c4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, 7); ctx.lineTo(10, 8); ctx.moveTo(10, 11); ctx.lineTo(13, 12); ctx.stroke();
      ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.roundRect(-9, 9, 18, 4, 1.4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9985d'; ctx.fillRect(-7, 10, 14, 1.3); ctx.fillStyle = '#39323a'; ctx.beginPath(); ctx.arc(-6, 14, 1.5, 0, Math.PI * 2); ctx.arc(6, 14, 1.5, 0, Math.PI * 2); ctx.fill();
      limb(-5, 7, -6, 11, p.shade, 2); limb(5, 7, 6, 11, p.shade, 2);
      ctx.fillStyle = p.shade; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-9, -11); ctx.lineTo(-3, -7); ctx.lineTo(3, -7); ctx.lineTo(9, -11); ctx.lineTo(8, -3); ctx.ellipse(0, 1, 9.5, 10, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.body; ctx.beginPath(); ctx.ellipse(0, 2, 8, 9.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#393743'; ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(0, -6, 8, -2); ctx.lineTo(6, 2); ctx.quadraticCurveTo(0, -1, -6, 2); ctx.closePath(); ctx.fill();
      eye(-3, -2, 1.3); eye(3, -2, 1.3);
      ctx.fillStyle = '#b9a98f'; ctx.beginPath(); ctx.ellipse(0, 3.5, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function drawPlayer() { const pos=screenPos(player), sx=pos.x, sy=pos.y; ctx.fillStyle='#07101077';ctx.beginPath();ctx.ellipse(sx,sy+16,19,9,0,0,Math.PI*2);ctx.fill();
    if (player.shotFlash > 0) { ctx.save(); ctx.globalAlpha = player.shotFlash * 2; ctx.strokeStyle = player.character === 'alice' ? (player.nailElement >= 0 ? aliceElements[player.nailElement].color : '#e8e0e8') : '#65e7ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 21 + player.shotFlash * 10, 13 + player.shotFlash * 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    const stage = player.character === 'jao' ? player.jaoEvolution : player.character === 'alice' ? player.aliceEvolution : player.guiEvolution;
    const evolvedAtlas = player.character === 'alice'
      ? evolutionAtlases.alice[player.aliceEvolutionPath]?.[stage]
      : evolutionAtlases[player.character]?.[stage];
    if (evolvedAtlas?.complete && evolvedAtlas.naturalWidth) {
      const cell=evolvedAtlas.naturalWidth/4,rowH=evolvedAtlas.naturalHeight/4,col=Math.floor(player.walk)%4,size=68,footY=sy+32;
      ctx.drawImage(evolvedAtlas,col*cell,player.facing*rowH,cell,rowH,sx-size/2,footY-size,size,size);
    }
    else if(player.character === 'gui' && guiAtlas.complete && guiAtlas.naturalWidth){const cell=guiAtlas.naturalWidth/4,rowH=guiAtlas.naturalHeight/4,col=Math.floor(player.walk)%4,size=68,footY=sy+32;ctx.drawImage(guiAtlas,col*cell,player.facing*rowH,cell,rowH,sx-size/2,footY-size,size,size);}
    else if(player.character === 'alice' && aliceAtlas.complete && aliceAtlas.naturalWidth){const cell=aliceAtlas.naturalWidth/4,rowH=aliceAtlas.naturalHeight/4,col=Math.floor(player.walk)%4,size=68,footY=sy+32;ctx.drawImage(aliceAtlas,col*cell,player.facing*rowH,cell,rowH,sx-size/2,footY-size,size,size);}
    else if(player.character === 'jao' && atlas.complete && atlas.naturalWidth){const cell=atlas.naturalWidth/4,rowH=atlas.naturalHeight/4,col=Math.floor(player.walk)%4,frame=atlasFrames[player.facing][col],scale=68/cell,drawW=frame[2]*scale,drawH=frame[3]*scale,footY=sy+32;ctx.drawImage(atlas,col*cell+frame[0],player.facing*rowH+frame[1],frame[2],frame[3],sx-drawW/2,footY-drawH,drawW,drawH);}
    else {ctx.fillStyle='#191c25';ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dd365f';ctx.fillRect(sx-10,sy-12,20,22);ctx.fillStyle='#f2dec0';ctx.fillRect(sx-10,sy-8,5,15);ctx.fillRect(sx+5,sy-8,5,15);ctx.fillStyle='#111';ctx.fillRect(sx-7,sy-17,14,8);ctx.fillStyle='#48cfff';ctx.fillRect(sx+5,sy-17,3,3);}
    if(player.invuln>0 && Math.floor(elapsed*18)%2===0){ctx.strokeStyle='#ff8391';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy,22,0,Math.PI*2);ctx.stroke();}
    const target = nearestEnemy(); for (const c of companions) { const world = petWorldPosition(c), p = screenPos(world); drawPet(c, p.x, p.y, target, world); }
  }
  function drawObjectiveArrow(target, color, headOffset) {
    const p = screenPos(target), margin = 31, outside = p.x < margin || p.x > w - margin || p.y < margin || p.y > h - margin;
    const veryFar = Math.sqrt(dist2(player, target)) > Math.min(w, h) * .78;
    let x, y, angle;
    if (outside) {
      const dx = p.x - w / 2, dy = p.y - h / 2, sx = (w / 2 - margin) / Math.max(.001, Math.abs(dx)), sy = (h / 2 - margin) / Math.max(.001, Math.abs(dy)), scale = Math.min(sx, sy);
      x = w / 2 + dx * scale; y = h / 2 + dy * scale; angle = Math.atan2(dy, dx);
    } else { x = p.x; y = p.y - headOffset; angle = Math.PI / 2; }
    const pulse = .78 + Math.sin(elapsed * 3.1) * .12;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = pulse;
    if (outside && veryFar) {
      const channels = color.match(/[\da-f]{2}/gi)?.map(v => parseInt(v, 16)) || [255, 210, 100];
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
      glow.addColorStop(0, `rgba(${channels[0]},${channels[1]},${channels[2]},.54)`); glow.addColorStop(.38, `rgba(${channels[0]},${channels[1]},${channels[2]},.24)`); glow.addColorStop(1, `rgba(${channels[0]},${channels[1]},${channels[2]},0)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10161bdc'; ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.roundRect(-13, -14, 26, 28, 9); ctx.fill(); ctx.stroke();
      ctx.rotate(angle); ctx.fillStyle = color; ctx.strokeStyle = '#fff5d6'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-3, -7); ctx.lineTo(0, -1.6); ctx.lineTo(-7, 0); ctx.lineTo(0, 1.6); ctx.lineTo(-3, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (outside) {
      ctx.fillStyle = '#10161bf0'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.rotate(angle); ctx.fillStyle = color; ctx.strokeStyle = '#fff5d6'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-3, -7); ctx.lineTo(0, -1.5); ctx.lineTo(-7, 0); ctx.lineTo(0, 1.5); ctx.lineTo(-3, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.translate(0, -7); ctx.fillStyle = '#11171ddd'; ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(-11, -13, 22, 23, 8); ctx.fill(); ctx.stroke();
      ctx.rotate(angle); ctx.fillStyle = color; ctx.strokeStyle = '#fff5d6'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-2, -5.5); ctx.lineTo(0, -1.2); ctx.lineTo(-5, 0); ctx.lineTo(0, 1.2); ctx.lineTo(-2, 5.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function drawObjectiveArrows() {
    if (chest) drawObjectiveArrow(chest, '#f2c66c', 28);
    const boss = enemies.find(e => e.kind === 'boss');
    if (boss) drawObjectiveArrow(boss, '#65ddeb', boss.radius * 2 + 12);
  }
  function render() {
    ctx.setTransform(dpr,0,0,dpr,0,0); drawFloor(); drawJaoTrail();
    for(const o of xpOrbs){const p=screenPos(o);ctx.fillStyle='#74e4ff';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillRect(-5,-5,10,10);ctx.restore();}
    drawChest(); for(const item of items) drawItem(item); for(const b of bullets) drawBullet(b);
    for(const e of enemies)drawEnemy(e); drawUltimate(); for(const p of particles){const q=screenPos(p);ctx.globalAlpha=clamp(p.life/(p.max||.55),0,1);ctx.fillStyle=p.color;ctx.fillRect(q.x,q.y,p.size,p.size);}ctx.globalAlpha=1;
    drawPlayer(); for(const f of floating){const p=screenPos(f);ctx.globalAlpha=clamp(f.life/.8,0,1);ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle=f.color;ctx.fillText(f.text,p.x,p.y);}ctx.globalAlpha=1; drawObjectiveArrows();
  }
  function loop(t) {
    requestAnimationFrame(loop);
    if (state !== 'running' && !needsRender) return;
    if (t - last < frameInterval - 1) return;
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    if (state === 'running') update(dt);
    render(); needsRender = false;
  }
  requestAnimationFrame(loop);
})();
