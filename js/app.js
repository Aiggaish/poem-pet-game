// ==========================================
// 古诗小达人 · 宠物养成记 - 核心逻辑
// ==========================================

// ---- 游戏状态 ----
let gameState = {
  pet: {
    name: '小可爱',
    level: 0,
    exp: 0,
    hunger: 100,
    happiness: 100,
    health: 100,
    stage: 0,
    lastFeedTime: null,
    lastDecayTime: null // 上次属性衰减的时间戳
  },
  inventory: {
    basic_food: 3,
    canned_food: 0,
    bone: 0,
    cake: 0,
    milk: 2
  },
  checkin: {
    streak: 0,
    bestStreak: 0,
    lastCheckinDate: null,
    todayCount: 0,
    todayDate: null,
    history: {}, // { "2026-08-15": 2 }
    completedPoems: [], // poem ids
    completedStories: [] // story ids
  },
  stats: {
    totalCheckins: 0,
    poemsRecited: 0,
    storiesRead: 0,
    unlockedAchievements: []
  }
};

// ---- 持久化 ----
const STORAGE_KEY = 'pet_poem_game_v1';

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

function loadGame() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const loaded = JSON.parse(saved);
      gameState = Object.assign(gameState, loaded);
      // 确保新字段存在
      gameState.checkin.completedPoems = gameState.checkin.completedPoems || [];
      gameState.checkin.completedStories = gameState.checkin.completedStories || [];
      gameState.checkin.history = gameState.checkin.history || {};
      gameState.stats.unlockedAchievements = gameState.stats.unlockedAchievements || [];
      gameState.pet.lastDecayTime = gameState.pet.lastDecayTime || null;
      return true;
    }
  } catch (e) {
    console.warn('加载失败', e);
  }
  return false;
}

// ---- 日期工具 ----
function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function checkNewDay() {
  const today = getTodayStr();
  if (gameState.checkin.todayDate !== today) {
    // 新的一天，重置今日打卡数
    gameState.checkin.todayDate = today;
    gameState.checkin.todayCount = 0;
    // 检查是否断了连续打卡
    if (gameState.checkin.lastCheckinDate && gameState.checkin.lastCheckinDate !== getYesterdayStr() && gameState.checkin.lastCheckinDate !== today) {
      gameState.checkin.streak = 0;
    }
    saveGame();
  }
  // 时间衰减（每次打开APP和渲染时都检查）
  checkTimeDecay();
}

// ---- 基于时间的属性衰减 ----
// 饥饿度：每2小时衰减8点
// 心情：每4小时衰减5点
// 健康：饥饿低于30时每4小时衰减5点
function checkTimeDecay() {
  var now = Date.now();
  var lastDecay = gameState.pet.lastDecayTime;

  if (!lastDecay) {
    // 首次记录，不衰减
    gameState.pet.lastDecayTime = now;
    saveGame();
    return;
  }

  var elapsed = now - lastDecay; // 毫秒
  var TWO_HOURS = 2 * 60 * 60 * 1000;
  var FOUR_HOURS = 4 * 60 * 60 * 1000;

  // 计算饥饿度衰减（每2小时-8）
  var hungerIntervals = Math.floor(elapsed / TWO_HOURS);
  if (hungerIntervals > 0) {
    var hungerLoss = hungerIntervals * 8;
    gameState.pet.hunger = Math.max(0, gameState.pet.hunger - hungerLoss);
  }

  // 计算心情衰减（每4小时-5）
  var happyIntervals = Math.floor(elapsed / FOUR_HOURS);
  if (happyIntervals > 0) {
    var happyLoss = happyIntervals * 5;
    gameState.pet.happiness = Math.max(0, gameState.pet.happiness - happyLoss);
  }

  // 健康衰减（饥饿低于30时，每4小时-5）
  if (gameState.pet.hunger < 30 && happyIntervals > 0) {
    var healthLoss = happyIntervals * 5;
    gameState.pet.health = Math.max(0, gameState.pet.health - healthLoss);
  }

  // 更新衰减时间戳（保留不足一个周期的剩余时间）
  if (hungerIntervals > 0 || happyIntervals > 0) {
    var consumedMs = Math.max(hungerIntervals * TWO_HOURS, happyIntervals * FOUR_HOURS);
    gameState.pet.lastDecayTime = lastDecay + consumedMs;
    saveGame();
  }
}

