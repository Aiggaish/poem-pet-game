// ==========================================
// 古诗小达人 · 宠物养成记 - 核心逻辑 v2
// ==========================================

// ---- 游戏状态 ----
var gameState = {
  pet: {
    name: '小可爱',
    type: null, // 'dog' | 'cat' | 'rabbit' | 'dragon' — null表示未选择
    level: 0,
    exp: 0,
    hunger: 100,
    happiness: 100,
    health: 100,
    lastFeedTime: null,
    lastDecayTime: null
  },
  inventory: {
    basic_food: 3,
    milk: 2,
    fish: 0,
    carrot: 0,
    apple: 0,
    cookie: 0,
    canned_food: 0,
    sushi: 0,
    bone: 0,
    honey: 0,
    ice_cream: 0,
    pizza: 0,
    cake: 0,
    feast: 0
  },
  checkin: {
    streak: 0,
    bestStreak: 0,
    lastCheckinDate: null,
    todayCount: 0,
    todayDate: null,
    history: {},
    completedPoems: [],
    completedStories: [],
    clearedGates: [] // 已通关的关卡id列表
  },
  stats: {
    totalCheckins: 0,
    poemsRecited: 0,
    storiesRead: 0,
    unlockedAchievements: []
  }
};

// ---- 持久化 ----
var STORAGE_KEY = 'pet_poem_game_v2';

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

function loadGame() {
  try {
    // 尝试新key
    var saved = localStorage.getItem(STORAGE_KEY);
    // 兼容旧key
    if (!saved) {
      saved = localStorage.getItem('pet_poem_game_v1');
    }
    if (saved) {
      var loaded = JSON.parse(saved);
      // 合并状态，确保新字段存在
      gameState.pet = Object.assign(gameState.pet, loaded.pet || {});
      gameState.inventory = Object.assign(gameState.inventory, loaded.inventory || {});
      gameState.checkin = Object.assign(gameState.checkin, loaded.checkin || {});
      gameState.stats = Object.assign(gameState.stats, loaded.stats || {});

      // 确保数组存在
      gameState.checkin.completedPoems = gameState.checkin.completedPoems || [];
      gameState.checkin.completedStories = gameState.checkin.completedStories || [];
      gameState.checkin.history = gameState.checkin.history || {};
      gameState.checkin.clearedGates = gameState.checkin.clearedGates || [];
      gameState.stats.unlockedAchievements = gameState.stats.unlockedAchievements || [];
      gameState.pet.lastDecayTime = gameState.pet.lastDecayTime || null;

      // 如果没有选宠物类型，默认为dog（兼容旧存档）
      if (!gameState.pet.type) {
        gameState.pet.type = 'dog';
      }

      // 确保新食物字段存在
      var newFoods = ['fish', 'carrot', 'apple', 'cookie', 'sushi', 'honey', 'ice_cream', 'pizza', 'feast'];
      newFoods.forEach(function(f) {
        if (gameState.inventory[f] === undefined) {
          gameState.inventory[f] = 0;
        }
      });

      return true;
    }
  } catch (e) {
    console.warn('加载失败', e);
  }
  return false;
}

// ---- 日期工具 ----
function getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getYesterdayStr() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function checkNewDay() {
  var today = getTodayStr();
  if (gameState.checkin.todayDate !== today) {
    gameState.checkin.todayDate = today;
    gameState.checkin.todayCount = 0;
    if (gameState.checkin.lastCheckinDate && gameState.checkin.lastCheckinDate !== getYesterdayStr() && gameState.checkin.lastCheckinDate !== today) {
      gameState.checkin.streak = 0;
    }
    saveGame();
  }
  checkTimeDecay();
}

// ---- 基于时间的属性衰减 ----
function checkTimeDecay() {
  var now = Date.now();
  var lastDecay = gameState.pet.lastDecayTime;
  if (!lastDecay) {
    gameState.pet.lastDecayTime = now;
    saveGame();
    return;
  }
  var elapsed = now - lastDecay;
  var TWO_HOURS = 2 * 60 * 60 * 1000;
  var FOUR_HOURS = 4 * 60 * 60 * 1000;
  var hungerIntervals = Math.floor(elapsed / TWO_HOURS);
  if (hungerIntervals > 0) {
    gameState.pet.hunger = Math.max(0, gameState.pet.hunger - hungerIntervals * 8);
  }
  var happyIntervals = Math.floor(elapsed / FOUR_HOURS);
  if (happyIntervals > 0) {
    gameState.pet.happiness = Math.max(0, gameState.pet.happiness - happyIntervals * 5);
  }
  if (gameState.pet.hunger < 30 && happyIntervals > 0) {
    gameState.pet.health = Math.max(0, gameState.pet.health - happyIntervals * 5);
  }
  if (hungerIntervals > 0 || happyIntervals > 0) {
    var consumedMs = Math.max(hungerIntervals * TWO_HOURS, happyIntervals * FOUR_HOURS);
    gameState.pet.lastDecayTime = lastDecay + consumedMs;
    saveGame();
  }
}

// ---- 获取当前宠物阶段 ----
function getCurrentStage() {
  return getPetStageInfo(gameState.pet.type, gameState.pet.level);
}

// ---- 获取升级所需经验 ----
function getExpNeeded() {
  return getExpForLevel(gameState.pet.level + 1);
}

// ---- 获取进化阶段进度 ----
function getStageProgress() {
  var level = gameState.pet.level;
  var pet = getPetType(gameState.pet.type);
  var currentStage = getPetStageIndex(level, gameState.pet.type);
  if (currentStage >= pet.stages.length - 1) return 100;
  var stageStartLevel = pet.stages[currentStage].minLevel;
  var nextStageLevel = pet.stages[currentStage + 1].minLevel;
  var levelRange = nextStageLevel - stageStartLevel;
  var expNeeded = getExpNeeded();
  var expProgress = expNeeded > 0 ? (gameState.pet.exp / expNeeded) : 0;
  var totalProgress = (level - stageStartLevel + expProgress) / levelRange * 100;
  return Math.min(100, Math.max(0, Math.round(totalProgress)));
}

