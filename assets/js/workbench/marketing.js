import { loadState, saveState } from "./store.js?v=5";

const STORAGE_KEY = "aaron-workbench:v2:marketing";
const FUNNEL_PATTERNS = {
  "local-service": {
    name: "Local service",
    stages: ["Reach", "Landing visits", "Enquiries", "Booked appointments", "Won jobs"],
    rates: [100, 12, 8, 35, 45]
  },
  agency: {
    name: "Agency / consultancy",
    stages: ["Target accounts", "Engaged accounts", "Discovery calls", "Proposals", "New clients"],
    rates: [100, 18, 25, 55, 35]
  },
  saas: {
    name: "SaaS",
    stages: ["Visitors", "Signups", "Activated users", "Engaged trials", "Paid accounts"],
    rates: [100, 7, 45, 55, 22]
  },
  ecommerce: {
    name: "Ecommerce",
    stages: ["Visitors", "Product views", "Added to cart", "Checkout started", "Purchases"],
    rates: [100, 55, 12, 48, 62]
  },
  creator: {
    name: "Course / creator",
    stages: ["Audience reached", "Lead magnet visits", "Email subscribers", "Sales page visits", "Purchases"],
    rates: [100, 10, 32, 25, 4]
  },
  recruitment: {
    name: "Recruitment",
    stages: ["People sourced", "Applications", "Screened candidates", "Interviews", "Hires"],
    rates: [100, 20, 55, 35, 25]
  }
};

const DEFAULT_STATE = {
  schemaVersion: 2,
  brief: {
    name: "",
    owner: "",
    objective: "",
    audience: "",
    offer: "",
    problem: "",
    promise: "",
    proof: "",
    cta: "",
    kpi: "",
    channels: "",
    budget: "",
    window: ""
  },
  funnel: {
    pattern: "local-service",
    audience: 1000,
    spend: 1000,
    currency: "USD",
    rates: {}
  }
};

