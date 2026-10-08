(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const floorTexture = document.createElement('canvas');
  floorTexture.width = floorTexture.height = 256;
  const floorTextureCtx = floorTexture.getContext('2d');
  floorTextureCtx.fillStyle = '#17211f'; floorTextureCtx.fillRect(0, 0, 256, 256);
  for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 4; gy++) {
    const seed = Math.abs((gx * 73856093) ^ (gy * 19349663)) % 12, x = gx * 64, y = gy * 64;
    floorTextureCtx.fillStyle = seed < 3 ? '#192522' : '#17211f'; floorTextureCtx.fillRect(x, y, 63, 63);
    if (seed === 5) { floorTextureCtx.fillStyle = '#25312a'; floorTextureCtx.fillRect(x + 12, y + 18, 2, 2); floorTextureCtx.fillRect(x + 42, y + 39, 2, 2); }
  }
  const floorPattern = ctx.createPattern(floorTexture, 'repeat');
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'), screen: $('screen'), menu: $('menu'), characterSelect: $('character-select'), upgrade: $('upgrade-panel'), pause: $('pause-panel'), over: $('gameover-panel'),
    health: $('health-fill'), healthText: $('health-text'), xp: $('xp-fill'), level: $('level'), timer: $('timer'), kills: $('kills'),
    options: $('upgrade-options'), toast: $('toast'), chest: $('chest-status'), chestLabel: $('chest-label'), chestFill: $('chest-fill'),
    pickup: $('pickup-status'), pickupLabel: $('pickup-label'),
    joystick: $('joystick'), stick: $('stick'), ult: $('ultimate-button'), ultIcon: $('ultimate-icon'), ultLabel: $('ultimate-label'), ultFill: $('ult-fill'), toastUse: $('toast-use'), toastCount: $('toast-count')
  };
  let w = innerWidth, h = innerHeight, dpr = 1, state = 'menu', last = 0, toastTimer = 0, needsRender = true;
  let elapsed = 0, kills = 0, spawnTimer = 0, fireTimer = 0, companionTimer = 0, chestTimer = 25, chest = null, chestProgress = 0, ultimateVfx = null, selectedCharacter = 'jao', bossSpawned = false;
  let toastCount = 0;
  const MAX_ENEMIES = 50, MAX_PARTICLES = 160, MAX_XP_ORBS = 100;
  const keys = new Set(), enemies = [], bullets = [], xpOrbs = [], particles = [], floating = [], companions = [], items = [];
  const player = { character: 'jao', x: 0, y: 0, vx: 0, vy: 0, speed: 205, hp: 100, maxHp: 100, damage: 20, fireRate: .62, shotSpeed: 440, multishot: 1, pierce: 0, critChance: .05, xpGain: 1, level: 1, xp: 0, nextXp: 6, invuln: 0, facing: 0, walk: 0, ult: 0, ultMax: 18, ultRadius: 600, ultDamage: 1, nailPower: 1, nailElement: -1, pickup: 110, companion: 0, companionDamage: .55, companionRate: .82, kills: 0, shotFlash: 0, aimX: 1, aimY: 0 };
  const atlas = new Image();
  atlas.src = 'assets/jao-walk.png';
  const aliceAtlas = new Image();
  aliceAtlas.src = 'assets/alice-walk.png';
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
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.25); w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize); resize();
  const mobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const frameInterval = mobile ? 1000 / 30 : 1000 / 60;

  function showToast(text) { ui.toast.textContent = text; ui.toast.classList.remove('hidden'); toastTimer = 2.3; }
  function setMode(next) {
    state = next;
    needsRender = true;
    ui.screen.classList.toggle('hidden', next === 'running');
    ui.menu.classList.toggle('hidden', next !== 'menu'); ui.characterSelect.classList.toggle('hidden', next !== 'select'); ui.upgrade.classList.toggle('hidden', next !== 'upgrade');
    ui.pause.classList.toggle('hidden', next !== 'paused'); ui.over.classList.toggle('hidden', next !== 'gameover');
    ui.hud.classList.toggle('hidden', next === 'menu' || next === 'select');
    ui.joystick.classList.toggle('hidden', !mobile || next !== 'running'); ui.ult.classList.toggle('hidden', !mobile || next !== 'running');
    ui.toastUse.classList.toggle('hidden', next !== 'running' || toastCount <= 0);
  }
  function selectCharacter(character) {
    selectedCharacter = character;
    for (const id of ['jao', 'alice']) {
      const card = $(`character-${id}`), active = id === character;
      card.classList.toggle('selected', active); card.setAttribute('aria-pressed', String(active));
      card.querySelector('.character-selected-label').textContent = active ? 'SELECIONADO' : `ESCOLHER ${id.toUpperCase()}`;
    }
    $('play-button').textContent = `JOGAR COM ${character === 'alice' ? 'ALICE' : 'JÃO'}`;
  }
  setMode('menu');
  function reset() {
    elapsed = 0; kills = 0; spawnTimer = 0; fireTimer = .25; companionTimer = 0; chestTimer = 24; chest = null; chestProgress = 0; ultimateVfx = null; bossSpawned = false;
    toastCount = 0;
    enemies.length = bullets.length = xpOrbs.length = particles.length = floating.length = companions.length = items.length = 0;
    Object.assign(player, { character: selectedCharacter, x: 0, y: 0, vx: 0, vy: 0, speed: 205, hp: 100, maxHp: 100, damage: 20, fireRate: .62, shotSpeed: 440, multishot: 1, pierce: 0, critChance: .05, xpGain: 1, level: 1, xp: 0, nextXp: 6, invuln: 0, facing: 0, walk: 0, ult: 0, ultMax: 18, ultRadius: 600, ultDamage: 1, nailPower: 1, nailElement: -1, pickup: 110, companion: 0, companionDamage: .55, companionRate: .82, kills: 0, shotFlash: 0, aimX: 1, aimY: 0 });
    ui.chest.classList.add('hidden'); ui.pickup.classList.add('hidden'); setMode('running'); updateHud();
  }
  $('start-button').addEventListener('click', () => setMode('select'));
  $('back-to-menu').addEventListener('click', () => setMode('menu'));
  $('character-jao').addEventListener('click', () => selectCharacter('jao'));
  $('character-alice').addEventListener('click', () => selectCharacter('alice'));
  $('play-button').addEventListener('click', () => { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); reset(); });
  $('retry-button').addEventListener('click', reset);
  $('resume-button').addEventListener('click', () => setMode('running'));
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
    if (state === 'upgrade' && ['1','2','3'].includes(key)) chooseUpgrade(Number(key) - 1);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  ui.joystick.addEventListener('pointerdown', e => { if (state !== 'running') return; joystickPointer = e.pointerId; ui.joystick.setPointerCapture(e.pointerId); moveStick(e); });
  ui.joystick.addEventListener('pointermove', e => { if (e.pointerId === joystickPointer) moveStick(e); });
  function endStick(e) { if (e.pointerId !== joystickPointer) return; joystickPointer = null; joyX = joyY = 0; ui.stick.style.transform = ''; }
  ui.joystick.addEventListener('pointerup', endStick); ui.joystick.addEventListener('pointercancel', endStick);
  function moveStick(e) { const r = ui.joystick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), len = Math.hypot(dx, dy), scale = Math.min(1, len / 42); joyX = len ? dx / len * scale : 0; joyY = len ? dy / len * scale : 0; ui.stick.style.transform = `translate(${joyX * 32}px,${joyY * 32}px)`; }

  function sound(freq = 520, duration = .07, type = 'sine', volume = .035) {
    if (!audioCtx) return;
    try { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(volume, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration); } catch (_) {}
  }
  function emit(x, y, color, count = 7, force = 1) { for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) { const a = Math.random() * Math.PI * 2, s = rand(35, 150) * force; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.2, .55), max: .55, color, size: rand(2, 5) }); } }
  function floatText(x, y, text, color = '#fff') { floating.push({ x, y, text, color, life: .8 }); }
  function spawnEnemy(forcedKind = null) {
    if (enemies.length >= MAX_ENEMIES) return;
    const a = rand(0, Math.PI * 2), r = forcedKind === 'boss' ? Math.min(w, h) * .38 : Math.max(w, h) * .62 + rand(35, 100), t = elapsed;
    const roll = Math.random();
    let kind = forcedKind || 'blob';
    if (!forcedKind) { if (t > 14 && roll > .6) kind = 'bat'; if (t > 25 && roll > .79) kind = 'wolf'; if (t > 34 && roll > .91) kind = 'roach'; }
    const stats = kind === 'boss' ? { hp: 1500 + t * 7, speed: 24, radius: 38, damage: 32, color: '#39d9ff', xp: 30 } :
      kind === 'roach' ? { hp: 205 + t * 1.5, speed: 27, radius: 27, damage: 24, color: '#df7a33', xp: 7 } :
      kind === 'wolf' ? { hp: 145 + t * 1.25, speed: 50, radius: 23, damage: 19, color: '#cf7750', xp: 6 } :
      kind === 'bat' ? { hp: 34 + t * .22, speed: 88, radius: 12, damage: 10, color: '#bb78ff', xp: 2 } :
      { hp: 46 + t * .4, speed: 48, radius: 15, damage: 12, color: '#e95d70', xp: 2 };
    enemies.push({ x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r, ...stats, max: stats.hp, kind, hit: 0, wobble: rand(0, 8) });
  }
  function nearestEnemy() { let best = null, bd = Infinity; for (const e of enemies) { const d = dist2(player, e); if (d < bd) { best = e; bd = d; } } return best; }
  const aliceElements = [
    { id: 'poison', name: 'Verde venenoso', short: 'VENENO', color: '#71e56d' },
    { id: 'slow', name: 'Azul congelante', short: 'LENTO', color: '#63caff' },
    { id: 'lifesteal', name: 'Vermelho vampírico', short: 'ROUBO', color: '#ff5d75' },
    { id: 'charm', name: 'Rosa encantado', short: 'CHARME', color: '#ff79c8' }
  ];
  function fire(target, damage = player.damage, speed = player.shotSpeed, color = '#54dcff', count = 1, element = null, scratch = false) {
    if (!target) return;
    const dx = target.x - player.x, dy = target.y - player.y, len = Math.hypot(dx, dy) || 1;
    const aim = Math.atan2(dy, dx);
    for (let i = 0; i < count; i++) { const angle = aim + (i - (count - 1) / 2) * .12; bullets.push({ x: player.x, y: player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, life: 1.5, color, element, scratch, r: 6, age: 0, trail: [], phase: rand(0, 6.28), pierce: player.pierce, hitEnemies: new Set() }); }
    if (color === '#54dcff' || scratch) { player.aimX = dx / len; player.aimY = dy / len; player.shotFlash = .14; }
    emit(player.x + dx / len * 14, player.y + dy / len * 14, '#c9f8ff', 4, .45); sound(680, .045, 'triangle', .018);
  }
  function castUltimate() {
    if (state !== 'running' || player.ult > 0) return;
    if (player.character === 'alice') {
      player.nailElement = (player.nailElement + 1) % aliceElements.length;
      const element = aliceElements[player.nailElement]; player.ult = player.ultMax;
      ultimateVfx = { x: player.x, y: player.y, radius: 135, life: .48, max: .48, targets: [], color: element.color, type: 'palette' };
      emit(player.x, player.y, element.color, 24, 1.25); floatText(player.x, player.y - 44, element.short, element.color);
      sound(540, .22, 'triangle', .045); showToast(`Esmalte ${element.name}: ${element.id === 'poison' ? 'veneno' : element.id === 'slow' ? 'lentidão' : element.id === 'lifesteal' ? 'roubo de vida' : 'inimigos recebem mais dano'}.`);
      updateHud(); return;
    }
    const radius = player.ultRadius, radius2 = radius * radius;
    const chainTargets = enemies.filter(e => dist2(player, e) < radius2).sort((a, b) => b.hp - a.hp).slice(0, 4);
    const chainSet = new Set(chainTargets);
    player.ult = player.ultMax;
    ultimateVfx = { x: player.x, y: player.y, radius, life: .9, max: .9, targets: chainTargets.map(e => ({ x: e.x, y: e.y, phase: rand(0, 6.28) })) };
    emit(player.x, player.y, '#b9f7ff', 32, 2.2); sound(170, .32, 'sawtooth', .045);
    for (const e of enemies) {
      if (dist2(player, e) >= radius2) continue;
      e.hp -= player.damage * 1.1 * player.ultDamage * (e.vulnerableTimer > 0 ? 1.25 : 1);
      e.hit = .3;
      emit(e.x, e.y, '#c5faff', chainSet.has(e) ? 7 : 2, .8);
      if (chainSet.has(e)) { e.hp -= player.damage * 1.5 * player.ultDamage * (e.vulnerableTimer > 0 ? 1.25 : 1); e.stun = 1.2; floatText(e.x, e.y - 20, '⚡ STUN', '#89edff'); }
      if (e.hp <= 0) defeat(e);
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].hp <= 0) enemies.splice(i, 1);
    showToast('ULTIMATE: RAJADA DE CHOQUE!');
  }
  function applyNailEffect(enemy, element, damage) {
    if (!element) return;
    if (element.id === 'poison') { enemy.poisonTimer = 4 * player.nailPower; enemy.poisonDps = Math.max(enemy.poisonDps || 0, player.damage * .22 * player.nailPower); }
    else if (element.id === 'slow') enemy.slowTimer = Math.max(enemy.slowTimer || 0, 2.4 * player.nailPower);
    else if (element.id === 'lifesteal') player.hp = Math.min(player.maxHp, player.hp + damage * Math.min(.55, .22 * player.nailPower));
    else if (element.id === 'charm') enemy.vulnerableTimer = Math.max(enemy.vulnerableTimer || 0, 4 * player.nailPower);
  }
  function defeat(e) { kills++; player.kills++; emit(e.x, e.y, e.color, 9); if (xpOrbs.length >= MAX_XP_ORBS) xpOrbs.shift(); xpOrbs.push({ x: e.x, y: e.y, value: e.xp, r: 6, phase: rand(0, 6) }); sound(250 + Math.random() * 100, .05, 'square', .012); }
  function addXp(value) { player.xp += Math.round(value * player.xpGain); if (player.xp >= player.nextXp) { player.xp -= player.nextXp; player.level++; player.nextXp = Math.round(player.nextXp * 1.28 + 2); makeUpgradeOptions(); setMode('upgrade'); sound(740, .15, 'sine', .04); } }
  const upgrades = [
    { id: 'rapid', rarity: 'rare', icon: '⚡', category: 'COMBATE', title: 'Gatilho rápido', desc: 'Atira 18% mais rápido.', apply: () => player.fireRate = Math.max(.16, player.fireRate * .82) },
    { id: 'damage', rarity: 'epic', icon: '✦', category: 'COMBATE', title: 'Carga forte', desc: 'Seus tiros causam 30% mais dano.', apply: () => player.damage *= 1.3 },
    { id: 'speed', rarity: 'common', icon: '➤', category: 'MOVIMENTO', title: 'Passo ligeiro', desc: 'Move 12% mais rápido.', apply: () => player.speed *= 1.12 },
    { id: 'toughness', rarity: 'common', icon: '▰', category: 'SOBREVIVÊNCIA', title: 'Casca grossa', desc: '+15 de vida máxima e recupera 15.', apply: () => { player.maxHp += 15; player.hp = Math.min(player.maxHp, player.hp + 15); } },
    { id: 'heart', rarity: 'rare', icon: '♥', category: 'SOBREVIVÊNCIA', title: 'Fôlego extra', desc: '+25 de vida máxima e recupera 25.', apply: () => { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); } },
    { id: 'magnet', rarity: 'common', icon: '◉', category: 'SUPORTE', title: 'Ímã de XP', desc: 'Atrai experiência de mais longe.', apply: () => player.pickup += 45 },
    { id: 'companion', rarity: 'legendary', icon: '◈', category: 'SUPORTE', title: 'Mini parceiro', desc: 'Um orbe aliado dispara junto contigo.', apply: () => { player.companion++; if (companions.length < player.companion) companions.push({ angle: Math.random() * 6.28 }); } },
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
    const remaining = [...upgrades]; currentChoices = [];
    while (currentChoices.length < 3 && remaining.length) {
      const rarity = rollRarity(new Set(remaining.map(u => u.rarity))), pool = remaining.filter(u => u.rarity === rarity);
      const chosen = pool[Math.floor(Math.random() * pool.length)]; currentChoices.push(chosen); remaining.splice(remaining.indexOf(chosen), 1);
    }
    ui.options.innerHTML = '';
    currentChoices.forEach((u, i) => { const chance = rarityChances[u.rarity]; const b = document.createElement('button'); b.className = `upgrade-card rarity-${u.rarity}`; b.setAttribute('aria-label', `${rarityNames[u.rarity]} (${chance}% por card) · ${i + 1}: ${u.title}. ${u.desc}`); b.innerHTML = `<span class="card-rarity">${rarityNames[u.rarity]} · ${chance}%</span><span class="card-kicker">${u.category}</span><span class="card-symbol">${u.icon}</span><span class="card-key">${i + 1}</span><h3>${u.title}</h3><p>${u.desc}</p><span class="card-pick">ESCOLHER <b>↗</b></span>`; b.addEventListener('click', () => chooseUpgrade(i)); ui.options.appendChild(b); });
  }
  function chooseUpgrade(i) { if (state !== 'upgrade' || !currentChoices[i]) return; currentChoices[i].apply(); setMode('running'); showToast(`${currentChoices[i].title} adquirido!`); }
  function spawnChest() { const a = rand(0, 6.28), r = rand(230, 380); chest = { x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r, opened: false, pulse: 0 }; showToast('Um baú apareceu por perto. Procura no mapa!'); }
  function openChest() { items.push({ x: chest.x, y: chest.y, kind: 'toast', pulse: 0, age: 0 }); chestProgress = 0; emit(chest.x, chest.y, '#ffd66e', 35, 1.6); sound(880, .3, 'triangle', .05); floatText(chest.x, chest.y - 35, '🍞!', '#ffe69a'); showToast('Baú aberto: a Torrada da Gorda caiu! Chega perto para pegar.'); chest = null; ui.chest.classList.add('hidden'); }

  function useToast() {
    if (toastCount <= 0) { showToast('Não tem Torrada da Gorda no inventário.'); return; }
    if (player.hp >= player.maxHp) { showToast('Tua vida já está cheia. Guarda a torrada para depois!'); return; }
    const healed = Math.min(18, player.maxHp - player.hp);
    player.hp += healed; toastCount--;
    emit(player.x, player.y, '#8dffb0', 18, .9); floatText(player.x, player.y - 34, `+${Math.round(healed)} VIDA`, '#a9ffbe');
    sound(740, .2, 'sine', .04); showToast(`Torrada da Gorda usada: +${Math.round(healed)} de vida.`); updateHud();
  }

  function update(dt) {
    elapsed += dt; player.ult = Math.max(0, player.ult - dt); player.invuln = Math.max(0, player.invuln - dt); player.shotFlash = Math.max(0, player.shotFlash - dt); if (ultimateVfx && (ultimateVfx.life -= dt) <= 0) ultimateVfx = null;
    let ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joyX;
    let iy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + joyY;
    const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const moving = Math.hypot(ix, iy) > .09;
    if (moving) { player.facing = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 2 : 3) : (iy < 0 ? 1 : 0); player.walk += dt * 9; }
    player.vx = ix * player.speed; player.vy = iy * player.speed; player.x += player.vx * dt; player.y += player.vy * dt;
    spawnTimer -= dt; const spawnEvery = Math.max(.28, 1.2 - elapsed * .004); if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = spawnEvery; if (elapsed > 70 && Math.random() < .22) spawnEnemy(); }
    if (!bossSpawned && elapsed >= 45 && enemies.length < MAX_ENEMIES) { bossSpawned = true; spawnEnemy('boss'); showToast('O REI DO POSTE apareceu!'); sound(180, .5, 'sawtooth', .06); }
    fireTimer -= dt; if (fireTimer <= 0) { const element = player.character === 'alice' && player.nailElement >= 0 ? aliceElements[player.nailElement] : null; const color = player.character === 'alice' ? (element?.color || '#e8e0e8') : '#54dcff'; fire(nearestEnemy(), player.damage, player.shotSpeed, color, player.multishot, element, player.character === 'alice'); fireTimer = player.fireRate; }
    if (player.companion) { companionTimer -= dt; if (companionTimer <= 0) { for (const c of companions) fire(nearestEnemy(), player.damage * player.companionDamage, player.shotSpeed * .86, '#b98cff'); companionTimer = player.companionRate; } for (const c of companions) c.angle += dt * 1.1; }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], dx = player.x - e.x, dy = player.y - e.y, len = Math.hypot(dx, dy) || 1;
      e.poisonTimer = Math.max(0, (e.poisonTimer || 0) - dt); e.slowTimer = Math.max(0, (e.slowTimer || 0) - dt); e.vulnerableTimer = Math.max(0, (e.vulnerableTimer || 0) - dt);
      if (e.poisonTimer > 0) e.hp -= e.poisonDps * dt;
      if (e.hp <= 0) { defeat(e); enemies.splice(i, 1); continue; }
      e.stun = Math.max(0, (e.stun || 0) - dt);
      if (e.stun > 0) { e.hit = Math.max(e.hit, .08); continue; }
      const moveSpeed = e.speed * (e.slowTimer > 0 ? .55 : 1); e.x += dx / len * moveSpeed * dt; e.y += dy / len * moveSpeed * dt; e.hit = Math.max(0, e.hit - dt); e.wobble += dt * 5;
      if (len < e.radius + 17 && player.invuln <= 0) { player.hp -= e.damage; player.invuln = .62; emit(player.x, player.y, '#ff6478', 8); sound(120, .12, 'sawtooth', .035); if (player.hp <= 0) gameOver(); }
    }
    for (let i = bullets.length - 1; i >= 0; i--) { const b = bullets[i]; b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.pop(); b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt; b.phase += dt * 14; b.life -= dt; let gone = b.life <= 0; for (let j = enemies.length - 1; j >= 0 && !gone; j--) { const e = enemies[j]; if (b.hitEnemies.has(e) || dist2(b, e) >= (e.radius + b.r) ** 2) continue; b.hitEnemies.add(e); const critical = Math.random() < player.critChance, vulnerable = e.vulnerableTimer > 0 ? 1.25 : 1, damage = b.damage * (critical ? 2 : 1) * vulnerable; e.hp -= damage; e.hit = .12; applyNailEffect(e, b.element, damage); emit(b.x, b.y, b.color, 6, .62); floatText(e.x, e.y - e.radius, `${critical ? 'CRIT! ' : ''}${Math.round(damage)}`, critical ? '#ffe27c' : '#bdf4ff'); if (b.pierce > 0) b.pierce--; else gone = true; if (e.hp <= 0) { defeat(e); enemies.splice(j, 1); } } if (gone) bullets.splice(i, 1); }
    for (let i = xpOrbs.length - 1; i >= 0; i--) { const o = xpOrbs[i], d = Math.sqrt(dist2(o, player)); o.phase += dt * 5; if (d < player.pickup) { const k = 1 - d / player.pickup; o.x += (player.x - o.x) * Math.min(1, dt * (2 + k * 8)); o.y += (player.y - o.y) * Math.min(1, dt * (2 + k * 8)); } if (d < 23) { addXp(o.value); emit(o.x, o.y, '#65dbff', 3, .35); xpOrbs.splice(i, 1); } }
    chestTimer -= dt; if (!chest && chestTimer <= 0) { spawnChest(); chestTimer = 45; }
    if (chest) { chest.pulse += dt * 4; const d = Math.sqrt(dist2(player, chest)); const still = !moving && d < 46; if (still) { chestProgress += dt; ui.chest.classList.remove('hidden'); ui.chestLabel.textContent = chestProgress >= 3 ? 'BAÚ ABERTO!' : 'Fica parado para abrir'; ui.chestFill.style.width = `${Math.min(100, chestProgress / 3 * 100)}%`; if (chestProgress >= 3) openChest(); } else { chestProgress = 0; ui.chest.classList.add('hidden'); if (d < 85) { ui.chest.classList.remove('hidden'); ui.chestLabel.textContent = 'Chega perto e fica parado'; ui.chestFill.style.width = '0%'; } } }
    let nearbyItem = null, nearbyItemDistance = Infinity;
    for (let i = items.length - 1; i >= 0; i--) { const item = items[i], d = Math.sqrt(dist2(player, item)); item.pulse += dt * 4; item.age += dt; if (d < nearbyItemDistance) { nearbyItem = item; nearbyItemDistance = d; } if (d < 34) { toastCount++; emit(item.x, item.y, '#ffe59a', 28, 1.35); sound(920, .22, 'triangle', .045); floatText(item.x, item.y - 25, 'Torrada +1', '#ffe69a'); showToast(`Torrada da Gorda guardada no inventário (${toastCount}).`); items.splice(i, 1); nearbyItem = null; nearbyItemDistance = Infinity; } }
    if (nearbyItem && nearbyItemDistance < 92) { ui.pickup.classList.remove('hidden'); ui.pickupLabel.textContent = nearbyItemDistance < 34 ? 'Pega: Torrada da Gorda' : 'Torrada da Gorda no chão'; } else ui.pickup.classList.add('hidden');
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = floating.length - 1; i >= 0; i--) { const f = floating[i]; f.y -= 23 * dt; f.life -= dt; if (f.life <= 0) floating.splice(i, 1); }
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) ui.toast.classList.add('hidden');
    updateHud();
  }
  function gameOver() { player.hp = 0; $('final-time').textContent = fmt(elapsed); $('final-kills').textContent = kills; $('final-level').textContent = player.level; try { const best = Math.max(Number(localStorage.getItem('junqBulletBest') || 0), Math.floor(elapsed)); localStorage.setItem('junqBulletBest', String(best)); } catch (_) {} setMode('gameover'); }
  function updateHud() {
    ui.health.style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`; ui.healthText.textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
    ui.xp.style.width = `${player.xp / player.nextXp * 100}%`; ui.level.textContent = player.level; ui.timer.textContent = fmt(elapsed); ui.kills.textContent = kills;
    ui.ult.disabled = player.ult > 0; ui.ult.style.setProperty('--cooldown', player.ult > 0 ? .68 : 0); ui.ultFill.style.opacity = player.ult > 0 ? '.7' : '0'; ui.ultFill.style.clipPath = `inset(${100 - (1 - player.ult / player.ultMax) * 100}% 0 0 0)`;
    const element = player.nailElement >= 0 ? aliceElements[player.nailElement] : null;
    ui.ultIcon.textContent = player.character === 'alice' ? '💅' : '⚡'; ui.ultLabel.textContent = player.character === 'alice' ? (element?.short || 'NAT') : 'ULT';
    ui.ult.setAttribute('aria-label', player.character === 'alice' ? `Trocar esmalte${element ? `; atual: ${element.name}` : ''}` : 'Ultimate de choque');
    ui.ult.style.setProperty('--element-color', element?.color || '#dfe8ef'); ui.ult.classList.toggle('alice-ultimate', player.character === 'alice');
    ui.toastCount.textContent = toastCount; ui.toastUse.classList.toggle('hidden', toastCount <= 0 || state !== 'running'); ui.toastUse.disabled = player.hp >= player.maxHp;
  }

  function drawFloor() {
    ctx.fillStyle = '#17211f'; ctx.fillRect(0, 0, w, h);
    const size = 256, ox = ((-player.x % size) + size) % size, oy = ((-player.y % size) + size) % size;
    ctx.save(); ctx.translate(ox, oy); ctx.fillStyle = floorPattern; ctx.fillRect(-ox, -oy, w + size, h + size); ctx.restore();
  }
  function screenPos(o) { return { x: o.x - player.x + w / 2, y: o.y - player.y + h / 2 }; }
  function drawChest() { if (!chest) return; const p = screenPos(chest); ctx.save(); ctx.translate(p.x,p.y+Math.sin(chest.pulse)*3); ctx.fillStyle='rgba(255,200,93,.16)';ctx.fillRect(-20,-18,40,40);ctx.fillStyle='#b96d26';ctx.fillRect(-15,-10,30,22);ctx.fillStyle='#edb84e';ctx.fillRect(-16,-14,32,9);ctx.fillStyle='#78421d';ctx.fillRect(-3,-7,6,17);ctx.fillStyle='#fff0a0';ctx.fillRect(-2,-7,4,5);ctx.restore(); }
  function drawItem(item) { const p = screenPos(item), bob = Math.sin(item.pulse) * 3; ctx.save(); ctx.translate(p.x, p.y - 6 - bob); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffd76b'; ctx.globalAlpha = .16 + Math.sin(item.pulse * 1.6) * .05; ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(item.pulse) * 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; if (toastSprite.complete && toastSprite.naturalWidth) ctx.drawImage(toastSprite, -18, -18, 36, 36); else { ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🍞', 0, 0); } ctx.restore(); }
  function drawUltimate() {
    if (!ultimateVfx) return;
    const v = ultimateVfx, p = screenPos(v), progress = 1 - v.life / v.max, fade = clamp(v.life / .38, 0, 1), radius = v.radius * Math.min(1, progress * 1.65);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const effectColor = v.color || '#42dfff';
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
      const statusColor=e.poisonTimer>0?'#78ed6f':e.slowTimer>0?'#66caff':e.vulnerableTimer>0?'#ff79c8':e.color; ctx.fillStyle=e.stun>0?'#83efff':e.hit?'#fff':statusColor;
      if(e.kind==='bat'){ctx.beginPath();ctx.moveTo(-r,-2);ctx.lineTo(-r*1.6,-r*.8);ctx.lineTo(-r*1.35,r*.5);ctx.lineTo(0,r*.25);ctx.lineTo(r*1.35,r*.5);ctx.lineTo(r*1.6,-r*.8);ctx.lineTo(r,-2);ctx.closePath();ctx.fill();}
      else {ctx.beginPath();ctx.ellipse(0,0,r*1.08,r*.88,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-r*.72,-r*.52,r*1.44,r*1.18);}
      ctx.fillStyle='#17202a';ctx.fillRect(-r*.45,-r*.14,3,4);ctx.fillRect(r*.18,-r*.14,3,4);ctx.fillStyle='#fff';ctx.fillRect(-r*.38,-r*.12,1,1);
    }
    ctx.restore();
    if(e.hp<e.max){const barWidth=e.kind==='boss'?r*2.6:r*2, barY=p.y-drawHeight*.58-7;ctx.fillStyle='#0d1014';ctx.fillRect(p.x-barWidth/2,barY,barWidth,3);ctx.fillStyle=e.kind==='boss'?'#4bdfff':'#ff6979';ctx.fillRect(p.x-barWidth/2,barY,barWidth*clamp(e.hp/e.max,0,1),3);}
  }
  function drawPlayer() { const pos=screenPos(player), sx=pos.x, sy=pos.y; ctx.fillStyle='#07101077';ctx.beginPath();ctx.ellipse(sx,sy+16,19,9,0,0,Math.PI*2);ctx.fill();
    if (player.shotFlash > 0) { ctx.save(); ctx.globalAlpha = player.shotFlash * 2; ctx.strokeStyle = player.character === 'alice' ? (player.nailElement >= 0 ? aliceElements[player.nailElement].color : '#e8e0e8') : '#65e7ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 21 + player.shotFlash * 10, 13 + player.shotFlash * 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if(player.character === 'alice' && aliceAtlas.complete && aliceAtlas.naturalWidth){const cell=aliceAtlas.naturalWidth/4,rowH=aliceAtlas.naturalHeight/4,col=Math.floor(player.walk)%4,size=68,footY=sy+32;ctx.drawImage(aliceAtlas,col*cell,player.facing*rowH,cell,rowH,sx-size/2,footY-size,size,size);}
    else if(player.character !== 'alice' && atlas.complete && atlas.naturalWidth){const cell=atlas.naturalWidth/4,rowH=atlas.naturalHeight/4,col=Math.floor(player.walk)%4,frame=atlasFrames[player.facing][col],scale=68/cell,drawW=frame[2]*scale,drawH=frame[3]*scale,footY=sy+32;ctx.drawImage(atlas,col*cell+frame[0],player.facing*rowH+frame[1],frame[2],frame[3],sx-drawW/2,footY-drawH,drawW,drawH);}
    else {ctx.fillStyle='#191c25';ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dd365f';ctx.fillRect(sx-10,sy-12,20,22);ctx.fillStyle='#f2dec0';ctx.fillRect(sx-10,sy-8,5,15);ctx.fillRect(sx+5,sy-8,5,15);ctx.fillStyle='#111';ctx.fillRect(sx-7,sy-17,14,8);ctx.fillStyle='#48cfff';ctx.fillRect(sx+5,sy-17,3,3);}
    if(player.invuln>0 && Math.floor(elapsed*18)%2===0){ctx.strokeStyle='#ff8391';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy,22,0,Math.PI*2);ctx.stroke();}
    for(const c of companions){const x=sx+Math.cos(c.angle)*38,y=sy+Math.sin(c.angle)*22;ctx.globalAlpha=.25;ctx.fillStyle='#bb83ff';ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#d9b8ff';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();}
  }
  function render() {
    ctx.setTransform(dpr,0,0,dpr,0,0); drawFloor();
    for(const o of xpOrbs){const p=screenPos(o);ctx.fillStyle='#74e4ff';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillRect(-5,-5,10,10);ctx.restore();}
    drawChest(); for(const item of items) drawItem(item); for(const b of bullets) drawBullet(b);
    for(const e of enemies)drawEnemy(e); drawUltimate(); for(const p of particles){const q=screenPos(p);ctx.globalAlpha=clamp(p.life/(p.max||.55),0,1);ctx.fillStyle=p.color;ctx.fillRect(q.x,q.y,p.size,p.size);}ctx.globalAlpha=1;
    drawPlayer(); for(const f of floating){const p=screenPos(f);ctx.globalAlpha=clamp(f.life/.8,0,1);ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle=f.color;ctx.fillText(f.text,p.x,p.y);}ctx.globalAlpha=1;
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