// ---- Toast ----
function showToast(msg, duration) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('active');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() {
    toast.classList.remove('active');
  }, duration || 2000);
}

// ---- 弹窗控制 ----
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ==========================================
// 宠物选择
// ==========================================
function renderPetSelection() {
  var grid = document.getElementById('pet-select-grid');
  if (!grid) return;
  grid.innerHTML = '';
  PETS.forEach(function(pet) {
    var div = document.createElement('div');
    div.className = 'pet-select-card';
    div.style.borderColor = pet.color;
    div.innerHTML =
      '<div class="pet-select-emoji" style="color:' + pet.color + '">' + pet.emoji + '</div>' +
      '<div class="pet-select-name">' + pet.name + '</div>' +
      '<div class="pet-select-desc">' + pet.desc + '</div>';
    div.onclick = function() { selectPet(pet.id); };
    grid.appendChild(div);
  });
}

function selectPet(petId) {
  gameState.pet.type = petId;
  var pet = getPetType(petId);
  gameState.pet.name = pet.name + '宝宝';
  saveGame();
  document.getElementById('pet-select-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
  showToast('你选择了' + pet.name + '！好好照顾它吧！', 3000);
  renderAll();
}

// ==========================================
// 渲染函数
// ==========================================
function renderAll() {
  renderPet();
  renderInventory();
  renderFoodGrid();
  renderAchievements();
  renderArchive();
  renderCheckinStatus();
}

function renderPet() {
  var pet = gameState.pet;
  var stage = getCurrentStage();
  var petType = getPetType(pet.type);

  document.getElementById('pet-emoji-top').textContent = stage.emoji;
  document.getElementById('pet-name-display').textContent = pet.name;
  document.getElementById('pet-level-top').textContent = pet.level;
  document.getElementById('streak-count').textContent = gameState.checkin.streak;
  document.getElementById('pet-emoji-big').textContent = stage.emoji;
  document.getElementById('pet-stage-name').textContent = stage.name;

  document.getElementById('bar-hunger').style.width = pet.hunger + '%';
  document.getElementById('bar-happiness').style.width = pet.happiness + '%';
  document.getElementById('bar-health').style.width = pet.health + '%';
  document.getElementById('text-hunger').textContent = Math.floor(pet.hunger);
  document.getElementById('text-happiness').textContent = Math.floor(pet.happiness);
  document.getElementById('text-health').textContent = Math.floor(pet.health);

  var stagePercent = getStageProgress();
  var currentStageIdx = getPetStageIndex(pet.level, pet.type);
  var nextStageName = (currentStageIdx < petType.stages.length - 1) ? petType.stages[currentStageIdx + 1].name : '已满级';
  document.getElementById('exp-bar').style.width = Math.min(100, stagePercent) + '%';
  document.getElementById('exp-text').textContent = 'Lv.' + pet.level + ' · 进化进度 ' + stagePercent + '%';

  var tipText = '';
  if (pet.hunger < 20) {
    tipText = '宠物快饿坏了，快喂点东西吧！';
  } else if (pet.hunger < 40) {
    tipText = '宠物有点饿了，记得喂它哦~';
  } else if (gameState.checkin.todayCount === 0) {
    var cs = getPetStageIndex(pet.level, pet.type);
    var pt = getPetType(pet.type);
    if (cs < pt.stages.length - 1) {
      tipText = '今天还没打卡哦！背首古诗离' + pt.stages[cs + 1].name + '更近一步！';
    } else {
      tipText = '今天还没打卡哦，快去背首古诗吧！';
    }
  } else if (gameState.checkin.todayCount < 3) {
    tipText = '已经打卡' + gameState.checkin.todayCount + '次啦，继续加油！';
  } else {
    tipText = '今天的打卡太棒了，记得来喂宠物哦！';
  }
  document.getElementById('tip-text').textContent = tipText;
}

function renderFoodGrid() {
  var grid = document.getElementById('food-grid');
  grid.innerHTML = '';
  Object.keys(FOODS).forEach(function(key) {
    var food = FOODS[key];
    var count = gameState.inventory[key] || 0;
    var div = document.createElement('div');
    div.className = 'food-btn' + (count === 0 ? ' disabled' : '');
    div.innerHTML =
      '<span class="food-emoji">' + food.emoji + '</span>' +
      '<span class="food-name">' + food.name + '</span>' +
      (count > 0 ? '<span class="food-count">' + count + '</span>' : '');
    if (count > 0) {
      div.onclick = function() { feedPet(key); };
    }
    grid.appendChild(div);
  });
}

function feedPet(foodKey) {
  var food = FOODS[foodKey];
  if (!food) return;
  if (!gameState.inventory[foodKey] || gameState.inventory[foodKey] <= 0) {
    showToast('没有' + food.name + '了！');
    return;
  }
  if (gameState.pet.hunger >= 100 && gameState.pet.happiness >= 100 && gameState.pet.health >= 100) {
    showToast('宠物现在不饿哦~');
    return;
  }
  gameState.inventory[foodKey]--;
  var petEl = document.getElementById('pet-emoji-big');
  petEl.classList.add('eating');
  showFeedAnimation(food.emoji);
  setTimeout(function() {
    petEl.classList.remove('eating');
    petEl.classList.add('happy');
    setTimeout(function() { petEl.classList.remove('happy'); }, 1500);
  }, 1000);
  gameState.pet.hunger = Math.min(100, gameState.pet.hunger + food.hunger);
  gameState.pet.happiness = Math.min(100, gameState.pet.happiness + food.happiness);
  gameState.pet.health = Math.min(100, gameState.pet.health + food.health);
  var oldLevel = gameState.pet.level;
  gameState.pet.exp += food.exp;
  checkLevelUp(oldLevel);
  showToast(food.name + ' +1，' + food.name + '真好吃！');
  saveGame();
  renderAll();
  checkAchievements();
}

function showFeedAnimation(emoji) {
  var petEl = document.getElementById('pet-emoji-big');
  var petRect = petEl.getBoundingClientRect();
  var animEl = document.getElementById('feed-animation');
  animEl.textContent = emoji;
  animEl.style.left = (petRect.left + petRect.width / 2 - 16) + 'px';
  animEl.style.top = (petRect.top + 10) + 'px';
  animEl.classList.add('active');
  setTimeout(function() { animEl.classList.remove('active'); }, 800);
}

function checkLevelUp(oldLevel) {
  var leveled = false;
  while (gameState.pet.exp >= getExpNeeded()) {
    gameState.pet.exp -= getExpNeeded();
    gameState.pet.level++;
    leveled = true;
  }
  if (leveled) {
    var oldStage = getPetStageIndex(oldLevel, gameState.pet.type);
    var newStage = getPetStageIndex(gameState.pet.level, gameState.pet.type);
    if (newStage > oldStage) {
      var petEl = document.getElementById('pet-emoji-big');
      petEl.classList.add('evolving');
      setTimeout(function() {
        petEl.classList.remove('evolving');
        showEvolveModal(newStage);
      }, 1500);
    } else {
      showToast('升级了！现在' + gameState.pet.level + '级！');
    }
  }
}

function showEvolveModal(stageIndex) {
  var pet = getPetType(gameState.pet.type);
  var stage = pet.stages[stageIndex];
  document.getElementById('evolve-emoji').textContent = stage.emoji;
  document.getElementById('evolve-name').textContent = stage.name;
  document.getElementById('evolve-desc').textContent = stage.desc;
  openModal('evolve-modal');
  createConfetti();
}

function createConfetti() {
  var colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A29BFE', '#FF6B9D', '#95E1D3'];
  for (var i = 0; i < 30; i++) {
    (function(i) {
      var confetti = document.createElement('div');
      confetti.style.cssText =
        'position:fixed;top:-10px;left:' + Math.random() * 100 + '%;' +
        'width:8px;height:8px;background:' + colors[i % colors.length] + ';' +
        'border-radius:2px;z-index:2001;pointer-events:none;' +
        'animation:confetti ' + (1.5 + Math.random() * 1.5) + 's linear forwards;';
      document.body.appendChild(confetti);
      setTimeout(function() { confetti.remove(); }, 3500);
    })(i);
  }
}

// ==========================================
// 打卡系统
// ==========================================
var currentMode = 'poem';
var currentReciteItem = null;
var currentQuizIndex = 0;
var quizPhase = 'reading'; // 'reading' | 'voice' | 'quiz'
var currentGateView = 1; // 当前查看的关卡

// 语音识别相关
var recognition = null;
var isRecording = false;
var voiceResult = '';
var speechSupported = false;

function renderCheckinStatus() {
  document.getElementById('today-count').textContent = gameState.checkin.todayCount;
}

// ---- 渲染关卡列表 ----
function renderGateList() {
  var list = document.getElementById('content-list');
  list.innerHTML = '';

  var totalCompleted = gameState.checkin.completedPoems.length;
  var maxUnlocked = getMaxUnlockedGate(totalCompleted);

  GATES.forEach(function(gate) {
    var isUnlocked = gate.id <= maxUnlocked;
    var gatePoems = getPoemsByGate(gate.id);
    var gateCompleted = getGateCompletedCount(gate.id, gameState.checkin.completedPoems);
    var isExpanded = (gate.id === currentGateView);

    var div = document.createElement('div');
    div.className = 'gate-section' + (isUnlocked ? '' : ' locked') + (isExpanded ? ' expanded' : '');

    var headerHtml =
      '<div class="gate-header" onclick="toggleGate(' + gate.id + ')">' +
        '<span class="gate-icon">' + (isUnlocked ? gate.icon : '🔒') + '</span>' +
        '<div class="gate-info">' +
          '<div class="gate-name">' + (isUnlocked ? gate.name : '???') + '</div>' +
          '<div class="gate-desc">' + (isUnlocked ? gate.grade + ' · ' + gateCompleted + '/' + gatePoems.length + '首' : '完成' + gate.unlockReq + '首古诗解锁') + '</div>' +
        '</div>' +
        '<div class="gate-progress">' +
          (isUnlocked ?
            '<div class="gate-progress-bar"><div class="gate-progress-fill" style="width:' + (gateCompleted / gatePoems.length * 100) + '%;background:' + gate.color + '"></div></div>' +
            '<span class="gate-progress-text">' + gateCompleted + '/' + gatePoems.length + '</span>'
          : '<span class="gate-lock">🔒</span>') +
        '</div>' +
        '<span class="gate-arrow' + (isExpanded ? ' rotated' : '') + '">▼</span>' +
      '</div>';

    var poemsHtml = '';
    if (isExpanded && isUnlocked) {
      poemsHtml = '<div class="gate-poems">';
      gatePoems.forEach(function(item) {
        var isDone = gameState.checkin.completedPoems.indexOf(item.id) !== -1;
        var dotsHtml = '';
        for (var d = 0; d < 3; d++) {
          dotsHtml += '<span class="difficulty-dot' + (d < Math.min(item.difficulty, 3) ? ' active' : '') + '"></span>';
        }
        var meta = item.author + ' · ' + item.dynasty;
        var rewardHint = getRewardForItem(item).name;
        poemsHtml +=
          '<div class="content-item' + (isDone ? ' done' : '') + '" onclick="openRecite(POEMS.find(function(p){return p.id===\'' + item.id + '\'}))">' +
            '<div class="content-item-info">' +
              '<div class="content-item-title">' + item.title +
                '<span class="difficulty-dots">' + dotsHtml + '</span>' +
              '</div>' +
              '<div class="content-item-meta">' + meta + ' · 奖励: ' + rewardHint + '</div>' +
            '</div>' +
            '<div class="content-item-status ' + (isDone ? 'status-done' : 'status-pending') + '">' +
              (isDone ? '已背 ✓' : '去背') +
            '</div>' +
          '</div>';
      });
      poemsHtml += '</div>';
    }

    div.innerHTML = headerHtml + poemsHtml;
    list.appendChild(div);
  });
}

function toggleGate(gateId) {
  var totalCompleted = gameState.checkin.completedPoems.length;
  var maxUnlocked = getMaxUnlockedGate(totalCompleted);
  if (gateId > maxUnlocked) {
    var gate = GATES.find(function(g) { return g.id === gateId; });
    showToast('需要完成' + gate.unlockReq + '首古诗才能解锁第' + gateId + '关！', 2500);
    return;
  }
  currentGateView = (currentGateView === gateId) ? 0 : gateId;
  renderGateList();
}

// ---- 渲染内容列表 ----
function renderContentList() {
  if (currentMode === 'poem') {
    renderGateList();
  } else {
    renderStoryList();
  }
}

function renderStoryList() {
  var list = document.getElementById('content-list');
  list.innerHTML = '';
  STORIES.forEach(function(item) {
    var isDone = gameState.checkin.completedStories.indexOf(item.id) !== -1;
    var div = document.createElement('div');
    div.className = 'content-item' + (isDone ? ' done' : '');
    var dotsHtml = '';
    for (var d = 0; d < 3; d++) {
      dotsHtml += '<span class="difficulty-dot' + (d < item.difficulty ? ' active' : '') + '"></span>';
    }
    var rewardHint = getRewardForItem(item).name;
    div.innerHTML =
      '<div class="content-item-info">' +
        '<div class="content-item-title">' + item.title +
          '<span class="difficulty-dots">' + dotsHtml + '</span>' +
        '</div>' +
        '<div class="content-item-meta">小故事 · 奖励: ' + rewardHint + '</div>' +
      '</div>' +
      '<div class="content-item-status ' + (isDone ? 'status-done' : 'status-pending') + '">' +
        (isDone ? '已读 ✓' : '去读') +
      '</div>';
    div.onclick = function() { openRecite(item); };
    list.appendChild(div);
  });
}

// ---- 获取奖励 ----
function getRewardForItem(item) {
  var baseReward;
  switch (item.difficulty) {
    case 1: baseReward = 'basic_food'; break;
    case 2: baseReward = 'milk'; break;
    case 3: baseReward = 'canned_food'; break;
    case 4: baseReward = 'sushi'; break;
    case 5: baseReward = 'bone'; break;
    case 6: baseReward = 'pizza'; break;
    default: baseReward = 'basic_food';
  }
  var streak = gameState.checkin.streak;
  var bonusReward = null;
  if (streak >= 14) bonusReward = 'feast';
  else if (streak >= 7) bonusReward = 'honey';
  else if (streak >= 3) bonusReward = 'cookie';
  return {
    base: baseReward,
    bonus: bonusReward,
    name: FOODS[baseReward].name + (bonusReward ? ' + ' + FOODS[bonusReward].name : '')
  };
}

// ---- 打开背诵详情 ----
function openRecite(item) {
  currentReciteItem = item;
  currentQuizIndex = 0;
  quizPhase = 'reading';
  var card = document.getElementById('recite-card');
  var isDone = false;
  if (currentMode === 'poem') {
    isDone = gameState.checkin.completedPoems.indexOf(item.id) !== -1;
  } else {
    isDone = gameState.checkin.completedStories.indexOf(item.id) !== -1;
  }
  var reward = getRewardForItem(item);
  var html = '<button class="recite-back-btn" onclick="switchPage(\'page-checkin\')">← 返回列表</button>';
  if (currentMode === 'poem') {
    html +=
      '<h2 class="recite-title">' + item.title + '</h2>' +
      '<p class="recite-author">[' + item.dynasty + '] ' + item.author + '</p>' +
      '<div class="recite-poem">' + item.content + '</div>' +
      '<div class="recite-translation-label">📝 译文</div>' +
      '<div class="recite-translation">' + item.translation + '</div>';
  } else {
    html +=
      '<h2 class="recite-title">' + item.title + '</h2>' +
      '<p class="recite-author">📖 小故事</p>' +
      '<div class="story-content">' + item.content + '</div>';
  }
  var rewardHtml = '🎁 完成后获得：' + FOODS[reward.base].emoji + ' ' + FOODS[reward.base].name;
  if (reward.bonus) {
    rewardHtml += ' + ' + FOODS[reward.bonus].emoji + ' ' + FOODS[reward.bonus].name;
  }
  html += '<div class="recite-reward-hint">' + rewardHtml + '</div>';
  if (isDone) {
    html += '<button class="recite-done-btn" disabled>✅ 已经完成啦</button>';
  } else {
    html +=
      '<div class="recite-gate-hint">' +
        '<div class="gate-badge">第一关 🎤 语音背诵</div>' +
        '<div class="gate-badge">第二关 📝 选择题</div>' +
      '</div>' +
      '<button class="recite-done-btn" onclick="startVoiceGate()">' +
        (currentMode === 'poem' ? '🎤 我背好了，开始语音挑战！' : '🎤 我读完了，开始语音挑战！') +
      '</button>';
  }
  card.innerHTML = html;
  switchPage('page-recite');
  document.getElementById('content-area').scrollTop = 0;
}

// ==========================================
// 语音识别（第一关）
// ==========================================
function initSpeechRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    speechSupported = true;
  }
}

