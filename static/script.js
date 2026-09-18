const $ = id => document.getElementById(id);

const config = { work: 25, short: 5, long: 15, cycles: 4 };


const state = {
  phase: 'work',      // work | short | long
  remaining: 25 * 60,
  total: 25 * 60,
  completedCycles: 0,
  running: false,
  endTime: 0,
  timerId: null,
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 100; 
const phaseNames = {
  work: 'Работа',
  short: 'Короткий отдых',
  long: 'Длинный отдых',
};

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('pomodoro-config') || 'null');
    if (saved && typeof saved === 'object') Object.assign(config, saved);
  } catch (_) {}
}

function saveConfig() {
  localStorage.setItem('pomodoro-config', JSON.stringify(config));
}

function applyConfigToInputs() {
  $('workTime').value  = config.work;
  $('shortBreak').value = config.short;
  $('longBreak').value  = config.long;
  $('cycles').value    = config.cycles;
}


function readConfigFromInputs() {
  const clamp = (v, min, max, def) => {
    v = parseInt(v, 10);
    if (isNaN(v)) v = def;
    return Math.max(min, Math.min(max, v));
  };
  config.work   = clamp($('workTime').value,   1, 180, 25);
  config.short  = clamp($('shortBreak').value, 1, 60,   5);
  config.long   = clamp($('longBreak').value,  1, 120, 15);
  config.cycles = clamp($('cycles').value,     1, 12,   4);
  saveConfig();

  if (!state.running && state.remaining === state.total) {
    const sec = phaseDuration(state.phase);
    state.total = sec;
    state.remaining = sec;
  }
  render();
}

function phaseDuration(phase) {
  switch (phase) {
    case 'work':  return config.work * 60;
    case 'short': return config.short * 60;
    case 'long':  return config.long * 60;
  }
  return config.work * 60;
}

function setPhase(phase) {
  state.phase = phase;
  const sec = phaseDuration(phase);
  state.total = sec;
  state.remaining = sec;
  render();
}

function start() {
  if (state.running) return;
  if (state.remaining <= 0) setPhase(state.phase); // подстрахов04ка

  state.running = true;
  state.endTime = Date.now() + state.remaining * 1000;
  state.timerId = setInterval(tick, 200);
  setInputsDisabled(true);
  render();
}


function pause() {
  if (!state.running) return;
  state.running = false;
  clearInterval(state.timerId);
  state.timerId = null;
  state.remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
  render();
}

function reset() {
  state.running = false;
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  state.completedCycles = 0;
  setPhase('work');
  setInputsDisabled(false);
  render();
}

function tick() {
  if (!state.running) return;
  const ms = state.endTime - Date.now();
  state.remaining = Math.max(0, Math.ceil(ms / 1000));
  render();

  if (ms <= 0) {
    clearInterval(state.timerId);
    state.timerId = null;
    onPhaseEnd();
  }
}


function onPhaseEnd() {
  state.running = false;
  playSound(state.phase);

  let next;
  if (state.phase === 'work') {
    state.completedCycles++;
    next = (state.completedCycles % config.cycles === 0) ? 'long' : 'short';
  } else {
    if (state.phase === 'long') state.completedCycles = 0;
    next = 'work';
  }
  setPhase(next);
  setInputsDisabled(false);
  render();
}

function setInputsDisabled(disabled) {
  ['workTime', 'shortBreak', 'longBreak', 'cycles'].forEach(id => {
    $(id).disabled = disabled;
  });
}

// ---------- Sound ----------
function playSound(phase) {
  let src;
  if (phase === 'work')       src = '/sounds/work_end.wav';
  else if (phase === 'short') src = '/sounds/break_end.wav';
  else                        src = '/sounds/long_break_end.wav';

  const audio = new Audio(src);
  audio.volume = 0.7;
  audio.play().catch(err => console.warn('Не удалось воспроизвести звук:', err));
}

// ---------- Rendering ----------
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}


function render() {
  document.body.dataset.phase = state.phase;
  $('phase').textContent = phaseNames[state.phase];
  $('time').textContent = formatTime(state.remaining);
  $('cycleInfo').textContent = `Цикл ${state.completedCycles} / ${config.cycles}`;

  const progress = state.total > 0 ? state.remaining / state.total : 1;
  const bar = document.querySelector('.ring-fg');
  bar.style.strokeDasharray = RING_CIRCUMFERENCE;
  bar.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  // Кнопки
  $('startBtn').disabled = state.running;
  $('pauseBtn').disabled = !state.running;

  if (state.running) {
    $('startBtn').textContent = 'Идёт…';
  } else if (state.remaining === state.total) {
    // Фаза ещё не начиналась — показываем явное действие
    $('startBtn').textContent =
      state.phase === 'work'  ? 'Начать работу' :
      state.phase === 'short' ? 'Начать отдых'  :
                                'Начать длинный отдых';
  } else {
    $('startBtn').textContent = 'Продолжить';
  }

  // Заголовок окна
  if (state.running || state.remaining < state.total) {
    document.title = `${formatTime(state.remaining)} — ${phaseNames[state.phase]}`;
  } else {
    document.title = 'Pomodoro';
  }
}

// ---------- Init ----------
function init() {
  loadConfig();
  applyConfigToInputs();

  ['workTime', 'shortBreak', 'longBreak', 'cycles'].forEach(id => {
    $(id).addEventListener('change', readConfigFromInputs);
    $(id).addEventListener('input', readConfigFromInputs);
  });

  $('startBtn').addEventListener('click', start);
  $('pauseBtn').addEventListener('click', pause);
  $('resetBtn').addEventListener('click', reset);

  // Пробел — старт/пауза
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      state.running ? pause() : start();
    }
  });

  setPhase('work');
  setInputsDisabled(false);
  render();
}

init();