const root = document.querySelector("#marketing-workspace");
if (root) {
  const state = loadState(STORAGE_KEY, DEFAULT_STATE);
  state.brief = { ...DEFAULT_STATE.brief, ...(state.brief || {}) };
  state.funnel = { ...DEFAULT_STATE.funnel, ...(state.funnel || {}), rates: { ...(state.funnel?.rates || {}) } };

  const utmForm = document.querySelector("#utm-form");
  const campaignForm = document.querySelector("#campaign-form");
  const funnelForm = document.querySelector("#funnel-form");
  const briefForm = document.querySelector("#campaign-brief-form");
  const patternSelect = document.querySelector("#funnel-pattern");
  const audienceInput = document.querySelector("#funnel-audience");
  const spendInput = document.querySelector("#funnel-spend");
  const currencyInput = document.querySelector("#funnel-currency");

  campaignForm.elements.date.value = new Date().toISOString().slice(0, 7);
  hydrateBrief();
  patternSelect.value = state.funnel.pattern;
  audienceInput.value = state.funnel.audience;
  spendInput.value = state.funnel.spend;
  currencyInput.value = state.funnel.currency;

  document.querySelectorAll("[data-marketing-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.marketingView));
  });
  utmForm.addEventListener("input", renderUtm);
  campaignForm.addEventListener("input", renderCampaign);
  funnelForm.addEventListener("input", renderFunnel);
  briefForm.addEventListener("input", () => {
    state.brief = Object.fromEntries(new FormData(briefForm));
    persist();
    renderBrief();
  });
  [patternSelect, audienceInput, spendInput, currencyInput].forEach((input) => {
    input.addEventListener("input", () => {
      state.funnel.pattern = patternSelect.value;
      state.funnel.audience = Number(audienceInput.value) || 0;
      state.funnel.spend = Number(spendInput.value) || 0;
      state.funnel.currency = currencyInput.value.trim().toUpperCase() || "USD";
      persist();
      renderFunnelPattern();
    });
  });
  patternSelect.addEventListener("change", () => {
    state.funnel.pattern = patternSelect.value;
    persist();
    renderFunnelPattern();
  });
  document.querySelector("#funnel-pattern-stages").addEventListener("input", (event) => {
    const index = Number(event.target.dataset.stageRate);
    if (!Number.isInteger(index)) return;
    const rates = currentRates();
    rates[index] = clamp(Number(event.target.value), 0, 100);
    state.funnel.rates[state.funnel.pattern] = rates;
    persist();
    renderFunnelPattern(false);
  });

  document.querySelector(".workbench-content").addEventListener("click", async (event) => {
    const outputId = event.target.closest("[data-copy]")?.dataset.copy;
    const action = event.target.closest("[data-marketing-action]")?.dataset.marketingAction;
    if (outputId) await copyOutput(outputId, event.target.closest("[data-copy]"));
    if (action === "download-brief") downloadText(document.querySelector("#campaign-brief-output").value, "campaign-brief.txt");
    if (action === "download-funnel") downloadText(document.querySelector("#funnel-pattern-output").value, `${state.funnel.pattern}-funnel-plan.txt`);
  });

  renderUtm();
  renderCampaign();
  renderFunnel();
  renderBrief();
  renderFunnelPattern();

  function switchView(view) {
    document.querySelectorAll("[data-marketing-view]").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.marketingView === view));
    });
    document.querySelectorAll("[data-marketing-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.marketingPanel !== view;
    });
  }

  function hydrateBrief() {
    Object.entries(state.brief).forEach(([name, value]) => {
      const field = briefForm.elements.namedItem(name);
      if (field) field.value = value;
    });
  }

  function persist() {
    const saved = saveState(STORAGE_KEY, state);
    document.querySelector("#campaign-brief-save").textContent = saved ? "Saved locally" : "Local save unavailable";
  }

  function renderUtm() {
    const data = Object.fromEntries(new FormData(utmForm));
    if (!data.url) {
      document.querySelector("#utm-output").value = "";
      return;
    }
    try {
      const url = new URL(data.url);
      ["source", "medium", "campaign", "term", "content"].forEach((key) => {
        if (data[key]) url.searchParams.set(`utm_${key}`, slug(data[key]));
      });
      document.querySelector("#utm-output").value = url.toString();
    } catch {
      document.querySelector("#utm-output").value = "Enter a complete URL including https://";
    }
  }

  function renderCampaign() {
    const data = Object.fromEntries(new FormData(campaignForm));
    document.querySelector("#campaign-output").textContent = [data.brand, data.offer, data.audience, data.channel, data.date]
      .filter(Boolean).map(slug).join("_");
  }

  function renderFunnel() {
    const data = Object.fromEntries(new FormData(funnelForm));
    const visitors = Number(data.visitors) || 0;
    const leads = Number(data.leads) || 0;
    const customers = Number(data.customers) || 0;
    const revenue = Number(data.revenue) || 0;
    const cost = Number(data.cost) || 0;
    const conversion = visitors ? customers / visitors * 100 : 0;
    const leadRate = visitors ? leads / visitors * 100 : 0;
    const cpa = customers ? cost / customers : 0;
    const roi = cost ? (revenue - cost) / cost * 100 : 0;
    document.querySelector("#funnel-output").innerHTML = [
      ["Lead rate", `${leadRate.toFixed(1)}%`],
      ["Conversion", `${conversion.toFixed(1)}%`],
      ["Cost / customer", `${data.currency} ${cpa.toFixed(2)}`],
      ["ROI", `${roi.toFixed(1)}%`]
    ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  }

  function renderBrief() {
    const data = state.brief;
    document.querySelector("#campaign-brief-output").value = [
      "CAMPAIGN BRIEF",
      `Campaign: ${data.name || "Untitled campaign"}`,
      data.owner ? `Owner: ${data.owner}` : null,
      data.window ? `Window: ${data.window}` : null,
      data.budget ? `Budget: ${data.budget}` : null,
      "",
      `Objective: ${data.objective || "Not defined"}`,
      `Primary KPI: ${data.kpi || "Not defined"}`,
      "",
      `Audience: ${data.audience || "Not defined"}`,
      `Offer: ${data.offer || "Not defined"}`,
      `Problem / tension: ${data.problem || "Not defined"}`,
      `Promise: ${data.promise || "Not defined"}`,
      `Proof: ${data.proof || "Not defined"}`,
      "",
      `Primary CTA: ${data.cta || "Not defined"}`,
      `Channels: ${data.channels || "Not defined"}`,
      "",
      "DECISION CHECK",
      "Does the offer solve the named problem for the named audience?",
      "Can the proof support the promise?",
      "Does the CTA match the campaign objective?"
    ].filter((line) => line !== null).join("\n");
  }

  function currentRates() {
    return [...(state.funnel.rates[state.funnel.pattern] || FUNNEL_PATTERNS[state.funnel.pattern].rates)];
  }

  function renderFunnelPattern(rebuildStages = true) {
    const pattern = FUNNEL_PATTERNS[state.funnel.pattern];
    const rates = currentRates();
    const volumes = [state.funnel.audience];
    for (let index = 1; index < pattern.stages.length; index += 1) {
      volumes[index] = volumes[index - 1] * rates[index] / 100;
    }

    if (rebuildStages) {
      document.querySelector("#funnel-pattern-stages").innerHTML = pattern.stages.map((stage, index) => `
        <article class="funnel-pattern-stage">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(stage)}</strong>
          <b>${formatVolume(volumes[index])}</b>
          ${index ? `<label><input data-stage-rate="${index}" type="number" min="0" max="100" step="0.1" value="${rates[index]}"><span>% from prior</span></label>` : `<small>Starting volume</small>`}
        </article>`).join("");
    } else {
      document.querySelectorAll(".funnel-pattern-stage>b").forEach((element, index) => {
        element.textContent = formatVolume(volumes[index]);
      });
    }

    const outcomes = volumes.at(-1) || 0;
    const overall = state.funnel.audience ? outcomes / state.funnel.audience * 100 : 0;
    const costPerOutcome = outcomes ? state.funnel.spend / outcomes : 0;
    const weakestIndex = rates.slice(1).reduce((weakest, rate, index, array) => rate < array[weakest] ? index : weakest, 0) + 1;
    document.querySelector("#funnel-pattern-metrics").innerHTML = [
      ["Expected outcomes", formatVolume(outcomes)],
      ["Overall conversion", `${overall.toFixed(2)}%`],
      ["Cost / outcome", `${state.funnel.currency} ${costPerOutcome.toFixed(2)}`],
      ["First constraint to inspect", pattern.stages[weakestIndex]]
    ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

    document.querySelector("#funnel-pattern-output").value = [
      `${pattern.name.toUpperCase()} FUNNEL PLAN`,
      `Starting audience: ${formatVolume(state.funnel.audience)}`,
      `Campaign spend: ${state.funnel.currency} ${state.funnel.spend.toFixed(2)}`,
      "",
      ...pattern.stages.map((stage, index) => index === 0
        ? `${index + 1}. ${stage}: ${formatVolume(volumes[index])}`
        : `${index + 1}. ${stage}: ${formatVolume(volumes[index])} (${rates[index]}% from prior stage)`),
      "",
      `Expected outcomes: ${formatVolume(outcomes)}`,
      `Overall conversion: ${overall.toFixed(2)}%`,
      `Estimated cost per outcome: ${state.funnel.currency} ${costPerOutcome.toFixed(2)}`,
      `First constraint to inspect: ${pattern.stages[weakestIndex]}`,
      "",
      "These are planning assumptions, not industry benchmarks. Replace them with observed data."
    ].join("\n");
  }

  async function copyOutput(outputId, button) {
    const output = document.querySelector(`#${outputId}`);
    const text = "value" in output ? output.value : output.textContent;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = original; }, 1600);
    } catch {
      if (output.select) output.select();
    }
  }
}

function downloadText(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatVolume(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