function startVoiceGate() {
  quizPhase = 'voice';
  renderVoiceGate();
}

function renderVoiceGate() {
  var card = document.getElementById('recite-card');
  var item = currentReciteItem;
  var isPoem = currentMode === 'poem';

  var html = '<button class="recite-back-btn" onclick="openRecite(currentReciteItem)">← 返回阅读</button>';

  html +=
    '<div class="voice-gate-container">' +
      '<div class="voice-gate-badge">🎤 第一关：语音' + (isPoem ? '背诵' : '朗读') + '</div>' +
      '<h2 class="recite-title">' + item.title + '</h2>';

  if (isPoem) {
    // 古诗：不显示原文，需要背诵。提供"偷看一眼"按钮
    html += '<p class="recite-author">[' + item.dynasty + '] ' + item.author + '</p>';
    html += '<p class="voice-hint">请大声背诵这首古诗吧！<br>系统会自动识别你的声音~</p>';
    html += '<button class="peek-btn" onclick="peekPoem()">👀 偷看一眼</button>';
    html += '<div id="peek-area"></div>';
  } else {
    // 故事：显示原文，可以看着朗读
    html += '<p class="recite-author">📖 小故事</p>';
    html += '<div class="story-content">' + item.content + '</div>';
    html += '<p class="voice-hint">请大声朗读上面的故事吧！<br>系统会自动识别你的声音~</p>';
  }

  // 检查浏览器支持
  if (!speechSupported) {
    html +=
      '<div class="voice-unsupported">' +
        '<p>😕 当前浏览器不支持语音识别</p>' +
        '<p class="voice-unsupported-tip">请使用Chrome浏览器或Safari（iOS 14.5+）<br>或者直接跳过语音关，进入选择题</p>' +
      '</div>' +
      '<button class="btn btn-skip" onclick="startQuiz()">跳过语音，直接答题 →</button>';
  } else {
    html +=
      '<div class="voice-record-area" id="voice-record-area">' +
        '<div class="voice-status" id="voice-status"></div>' +
        '<button class="voice-mic-btn" id="voice-mic-btn" onclick="toggleRecording()">' +
          '<span class="mic-icon">🎤</span>' +
          '<span class="mic-text">点击开始录音</span>' +
        '</button>' +
        '<div class="voice-result" id="voice-result" style="display:none;">' +
          '<div class="voice-result-label">识别结果：</div>' +
          '<div class="voice-result-text" id="voice-result-text"></div>' +
        '</div>' +
        '<div class="voice-score" id="voice-score" style="display:none;">' +
          '<div class="voice-score-label">匹配度：</div>' +
          '<div class="voice-score-bar">' +
            '<div class="voice-score-fill" id="voice-score-fill"></div>' +
          '</div>' +
          '<div class="voice-score-text" id="voice-score-text"></div>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-skip" onclick="skipVoiceGate()" style="margin-top:12px;">跳过语音，直接答题 →</button>';
  }

  html += '</div>';
  card.innerHTML = html;
  document.getElementById('content-area').scrollTop = 0;
}