// ---- 获取当前阶段 ----
function getCurrentStage() {
  return PET_STAGES[getPetStage(gameState.pet.level)];
}

// ---- 获取升级所需经验 ----
function getExpNeeded() {
  return getExpForLevel(gameState.pet.level + 1);
}

// ---- 获取当前进化阶段进度 (0-100) ----
// 展示从当前阶段到下一阶段的总进度，升级不会倒退
function getStageProgress() {
  var level = gameState.pet.level;
  var currentStage = getPetStage(level);

  // 最高阶段，进度满
  if (currentStage >= PET_STAGES.length - 1) {
    return 100;
  }

  var stageStartLevel = PET_STAGES[currentStage].minLevel;
  var nextStageLevel = PET_STAGES[currentStage + 1].minLevel;
  var levelRange = nextStageLevel - stageStartLevel;

  // 当前等级内的经验进度 (0-1)
  var expNeeded = getExpNeeded();
  var expProgress = expNeeded > 0 ? (gameState.pet.exp / expNeeded) : 0;

  // 总进度 = 已完成等级 + 当前等级内部分进度
  var totalProgress = (level - stageStartLevel + expProgress) / levelRange * 100;
  return Math.min(100, Math.max(0, Math.round(totalProgress)));
}

// ---- 显示Toast ----
function showToast(msg, duration) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('active');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() {
    toast.classList.remove('active');
  }, duration || 2000);
}

// ---- 弹窗控制 ----
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
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

