import { loadState, saveState } from "./store.js";

const ZONES = [
  ["Asia/Manila", "Manila"],
  ["Europe/London", "London"],
  ["America/New_York", "New York"],
  ["America/Toronto", "Toronto"],
  ["Australia/Sydney", "Sydney"],
  ["UTC", "UTC"]
];
const KEY = "aaron-workbench:v1:scheduling";
const state = loadState(KEY, { countdowns: [] });
const root = document.querySelector("#scheduling-workspace");

if (root) {
  const clocks = document.querySelector("#world-clocks");
  const overlapForm = document.querySelector("#overlap-form");
  const countdownForm = document.querySelector("#countdown-form");
  const options = ZONES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  overlapForm.elements.zoneA.innerHTML = options;
  overlapForm.elements.zoneB.innerHTML = options;
  overlapForm.elements.zoneA.value = "Asia/Manila";
  overlapForm.elements.zoneB.value = "Europe/London";

  renderClocks();
  renderOverlap();
  renderCountdowns();
  window.setInterval(() => {
    renderClocks();
    renderCountdowns();
  }, 60000);

  overlapForm.addEventListener("input", renderOverlap);
  countdownForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(countdownForm));
    state.countdowns.push({ id: Date.now(), label: data.label.trim(), at: data.at });
    saveState(KEY, state);
    countdownForm.reset();
    renderCountdowns();
  });
  document.querySelector("#countdown-list").addEventListener("click", (event) => {
    const id = Number(event.target.closest("[data-delete-countdown]")?.dataset.deleteCountdown);
    if (!id) return;
    state.countdowns = state.countdowns.filter((item) => item.id !== id);
    saveState(KEY, state);
    renderCountdowns();
  });

  function renderClocks() {
    const now = new Date();
    clocks.innerHTML = ZONES.slice(0, 3).map(([zone, label]) => {
      const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const date = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short" }).format(now);
      return `<div class="clock"><span>${label}</span><strong>${time}</strong><small>${date}</small></div>`;
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

  function renderCountdowns() {
    const now = Date.now();
    const list = [...state.countdowns].sort((a, b) => new Date(a.at) - new Date(b.at));
    document.querySelector("#countdown-list").innerHTML = list.length ? list.map((item) => {
      const remaining = new Date(item.at).getTime() - now;
      return `<article class="record"><div><strong>${escapeHtml(item.label)}</strong><p>${remainingLabel(remaining)}</p><time>${new Date(item.at).toLocaleString()}</time></div><button class="workbench-icon-button" type="button" data-delete-countdown="${item.id}" aria-label="Delete ${escapeHtml(item.label)}" title="Delete">×</button></article>`;
    }).join("") : `<p class="tool-intro">No countdowns yet.</p>`;
  }
}

function zoneHour(date, zone) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(date));
}

function remainingLabel(milliseconds) {
  if (milliseconds <= 0) return "Reached";
  const hours = Math.floor(milliseconds / 3600000);
  const days = Math.floor(hours / 24);
  return days ? `${days}d ${hours % 24}h remaining` : `${hours}h ${Math.floor((milliseconds % 3600000) / 60000)}m remaining`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