// 偷看古诗原文（3秒后自动隐藏）
function peekPoem() {
  var area = document.getElementById('peek-area');
  if (area.innerHTML) return; // 已经在显示了
  area.innerHTML = '<div class="peek-text">' + currentReciteItem.content + '</div>';
  setTimeout(function() {
    area.innerHTML = '';
  }, 3000);
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  // 清除之前的结果
  voiceResult = '';
  var resultEl = document.getElementById('voice-result');
  var scoreEl = document.getElementById('voice-score');
  var passBtn = document.getElementById('voice-pass-btn');
  if (resultEl) resultEl.style.display = 'none';
  if (scoreEl) scoreEl.style.display = 'none';
  if (passBtn) passBtn.remove();

  recognition = new SR();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  isRecording = true;

  var micBtn = document.getElementById('voice-mic-btn');
  var statusEl = document.getElementById('voice-status');
  if (micBtn) {
    micBtn.classList.add('recording');
    micBtn.querySelector('.mic-icon').textContent = '🔴';
    micBtn.querySelector('.mic-text').textContent = '录音中...点击停止';
  }
  if (statusEl) {
    statusEl.textContent = '🎤 正在 listening... 请大声朗读';
  }

  recognition.onstart = function() {
    if (statusEl) {
      statusEl.textContent = '🎤 正在听... 请大声朗读';
    }
  };

  recognition.onresult = function(event) {
    var final = '';
    var interim = '';
    for (var i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    voiceResult = (final + interim).trim();

    var resultText = document.getElementById('voice-result-text');
    if (voiceResult && resultEl) {
      resultEl.style.display = 'block';
      resultText.textContent = voiceResult;
    }
    if (statusEl && voiceResult) {
      statusEl.textContent = '✅ 识别中... 说完点击停止';
    }
  };

  recognition.onerror = function(event) {
    console.warn('语音识别错误:', event.error);
    var msg = '';
    switch (event.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        msg = '请允许使用麦克风哦~';
        break;
      case 'no-speech':
        msg = '没有听到声音，请再试一次~';
        break;
      case 'network':
        msg = '网络问题，语音识别需要联网~';
        break;
      case 'aborted':
        msg = '';
        break;
      default:
        msg = '识别出错(' + event.error + ')，请重试~';
    }
    if (msg) showToast(msg, 2500);
    if (statusEl) statusEl.textContent = msg;
  };

  recognition.onend = function() {
    // 不自动重启 — 识别结束后处理结果
    if (isRecording) {
      isRecording = false;
      if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.querySelector('.mic-icon').textContent = '🎤';
        micBtn.querySelector('.mic-text').textContent = '点击重新录音';
      }
      if (statusEl) {
        statusEl.textContent = '';
      }

      // 如果有识别结果，自动分析匹配度
      if (voiceResult) {
        var item = currentReciteItem;
        var isPoem = currentMode === 'poem';
        var targetText = item.content;

        var result = matchRecitation(targetText, voiceResult);
        showVoiceScore(result.score, result.passed);
      } else if (statusEl) {
        statusEl.textContent = '没有识别到声音，请重试~';
      }
    }
  };

  try {
    recognition.start();
  } catch(e) {
    console.warn('启动录音失败:', e);
    showToast('录音启动失败，请重试~', 2000);
    if (statusEl) statusEl.textContent = '录音启动失败，请重试~';
    isRecording = false;
    if (micBtn) {
      micBtn.classList.remove('recording');
      micBtn.querySelector('.mic-icon').textContent = '🎤';
      micBtn.querySelector('.mic-text').textContent = '点击开始录音';
    }
  }
}