// ---- 渲染宠物页面 ----
function renderPet() {
  var pet = gameState.pet;
  var stage = getCurrentStage();

  // 顶部栏
  document.getElementById('pet-emoji-top').textContent = stage.emoji;
  document.getElementById('pet-name-display').textContent = pet.name;
  document.getElementById('pet-level-top').textContent = pet.level;
  document.getElementById('streak-count').textContent = gameState.checkin.streak;

  // 宠物展示
  document.getElementById('pet-emoji-big').textContent = stage.emoji;
  document.getElementById('pet-stage-name').textContent = stage.name;

  // 状态条
  document.getElementById('bar-hunger').style.width = pet.hunger + '%';
  document.getElementById('bar-happiness').style.width = pet.happiness + '%';
  document.getElementById('bar-health').style.width = pet.health + '%';
  document.getElementById('text-hunger').textContent = Math.floor(pet.hunger);
  document.getElementById('text-happiness').textContent = Math.floor(pet.happiness);
  document.getElementById('text-health').textContent = Math.floor(pet.health);

  // 经验条 - 显示进化阶段进度（不会因升级而倒退）
  var stagePercent = getStageProgress();
  var currentStage = getPetStage(gameState.pet.level);
  var nextStageName = (currentStage < PET_STAGES.length - 1) ? PET_STAGES[currentStage + 1].name : '已满级';
  document.getElementById('exp-bar').style.width = Math.min(100, stagePercent) + '%';
  document.getElementById('exp-text').textContent = 'Lv.' + pet.level + ' · 进化进度 ' + stagePercent + '%';

  // 今日提示
  var tipText = '';
  if (pet.hunger < 20) {
    tipText = '宠物快饿坏了，快喂点东西吧！';
  } else if (pet.hunger < 40) {
    tipText = '宠物有点饿了，记得喂它哦~';
  } else if (gameState.checkin.todayCount === 0) {
    var nextStageName = '';
    var cs = getPetStage(pet.level);
    if (cs < PET_STAGES.length - 1) {
      nextStageName = PET_STAGES[cs + 1].name;
      tipText = '今天还没打卡哦！背首古诗离' + nextStageName + '更近一步！';
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

// ---- 渲染食物网格（喂食页面） ----
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

// ---- 喂食 ----
function feedPet(foodKey) {
  var food = FOODS[foodKey];
  if (!food) return;
  if (!gameState.inventory[foodKey] || gameState.inventory[foodKey] <= 0) {
    showToast('没有' + food.name + '了！');
    return;
  }

  // 检查宠物是否还能吃
  if (gameState.pet.hunger >= 100 && gameState.pet.happiness >= 100 && gameState.pet.health >= 100) {
    showToast('宠物现在不饿哦~');
    return;
  }

  // 扣除食物
  gameState.inventory[foodKey]--;

  // 喂食动画
  var petEl = document.getElementById('pet-emoji-big');
  petEl.classList.add('eating');

  // 飞行动画
  showFeedAnimation(food.emoji);

  setTimeout(function() {
    petEl.classList.remove('eating');
    petEl.classList.add('happy');
    setTimeout(function() {
      petEl.classList.remove('happy');
    }, 1500);
  }, 1000);

  // 增加属性
  gameState.pet.hunger = Math.min(100, gameState.pet.hunger + food.hunger);
  gameState.pet.happiness = Math.min(100, gameState.pet.happiness + food.happiness);
  gameState.pet.health = Math.min(100, gameState.pet.health + food.health);

  // 增加经验
  var oldLevel = gameState.pet.level;
  gameState.pet.exp += food.exp;
  checkLevelUp(oldLevel);

  showToast(food.name + ' +1，' + food.name + '真好吃！');
  saveGame();
  renderAll();
  checkAchievements();
}

// ---- 喂食飞行动画 ----
function showFeedAnimation(emoji) {
  var petEl = document.getElementById('pet-emoji-big');
  var petRect = petEl.getBoundingClientRect();
  var animEl = document.getElementById('feed-animation');
  animEl.textContent = emoji;
  animEl.style.left = (petRect.left + petRect.width / 2 - 16) + 'px';
  animEl.style.top = (petRect.top + 10) + 'px';
  animEl.classList.add('active');
  setTimeout(function() {
    animEl.classList.remove('active');
  }, 800);
}

// ---- 检查升级 ----
function checkLevelUp(oldLevel) {
  var leveled = false;
  while (gameState.pet.exp >= getExpNeeded()) {
    gameState.pet.exp -= getExpNeeded();
    gameState.pet.level++;
    leveled = true;
  }
  if (leveled) {
    // 检查是否进化
    var oldStage = getPetStage(oldLevel);
    var newStage = getPetStage(gameState.pet.level);
    if (newStage > oldStage) {
      // 进化动画
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

// ---- 进化弹窗 ----
function showEvolveModal(stageIndex) {
  var stage = PET_STAGES[stageIndex];
  document.getElementById('evolve-emoji').textContent = stage.emoji;
  document.getElementById('evolve-name').textContent = stage.name;
  document.getElementById('evolve-desc').textContent = stage.desc;
  openModal('evolve-modal');
  // 撒花效果
  createConfetti();
}

// ---- 撒花 ----
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

var currentMode = 'poem'; // 'poem' or 'story'
var currentReciteItem = null;
var currentQuizIndex = 0; // 当前测验题目索引
var quizPhase = 'reading'; // 'reading' | 'quiz'

function renderCheckinStatus() {
  document.getElementById('today-count').textContent = gameState.checkin.todayCount;
}

// ---- 渲染内容列表 ----
function renderContentList() {
  var list = document.getElementById('content-list');
  list.innerHTML = '';

  var data = currentMode === 'poem' ? POEMS : STORIES;

  data.forEach(function(item) {
    var isDone = false;
    if (currentMode === 'poem') {
      isDone = gameState.checkin.completedPoems.indexOf(item.id) !== -1;
    } else {
      isDone = gameState.checkin.completedStories.indexOf(item.id) !== -1;
    }

    var div = document.createElement('div');
    div.className = 'content-item' + (isDone ? ' done' : '');

    // 难度星级
    var dotsHtml = '';
    for (var d = 0; d < 3; d++) {
      dotsHtml += '<span class="difficulty-dot' + (d < item.difficulty ? ' active' : '') + '"></span>';
    }

    var meta = currentMode === 'poem'
      ? item.author + ' · ' + item.dynasty
      : '小故事';

    var rewardHint = getRewardForItem(item).name;

    div.innerHTML =
      '<div class="content-item-info">' +
        '<div class="content-item-title">' + item.title +
          '<span class="difficulty-dots">' + dotsHtml + '</span>' +
        '</div>' +
        '<div class="content-item-meta">' + meta + ' · 奖励: ' + rewardHint + '</div>' +
      '</div>' +
      '<div class="content-item-status ' + (isDone ? 'status-done' : 'status-pending') + '">' +
        (isDone ? '已背 ✓' : '去背') +
      '</div>';

    div.onclick = function() { openRecite(item); };
    list.appendChild(div);
  });
}

// ---- 获取奖励 ----
function getRewardForItem(item) {
  var baseReward;
  switch (item.difficulty) {
    case 1:
      baseReward = 'basic_food';
      break;
    case 2:
      baseReward = 'canned_food';
      break;
    case 3:
      baseReward = 'bone';
      break;
    default:
      baseReward = 'basic_food';
  }

  // 连续打卡奖励加成
  var streak = gameState.checkin.streak;
  var bonusReward = null;
  if (streak >= 14) {
    bonusReward = 'cake';
  } else if (streak >= 7) {
    bonusReward = 'bone';
  } else if (streak >= 3) {
    bonusReward = 'milk';
  }

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
  quizPhase = 'reading'; // 'reading' | 'quiz'
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

  // 奖励提示
  var rewardHtml = '🎁 完成后获得：' + FOODS[reward.base].emoji + ' ' + FOODS[reward.base].name;
  if (reward.bonus) {
    rewardHtml += ' + ' + FOODS[reward.bonus].emoji + ' ' + FOODS[reward.bonus].name;
  }

  html += '<div class="recite-reward-hint">' + rewardHtml + '</div>';

  if (isDone) {
    html += '<button class="recite-done-btn" disabled>✅ 已经背过啦</button>';
  } else {
    html += '<button class="recite-done-btn" onclick="startQuiz()">' +
      (currentMode === 'poem' ? '📝 我背好了，开始测试！' : '📖 我读完了，开始测试！') +
    '</button>';
  }

  card.innerHTML = html;
  switchPage('page-recite');
  // 滚动到顶部
  document.getElementById('content-area').scrollTop = 0;
}

// ---- 开始测验 ----
function startQuiz() {
  quizPhase = 'quiz';
  currentQuizIndex = 0;
  renderQuizQuestion();
}

// ---- 渲染测验题目 ----
function renderQuizQuestion() {
  if (!currentReciteItem || !currentReciteItem.quiz) return;
  var card = document.getElementById('recite-card');
  var quiz = currentReciteItem.quiz;
  var idx = currentQuizIndex;
  var total = quiz.length;
  var question = quiz[idx];

  var html = '<button class="recite-back-btn" onclick="openRecite(currentReciteItem)">← 返回阅读</button>';

  // 进度指示
  html += '<div class="quiz-progress">' +
    '<span class="quiz-progress-text">第 ' + (idx + 1) + ' / ' + total + ' 题</span>' +
    '<div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:' + (idx / total * 100) + '%"></div></div>' +
  '</div>';

  // 题目
  html += '<div class="quiz-question">' + question.q + '</div>';

  // 选项
  html += '<div class="quiz-options">';
  for (var i = 0; i < question.options.length; i++) {
    html += '<button class="quiz-option-btn" onclick="answerQuiz(' + i + ')">' +
      '<span class="quiz-option-label">' + String.fromCharCode(65 + i) + '</span>' +
      '<span class="quiz-option-text">' + question.options[i] + '</span>' +
    '</button>';
  }
  html += '</div>';

  // 反馈区域
  html += '<div class="quiz-feedback" id="quiz-feedback"></div>';

  card.innerHTML = html;
  document.getElementById('content-area').scrollTop = 0;
}

// ---- 回答测验题目 ----
function answerQuiz(selectedIndex) {
  var quiz = currentReciteItem.quiz;
  var question = quiz[currentQuizIndex];
  var feedbackEl = document.getElementById('quiz-feedback');

  if (selectedIndex === question.answer) {
    // 答对了
    feedbackEl.innerHTML = '<span class="quiz-correct">✅ 答对了！真棒！</span>';

    // 禁用所有按钮
    var btns = document.querySelectorAll('.quiz-option-btn');
    btns.forEach(function(b) { b.style.pointerEvents = 'none'; });

    // 标记正确选项
    btns[selectedIndex].classList.add('correct');

    setTimeout(function() {
      currentQuizIndex++;
      if (currentQuizIndex >= quiz.length) {
        // 全部答完
        completeCheckin();
      } else {
        renderQuizQuestion();
      }
    }, 1200);
  } else {
    // 答错了
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

  // 检查是否已完成
  var completedArr = isPoem ? gameState.checkin.completedPoems : gameState.checkin.completedStories;
  if (completedArr.indexOf(item.id) !== -1) {
    showToast('这首已经背过了哦~');
    return;
  }

  // 标记完成
  completedArr.push(item.id);

  // 判断是否今天第一次打卡（在递增之前）
  var isFirstCheckinToday = (gameState.checkin.todayCount === 0);

  // 更新打卡信息
  var today = getTodayStr();
  var prevLastCheckinDate = gameState.checkin.lastCheckinDate;
  gameState.checkin.todayCount++;
  gameState.checkin.lastCheckinDate = today;

  // 历史记录
  if (!gameState.checkin.history[today]) {
    gameState.checkin.history[today] = 0;
  }
  gameState.checkin.history[today]++;

  // 连续打卡：仅在每天第一次打卡时更新
  if (isFirstCheckinToday) {
    var yesterday = getYesterdayStr();
    if (prevLastCheckinDate === yesterday) {
      gameState.checkin.streak++;
    } else {
      gameState.checkin.streak = 1;
    }
  }

  // 更新最高连续
  if (gameState.checkin.streak > gameState.checkin.bestStreak) {
    gameState.checkin.bestStreak = gameState.checkin.streak;
  }

  // 更新统计
  gameState.stats.totalCheckins++;
  if (isPoem) {
    gameState.stats.poemsRecited++;
  } else {
    gameState.stats.storiesRead++;
  }

  // 发放奖励
  var reward = getRewardForItem(item);
  gameState.inventory[reward.base] = (gameState.inventory[reward.base] || 0) + 1;
  if (reward.bonus) {
    gameState.inventory[reward.bonus] = (gameState.inventory[reward.bonus] || 0) + 1;
  }

  // 保存并显示奖励
  saveGame();
  quizPhase = 'reading';
  currentQuizIndex = 0;
  switchPage('page-checkin');
  showRewardModal(reward);
  renderAll();
  checkAchievements();
}

// ---- 奖励弹窗 ----
function showRewardModal(reward) {
  var modal = document.getElementById('reward-modal');
  document.getElementById('reward-emoji').textContent = '🎉';
  document.getElementById('reward-title').textContent = '打卡成功！';

  var itemsHtml = '';
  itemsHtml +=
    '<div class="reward-item">' +
      FOODS[reward.base].emoji + ' ' + FOODS[reward.base].name + ' +1' +
    '</div>';
  if (reward.bonus) {
    itemsHtml +=
      '<div class="reward-item">' +
        '🔥 连续' + gameState.checkin.streak + '天加成！' +
        FOODS[reward.bonus].emoji + ' ' + FOODS[reward.bonus].name + ' +1' +
      '</div>';
  }
  itemsHtml +=
    '<div class="reward-item">' +
      '🔥 连续打卡 ' + gameState.checkin.streak + ' 天！' +
    '</div>';

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
      case 'petStage': value = getPetStage(gameState.pet.level); break;
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

// ---- 日历 ----
var calendarDate = new Date();

function renderCalendar() {
  var cal = document.getElementById('calendar');
  var year = calendarDate.getFullYear();
  var month = calendarDate.getMonth();

  var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

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
  var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  weekdays.forEach(function(w) {
    html += '<div class="cal-weekday">' + w + '</div>';
  });

  for (var i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var classes = 'cal-day';
    if (gameState.checkin.history[dateStr]) {
      classes += ' checked';
    }
    if (dateStr === today) {
      classes += ' today';
    }
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
  var pages = document.querySelectorAll('.page');
  pages.forEach(function(p) {
    p.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');

  // 切换页面时滚动到顶部
  var contentArea = document.getElementById('content-area');
  if (contentArea) {
    contentArea.scrollTop = 0;
  }

  // 更新导航栏
  var navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.getAttribute('data-page') === pageId) {
      btn.classList.add('active');
    }
  });

  // 页面特定渲染
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

// ---- 检测是否已安装(standalone模式) ----
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function init() {
  // 加载存档
  var hasSave = loadGame();

  // 检查新一天 + 时间衰减
  checkNewDay();

  // 检测是否已安装(standalone模式)
  var standalone = isStandalone();

  // 启动页按钮
  document.getElementById('start-btn').onclick = function() {
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    if (!hasSave) {
      // 首次进入，给新手礼包
      showToast('欢迎来到古诗小达人！送你3份狗粮和2瓶牛奶作为见面礼！', 3000);
    }
    renderAll();
  };

  // 如果已安装(APP模式)或有存档，直接跳过欢迎页
  if (standalone || hasSave) {
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    renderAll();
  }

  // 隐藏安装按钮(已安装时)
  if (standalone) {
    var installBtns = document.querySelectorAll('#install-btn, #install-btn-main');
    installBtns.forEach(function(btn) { btn.style.display = 'none'; });
    var guide = document.getElementById('install-guide');
    if (guide) guide.style.display = 'none';
  }

  // 底部导航
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.onclick = function() {
      switchPage(btn.getAttribute('data-page'));
    };
  });

  // 模式切换
  document.querySelectorAll('.mode-tab').forEach(function(tab) {
    tab.onclick = function() {
      document.querySelectorAll('.mode-tab').forEach(function(t) {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      currentMode = tab.getAttribute('data-mode');
      renderContentList();
    };
  });

  // 点击弹窗背景关闭
  document.querySelectorAll('.modal').forEach(function(modal) {
    modal.onclick = function(e) {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    };
  });

  // 定时检查属性衰减（每5分钟检查一次）
  setInterval(function() {
    checkTimeDecay();
    renderPet();
  }, 5 * 60 * 1000);

  renderAll();
}

// ---- 安装 PWA 提示 ----
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
  // 已安装则不显示
  if (isStandalone()) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  deferredInstallPrompt = e;
  // 欢迎页的安装按钮
  var installBtn = document.getElementById('install-btn');
  if (installBtn && document.getElementById('welcome-screen').classList.contains('active')) {
    installBtn.style.display = 'inline-flex';
  }
  // 档案页的安装按钮
  var installBtnMain = document.getElementById('install-btn-main');
  if (installBtnMain) {
    installBtnMain.style.display = 'inline-flex';
    var manualSteps = document.getElementById('install-manual-steps');
    if (manualSteps) manualSteps.style.display = 'none';
  }
});

// 监听安装完成事件
window.addEventListener('appinstalled', function() {
  var installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
  deferredInstallPrompt = null;
});

function installApp() {
  if (!deferredInstallPrompt) {
    showToast('请用浏览器菜单中的"添加到主屏幕"');
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(function(result) {
    if (result.outcome === 'accepted') {
      showToast('安装成功！到桌面找找看 🐶');
    }
    deferredInstallPrompt = null;
    var installBtns = document.querySelectorAll('#install-btn, #install-btn-main');
    installBtns.forEach(function(btn) { btn.style.display = 'none'; });
  });
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
