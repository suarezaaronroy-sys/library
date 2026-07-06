import { loadState, saveState } from "./store.js?v=5";
import { escapeHtml } from "./utils.mjs?v=1";

const ZONES = [
  ["Asia/Manila", "Manila"],
  ["Europe/London", "London"],
  ["America/New_York", "New York"],
  ["America/Toronto", "Toronto"],
  ["Australia/Sydney", "Sydney"],
  ["UTC", "UTC"]
];
const KEY = "aaron-workbench:v2:scheduling";
const legacy = loadState("aaron-workbench:v1:scheduling", { countdowns: [] });
const state = loadState(KEY, {
  clockFormat: "24",
  countdowns: legacy.countdowns || [],
  stopwatch: { elapsed: 0, startedAt: null, running: false, laps: [] },
  timer: { duration: 1500000, remaining: 1500000, startedAt: null, running: false }
});
const root = document.querySelector("#scheduling-workspace");
let tickHandle;

if (root) {
  const clocks = document.querySelector("#world-clocks");
  const overlapForm = document.querySelector("#overlap-form");
  const countdownForm = document.querySelector("#countdown-form");
  const options = ZONES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  overlapForm.elements.zoneA.innerHTML = options;
  overlapForm.elements.zoneB.innerHTML = options;
  overlapForm.elements.zoneA.value = "Asia/Manila";
  overlapForm.elements.zoneB.value = "Europe/London";
  document.querySelector(`input[name="clockFormat"][value="${state.clockFormat}"]`).checked = true;
  hydrateTimerInputs();

  renderAll();
  tickHandle = window.setInterval(renderTick, 100);
  window.addEventListener("pagehide", persistRunningState);
  overlapForm.addEventListener("input", renderOverlap);
  root.addEventListener("change", (event) => {
    if (event.target.name === "clockFormat") {
      state.clockFormat = event.target.value;
      save();
      renderClocks();
    }
  });
  root.addEventListener("input", (event) => {
    if (event.target.closest(".timer-inputs")) syncTimerFromInputs();
  });
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-clock-action]")?.dataset.clockAction;
    if (action === "stopwatch-toggle") toggleStopwatch();
    if (action === "stopwatch-lap") addLap();
    if (action === "stopwatch-reset") resetStopwatch();
    if (action === "timer-toggle") toggleTimer();
    if (action === "timer-reset") resetTimer();
  });
  countdownForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(countdownForm));
    state.countdowns.push({ id: Date.now(), label: data.label.trim(), at: data.at });
    save();
    countdownForm.reset();
    renderCountdowns();
  });
  document.querySelector("#countdown-list").addEventListener("click", (event) => {
    const id = Number(event.target.closest("[data-delete-countdown]")?.dataset.deleteCountdown);
    if (!id) return;
    state.countdowns = state.countdowns.filter((item) => item.id !== id);
    save();
    renderCountdowns();
  });

  function renderAll() {
    renderClocks();
    renderOverlap();
    renderStopwatch();
    renderTimer();
    renderCountdowns();
  }

  function renderTick() {
    renderLocalClock();
    if (state.stopwatch.running) renderStopwatch();
    if (state.timer.running) renderTimer();
    if (Date.now() % 10000 < 150) {
      renderClocks();
      renderCountdowns();
    }
  }

  function renderLocalClock() {
    const now = new Date();
    document.querySelector("#local-clock-time").textContent = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: state.clockFormat === "12"
    }).format(now);
    document.querySelector("#local-clock-date").textContent = new Intl.DateTimeFormat("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(now);
    document.querySelector("#local-clock-zone").textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function renderClocks() {
    renderLocalClock();
    const now = new Date();
    const manilaDay = dayKey(now, "Asia/Manila");
    clocks.innerHTML = ZONES.slice(0, 5).map(([zone, label]) => {
      const hour = zoneHour(now, zone);
      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: state.clockFormat === "12"
      }).format(now);
      const date = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone, weekday: "short", day: "numeric", month: "short"
      }).format(now);
      const work = hour >= 9 && hour < 17;
      const dayShift = compareDay(dayKey(now, zone), manilaDay);
      return `<div class="clock">
        <span>${label}</span><strong>${time}</strong><small>${date} · ${dayShift}</small>
        <b class="${work ? "is-working" : ""}">${work ? "Working hours" : "Outside working hours"}</b>
      </div>`;
    }).join("");
  }

  function renderOverlap() {
    const data = Object.fromEntries(new FormData(overlapForm));
    const start = Number(data.start);
    const end = Number(data.end);
    const reference = new Date();
    reference.setUTCHours(0, 0, 0, 0);
    const shared = [];
    document.querySelector("#overlap-strip").innerHTML = Array.from({ length: 24 }, (_, utcHour) => {
      const point = new Date(reference.getTime() + utcHour * 3600000);
      const hourA = zoneHour(point, data.zoneA);
      const hourB = zoneHour(point, data.zoneB);
      const inA = hourA >= start && hourA < end;
      const inB = hourB >= start && hourB < end;
      if (inA && inB) shared.push(`${String(hourA).padStart(2, "0")}:00 / ${String(hourB).padStart(2, "0")}:00`);
      const className = inA && inB ? "is-both" : inA ? "is-a" : inB ? "is-b" : "";
      return `<i class="overlap-hour ${className}" title="${utcHour}:00 UTC"></i>`;
    }).join("");
    document.querySelector("#overlap-output").textContent = shared.length
      ? `Shared hours (A / B)\n${shared.join(" · ")}`
      : "No shared working hours in this window.";
  }

  function stopwatchElapsed() {
    return state.stopwatch.elapsed + (state.stopwatch.running ? Date.now() - state.stopwatch.startedAt : 0);
  }

  function toggleStopwatch() {
    if (state.stopwatch.running) {
      state.stopwatch.elapsed = stopwatchElapsed();
      state.stopwatch.startedAt = null;
      state.stopwatch.running = false;
    } else {
      state.stopwatch.startedAt = Date.now();
      state.stopwatch.running = true;
    }
    save();
    renderStopwatch();
  }

  function addLap() {
    const elapsed = stopwatchElapsed();
    if (!elapsed) return;
    state.stopwatch.laps.unshift({ id: Date.now(), elapsed });
    state.stopwatch.laps = state.stopwatch.laps.slice(0, 20);
    save();
    renderStopwatch();
  }

  function resetStopwatch() {
    state.stopwatch = { elapsed: 0, startedAt: null, running: false, laps: [] };
    save();
    renderStopwatch();
  }

  function renderStopwatch() {
    document.querySelector("#stopwatch-display").textContent = formatDuration(stopwatchElapsed(), true);
    document.querySelector("#stopwatch-toggle").textContent = state.stopwatch.running ? "Pause" : "Start";
    document.querySelector("#stopwatch-laps").innerHTML = state.stopwatch.laps.map((lap, index) =>
      `<div><span>Lap ${state.stopwatch.laps.length - index}</span><strong>${formatDuration(lap.elapsed, true)}</strong></div>`
    ).join("");
  }

  function timerRemaining() {
    if (!state.timer.running) return state.timer.remaining;
    return Math.max(0, state.timer.remaining - (Date.now() - state.timer.startedAt));
  }

  function toggleTimer() {
    if (state.timer.running) {
      state.timer.remaining = timerRemaining();
      state.timer.startedAt = null;
      state.timer.running = false;
    } else {
      if (state.timer.remaining <= 0) syncTimerFromInputs();
      state.timer.startedAt = Date.now();
      state.timer.running = state.timer.remaining > 0;
    }
    save();
    renderTimer();
  }

  function resetTimer() {
    state.timer.running = false;
    state.timer.startedAt = null;
    state.timer.remaining = state.timer.duration;
    save();
    renderTimer();
  }

  function syncTimerFromInputs() {
    const duration = (
      Number(document.querySelector("#timer-hours").value) * 3600 +
      Number(document.querySelector("#timer-minutes").value) * 60 +
      Number(document.querySelector("#timer-seconds").value)
    ) * 1000;
    state.timer.running = false;
    state.timer.startedAt = null;
    state.timer.duration = Math.max(0, duration);
    state.timer.remaining = state.timer.duration;
    save();
    renderTimer();
  }

  function hydrateTimerInputs() {
    const totalSeconds = Math.floor(state.timer.duration / 1000);
    document.querySelector("#timer-hours").value = Math.floor(totalSeconds / 3600);
    document.querySelector("#timer-minutes").value = Math.floor(totalSeconds % 3600 / 60);
    document.querySelector("#timer-seconds").value = totalSeconds % 60;
  }

  function renderTimer() {
    const remaining = timerRemaining();
    if (state.timer.running && remaining <= 0) {
      state.timer.running = false;
      state.timer.remaining = 0;
      state.timer.startedAt = null;
      save();
      document.querySelector("#timer-status").textContent = "Time is up.";
    } else {
      document.querySelector("#timer-status").textContent = state.timer.running ? "Timer running" : "";
    }
    document.querySelector("#timer-display").textContent = formatDuration(remaining, false);
    document.querySelector("#timer-toggle").textContent = state.timer.running ? "Pause" : "Start";
  }

  function renderCountdowns() {
    const now = Date.now();
    const list = [...state.countdowns].sort((a, b) => new Date(a.at) - new Date(b.at));
    document.querySelector("#countdown-list").innerHTML = list.length ? list.map((item) => {
      const remaining = new Date(item.at).getTime() - now;
      return `<article class="record"><div><strong>${escapeHtml(item.label)}</strong><p>${remainingLabel(remaining)}</p><time>${new Date(item.at).toLocaleString()}</time></div><button class="workbench-icon-button" type="button" data-delete-countdown="${item.id}" aria-label="Delete ${escapeHtml(item.label)}" title="Delete">×</button></article>`;
    }).join("") : `<p class="tool-intro">No saved countdowns yet.</p>`;
  }

  function persistRunningState() {
    if (state.stopwatch.running) {
      state.stopwatch.elapsed = stopwatchElapsed();
      state.stopwatch.startedAt = Date.now();
    }
    if (state.timer.running) {
      state.timer.remaining = timerRemaining();
      state.timer.startedAt = Date.now();
    }
    save();
  }

  function save() {
    saveState(KEY, state);
  }
}

function zoneHour(date, zone) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(date));
}

function dayKey(date, zone) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function compareDay(value, reference) {
  if (value === reference) return "same day";
  return value > reference ? "next day" : "previous day";
}

function formatDuration(milliseconds, tenths) {
  const safe = Math.max(0, milliseconds);
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor(safe % 3600000 / 60000);
  const seconds = Math.floor(safe % 60000 / 1000);
  const base = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return tenths ? `${base}.${Math.floor(safe % 1000 / 100)}` : base;
}

function remainingLabel(milliseconds) {
  if (milliseconds <= 0) return "Reached";
  const hours = Math.floor(milliseconds / 3600000);
  const days = Math.floor(hours / 24);
  return days ? `${days}d ${hours % 24}h remaining` : `${hours}h ${Math.floor((milliseconds % 3600000) / 60000)}m remaining`;
}