function stopRecording() {
  isRecording = false;
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
    recognition = null;
  }

  var micBtn = document.getElementById('voice-mic-btn');
  if (micBtn) {
    micBtn.classList.remove('recording');
    micBtn.querySelector('.mic-icon').textContent = '🎤';
    micBtn.querySelector('.mic-text').textContent = '点击重新录音';
  }

  // 分析匹配度
  if (voiceResult) {
    var item = currentReciteItem;
    var isPoem = currentMode === 'poem';
    var targetText = isPoem ? item.content : item.content;

    var result = matchRecitation(targetText, voiceResult);
    showVoiceScore(result.score, result.passed);
  }
}

function showVoiceScore(score, passed) {
  var scoreEl = document.getElementById('voice-score');
  var scoreFill = document.getElementById('voice-score-fill');
  var scoreText = document.getElementById('voice-score-text');

  scoreEl.style.display = 'block';
  scoreFill.style.width = score + '%';

  if (passed) {
    scoreFill.style.background = 'linear-gradient(90deg, #4ECDC4, #44b483)';
    scoreText.innerHTML = '🎉 太棒了！匹配度 ' + score + '%，通过！';
    scoreText.style.color = '#4ECDC4';

    // 显示进入第二关按钮
    var card = document.getElementById('recite-card');
    var existing = document.getElementById('voice-pass-btn');
    if (!existing) {
      var passBtn = document.createElement('button');
      passBtn.id = 'voice-pass-btn';
      passBtn.className = 'recite-done-btn';
      passBtn.textContent = '✅ 语音通过！进入第二关 →';
      passBtn.onclick = function() { startQuiz(); };
      card.appendChild(passBtn);
    }
  } else {
    scoreFill.style.background = 'linear-gradient(90deg, #FF6B6B, #FF9F43)';
    scoreText.innerHTML = '💪 匹配度 ' + score + '%，差一点点！再试一次吧~';
    scoreText.style.color = '#FF9F43';
  }
}

// ---- 宽松匹配算法 ----
// 适合小学生口齿不清的情况
function matchRecitation(targetText, speechText) {
  // 标准化：移除所有标点和空白
  function normalize(s) {
    return s.replace(/[\s，。、！？；：""''《》（）()\n\r,.\!\?;:"'·]/g, '');
  }

  var target = normalize(targetText);
  var speech = normalize(speechText);

  if (speech.length === 0) return { score: 0, passed: false };

  // 算法1: target中的字有多少按顺序出现在speech中
  var targetInSpeech = subsequenceMatch(target, speech);

  // 算法2: speech中的字有多少在target中（防止乱说）
  var speechInTarget = charOverlap(speech, target);

  // 综合得分：以target覆盖为主(70%)，语音准确度为辅(30%)
  var score = Math.round(targetInSpeech * 0.7 + speechInTarget * 0.3);

  // 对于故事，要求更宽松（只需30%即可通过）
  var threshold = (currentMode === 'story') ? 30 : 55;

  return { score: score, passed: score >= threshold };
}

// 子序列匹配：short中的字符有多少按顺序出现在long中
function subsequenceMatch(short, long) {
  if (short.length === 0) return 100;
  var si = 0;
  for (var i = 0; i < long.length && si < short.length; i++) {
    if (long[i] === short[si]) {
      si++;
    }
  }
  return Math.round((si / short.length) * 100);
}

// 字符重叠率：speech中有多少字符出现在target中
function charOverlap(speech, target) {
  if (speech.length === 0) return 0;
  var targetSet = {};
  for (var i = 0; i < target.length; i++) {
    targetSet[target[i]] = true;
  }
  var matchCount = 0;
  for (var j = 0; j < speech.length; j++) {
    if (targetSet[speech[j]]) {
      matchCount++;
    }
  }
  return Math.round((matchCount / speech.length) * 100);
}

function skipVoiceGate() {
  showToast('跳过语音关，直接进入选择题~', 2000);
  startQuiz();
}

// ==========================================
// 选择题（第二关）
// ==========================================
function startQuiz() {
  quizPhase = 'quiz';
  currentQuizIndex = 0;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (!currentReciteItem || !currentReciteItem.quiz) return;
  var card = document.getElementById('recite-card');
  var quiz = currentReciteItem.quiz;
  var idx = currentQuizIndex;
  var total = quiz.length;
  var question = quiz[idx];

  var html = '<button class="recite-back-btn" onclick="openRecite(currentReciteItem)">← 返回阅读</button>';

  html +=
    '<div class="quiz-gate-header">' +
      '<div class="gate-badge passed">✅ 第一关 语音</div>' +
      '<div class="gate-badge active">📝 第二关 选择题</div>' +
    '</div>';

  html += '<div class="quiz-progress">' +
    '<span class="quiz-progress-text">第 ' + (idx + 1) + ' / ' + total + ' 题</span>' +
    '<div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:' + (idx / total * 100) + '%"></div></div>' +
  '</div>';

  html += '<div class="quiz-question">' + question.q + '</div>';

  html += '<div class="quiz-options">';
  for (var i = 0; i < question.options.length; i++) {
    html += '<button class="quiz-option-btn" onclick="answerQuiz(' + i + ')">' +
      '<span class="quiz-option-label">' + String.fromCharCode(65 + i) + '</span>' +
      '<span class="quiz-option-text">' + question.options[i] + '</span>' +
    '</button>';
  }
  html += '</div>';

  html += '<div class="quiz-feedback" id="quiz-feedback"></div>';

  card.innerHTML = html;
  document.getElementById('content-area').scrollTop = 0;
}

function answerQuiz(selectedIndex) {
  var quiz = currentReciteItem.quiz;
  var question = quiz[currentQuizIndex];
  var feedbackEl = document.getElementById('quiz-feedback');

  if (selectedIndex === question.answer) {
    feedbackEl.innerHTML = '<span class="quiz-correct">✅ 答对了！真棒！</span>';
    var btns = document.querySelectorAll('.quiz-option-btn');
    btns.forEach(function(b) { b.style.pointerEvents = 'none'; });
    btns[selectedIndex].classList.add('correct');

    setTimeout(function() {
      currentQuizIndex++;
      if (currentQuizIndex >= quiz.length) {
        completeCheckin();
      } else {
        renderQuizQuestion();
      }
    }, 1200);
  } else {
    feedbackEl.innerHTML = '<span class="quiz-wrong">❌ 不对哦，再想想看~</span>';
    var btns = document.querySelectorAll('.quiz-option-btn');
    btns[selectedIndex].classList.add('wrong');
    btns[selectedIndex].style.pointerEvents = 'none';
    setTimeout(function() {
      feedbackEl.innerHTML = '';
      btns[selectedIndex].classList.remove('wrong');
      btns[selectedIndex].style.pointerEvents = '';
    }, 1500);
  }
}

// ---- 完成打卡 ----
function completeCheckin() {
  if (!currentReciteItem) return;
  var item = currentReciteItem;
  var isPoem = currentMode === 'poem';

  var completedArr = isPoem ? gameState.checkin.completedPoems : gameState.checkin.completedStories;
  if (completedArr.indexOf(item.id) !== -1) {
    showToast('这个已经完成过了哦~');
    return;
  }
  completedArr.push(item.id);

  var isFirstCheckinToday = (gameState.checkin.todayCount === 0);
  var today = getTodayStr();
  var prevLastCheckinDate = gameState.checkin.lastCheckinDate;
  gameState.checkin.todayCount++;
  gameState.checkin.lastCheckinDate = today;
  if (!gameState.checkin.history[today]) {
    gameState.checkin.history[today] = 0;
  }
  gameState.checkin.history[today]++;
  if (isFirstCheckinToday) {
    var yesterday = getYesterdayStr();
    if (prevLastCheckinDate === yesterday) {
      gameState.checkin.streak++;
    } else {
      gameState.checkin.streak = 1;
    }
  }
  if (gameState.checkin.streak > gameState.checkin.bestStreak) {
    gameState.checkin.bestStreak = gameState.checkin.streak;
  }

  gameState.stats.totalCheckins++;
  if (isPoem) {
    gameState.stats.poemsRecited++;
  } else {
    gameState.stats.storiesRead++;
  }

  // 检查关卡通关
  if (isPoem && item.gate) {
    var gatePoems = getPoemsByGate(item.gate);
    var gateCompleted = getGateCompletedCount(item.gate, gameState.checkin.completedPoems);
    if (gateCompleted === gatePoems.length && gameState.checkin.clearedGates.indexOf(item.gate) === -1) {
      gameState.checkin.clearedGates.push(item.gate);
      showToast('🎉 恭喜通关第' + item.gate + '关：' + GATES[item.gate - 1].name + '！', 3000);
    }
  }

  // 发放奖励
  var reward = getRewardForItem(item);
  gameState.inventory[reward.base] = (gameState.inventory[reward.base] || 0) + 1;
  if (reward.bonus) {
    gameState.inventory[reward.bonus] = (gameState.inventory[reward.bonus] || 0) + 1;
  }

  saveGame();
  quizPhase = 'reading';
  currentQuizIndex = 0;
  switchPage('page-checkin');
  showRewardModal(reward);
  renderAll();
  checkAchievements();
}

function showRewardModal(reward) {
  var modal = document.getElementById('reward-modal');
  document.getElementById('reward-emoji').textContent = '🎉';
  document.getElementById('reward-title').textContent = '打卡成功！';
  var itemsHtml = '';
  itemsHtml += '<div class="reward-item">' + FOODS[reward.base].emoji + ' ' + FOODS[reward.base].name + ' +1</div>';
  if (reward.bonus) {
    itemsHtml += '<div class="reward-item">🔥 连续' + gameState.checkin.streak + '天加成！' + FOODS[reward.bonus].emoji + ' ' + FOODS[reward.bonus].name + ' +1</div>';
  }
  itemsHtml += '<div class="reward-item">🔥 连续打卡 ' + gameState.checkin.streak + ' 天！</div>';
  document.getElementById('reward-items').innerHTML = itemsHtml;
  openModal('reward-modal');
  createConfetti();
}

// ==========================================
// 仓库 & 成就
// ==========================================
function renderInventory() {
  var grid = document.getElementById('inventory-grid');
  grid.innerHTML = '';
  Object.keys(FOODS).forEach(function(key) {
    var food = FOODS[key];
    var count = gameState.inventory[key] || 0;
    var div = document.createElement('div');
    div.className = 'inventory-item' + (count === 0 ? ' empty' : '');
    div.innerHTML =
      '<span class="inv-emoji">' + food.emoji + '</span>' +
      '<div class="inv-name">' + food.name + '</div>' +
      '<div class="inv-desc">' + food.desc + '</div>' +
      (count > 0 ? '<span class="inv-count">x' + count + '</span>' : '');
    grid.appendChild(div);
  });
}

function renderAchievements() {
  var list = document.getElementById('achievement-list');
  list.innerHTML = '';
  ACHIEVEMENTS.forEach(function(ach) {
    var unlocked = gameState.stats.unlockedAchievements.indexOf(ach.id) !== -1;
    var div = document.createElement('div');
    div.className = 'achievement-item ' + (unlocked ? 'unlocked' : 'locked');
    div.innerHTML =
      '<span class="ach-emoji">' + ach.emoji + '</span>' +
      '<div class="ach-info">' +
        '<div class="ach-name">' + ach.name + '</div>' +
        '<div class="ach-desc">' + ach.desc + '</div>' +
      '</div>';
    list.appendChild(div);
  });
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(function(ach) {
    if (gameState.stats.unlockedAchievements.indexOf(ach.id) !== -1) return;
    var cond = ach.condition;
    var value = 0;
    switch (cond.type) {
      case 'totalCheckins': value = gameState.stats.totalCheckins; break;
      case 'bestStreak': value = gameState.checkin.bestStreak; break;
      case 'poemsRecited': value = gameState.stats.poemsRecited; break;
      case 'storiesRead': value = gameState.stats.storiesRead; break;
      case 'petStage': value = getPetStageIndex(gameState.pet.level, gameState.pet.type); break;
      case 'gateCleared': value = gameState.checkin.clearedGates.indexOf(cond.value) !== -1 ? 1 : 0; break;
    }
    if (value >= cond.value) {
      gameState.stats.unlockedAchievements.push(ach.id);
      saveGame();
      showToast('🏆 成就解锁：' + ach.name + '！', 3000);
    }
  });
  renderAchievements();
}

// ==========================================
// 档案页
// ==========================================
function renderArchive() {
  document.getElementById('stat-total-checkins').textContent = gameState.stats.totalCheckins;
  document.getElementById('stat-poems').textContent = gameState.stats.poemsRecited;
  document.getElementById('stat-stories').textContent = gameState.stats.storiesRead;
  document.getElementById('stat-best-streak').textContent = gameState.checkin.bestStreak;
  renderCalendar();
}

var calendarDate = new Date();

function renderCalendar() {
  var cal = document.getElementById('calendar');
  var year = calendarDate.getFullYear();
  var month = calendarDate.getMonth();
  var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = getTodayStr();
  var html = '';
  html += '<div class="calendar-header">';
  html += '<button class="calendar-nav-btn" onclick="changeMonth(-1)">‹</button>';
  html += '<span class="calendar-month">' + year + '年 ' + monthNames[month] + '</span>';
  html += '<button class="calendar-nav-btn" onclick="changeMonth(1)">›</button>';
  html += '</div>';
  html += '<div class="calendar-grid">';
  var weekdays = ['日','一','二','三','四','五','六'];
  weekdays.forEach(function(w) { html += '<div class="cal-weekday">' + w + '</div>'; });
  for (var i = 0; i < firstDay; i++) { html += '<div class="cal-day empty"></div>'; }
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var classes = 'cal-day';
    if (gameState.checkin.history[dateStr]) classes += ' checked';
    if (dateStr === today) classes += ' today';
    html += '<div class="' + classes + '">' + d + '</div>';
  }
  html += '</div>';
  cal.innerHTML = html;
}

function changeMonth(delta) {
  calendarDate.setMonth(calendarDate.getMonth() + delta);
  renderCalendar();
}

// ==========================================
// 页面切换
// ==========================================
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById(pageId).classList.add('active');
  var contentArea = document.getElementById('content-area');
  if (contentArea) contentArea.scrollTop = 0;
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.getAttribute('data-page') === pageId) btn.classList.add('active');
  });
  if (pageId === 'page-checkin') {
    renderContentList();
    renderCheckinStatus();
  } else if (pageId === 'page-archive') {
    renderArchive();
  }
}

// ==========================================
// 初始化
// ==========================================
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function init() {
  initSpeechRecognition();
  var hasSave = loadGame();
  checkNewDay();
  var standalone = isStandalone();

  // 检查是否需要选择宠物
  var needPetSelection = !gameState.pet.type;

  if (needPetSelection) {
    // 显示宠物选择页
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('pet-select-screen').classList.add('active');
    renderPetSelection();
  } else {
    document.getElementById('start-btn').onclick = function() {
      document.getElementById('welcome-screen').classList.remove('active');
      document.getElementById('main-screen').classList.add('active');
      if (!hasSave) {
        showToast('欢迎来到古诗小达人！送你3份口粮和2瓶牛奶作为见面礼！', 3000);
      }
      renderAll();
    };
    if (standalone || hasSave) {
      document.getElementById('welcome-screen').classList.remove('active');
      document.getElementById('main-screen').classList.add('active');
      renderAll();
    }
  }

  if (standalone) {
    var installBtns = document.querySelectorAll('#install-btn, #install-btn-main');
    installBtns.forEach(function(btn) { btn.style.display = 'none'; });
    var guide = document.getElementById('install-guide');
    if (guide) guide.style.display = 'none';
  }

  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.onclick = function() { switchPage(btn.getAttribute('data-page')); };
  });

  document.querySelectorAll('.mode-tab').forEach(function(tab) {
    tab.onclick = function() {
      document.querySelectorAll('.mode-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentMode = tab.getAttribute('data-mode');
      currentGateView = 1;
      renderContentList();
    };
  });

  document.querySelectorAll('.modal').forEach(function(modal) {
    modal.onclick = function(e) { if (e.target === modal) modal.classList.remove('active'); };
  });

  setInterval(function() {
    checkTimeDecay();
    renderPet();
  }, 5 * 60 * 1000);

  renderAll();
}

// ---- PWA 安装 ----
var deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  if (isStandalone()) { e.preventDefault(); return; }
  e.preventDefault();
  deferredInstallPrompt = e;
  var installBtn = document.getElementById('install-btn');
  if (installBtn && document.getElementById('welcome-screen').classList.contains('active')) {
    installBtn.style.display = 'inline-flex';
  }
  var installBtnMain = document.getElementById('install-btn-main');
  if (installBtnMain) {
    installBtnMain.style.display = 'inline-flex';
    var manualSteps = document.getElementById('install-manual-steps');
    if (manualSteps) manualSteps.style.display = 'none';
  }
});

window.addEventListener('appinstalled', function() {
  var installBtn = document.getElementById('install-btn');
  if (installBtn) installBtn.style.display = 'none';
  deferredInstallPrompt = null;
});

function installApp() {
  if (!deferredInstallPrompt) {
    showToast('请用浏览器菜单中的"添加到主屏幕"');
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(function(result) {
    if (result.outcome === 'accepted') showToast('安装成功！到桌面找找看 🐶');
    deferredInstallPrompt = null;
    document.querySelectorAll('#install-btn, #install-btn-main').forEach(function(btn) { btn.style.display = 'none'; });
  });
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
