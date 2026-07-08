(function () {
  const root = document.querySelector("[data-politician-tier]");
  if (!root) return;

  const profiles = [
    {
      id: "demo-rivera",
      name: "Mara Rivera",
      office: "Executive",
      jurisdiction: "City",
      party: "Independent",
      summary: "Strong delivery record on permits and budget transparency, with weaker depth on long-term housing implementation.",
      metrics: { record: 86, transparency: 82, consistency: 74, survey: 69, confidence: 78 },
      issues: { housing: 65, transport: 72, smallBusiness: 88, ethics: 84 },
      gaps: ["Housing outcomes need longer-term verification.", "Survey sample is local and recent but narrow."],
      sources: [
        source("City budget vote log", "Public record", "2026-03-12", 92, "Matched budget votes against published committee minutes."),
        source("Local business permit dashboard", "Public record", "2026-01-20", 84, "Permit processing time improved in the demo period."),
        source("Resident pulse survey", "Survey", "2026-05-04", 66, "Small sample, useful directionally but not decisive.")
      ]
    },
    {
      id: "demo-chen",
      name: "Elias Chen",
      office: "Legislative",
      jurisdiction: "State",
      party: "Civic Labor",
      summary: "High consistency and committee attendance, with a cautious record on disclosure and donor transparency.",
      metrics: { record: 79, transparency: 61, consistency: 88, survey: 74, confidence: 72 },
      issues: { housing: 78, transport: 83, smallBusiness: 62, ethics: 58 },
      gaps: ["Disclosure scoring depends on incomplete donor categorization.", "News review needs more outlets."],
      sources: [
        source("Committee attendance ledger", "Public record", "2026-02-08", 89, "Attendance and vote participation are consistently high."),
        source("State disclosure portal", "Public record", "2026-04-18", 58, "Disclosures exist but are hard to compare cleanly."),
        source("Transit bill reporting cluster", "News", "2026-05-11", 76, "Multiple outlets describe a clear transport policy role.")
      ]
    },
    {
      id: "demo-okafor",
      name: "Nadia Okafor",
      office: "Local",
      jurisdiction: "City",
      party: "Green Municipal",
      summary: "Very strong neighborhood trust signal, but the formal record is thin because the office has limited direct authority.",
      metrics: { record: 63, transparency: 77, consistency: 81, survey: 90, confidence: 69 },
      issues: { housing: 74, transport: 68, smallBusiness: 76, ethics: 80 },
      gaps: ["Office authority is limited, so impact attribution is noisy.", "Public record volume is low."],
      sources: [
        source("Neighborhood board minutes", "Public record", "2026-03-28", 70, "Regular meeting participation and clear public notes."),
        source("Community satisfaction survey", "Survey", "2026-05-22", 88, "Strong constituent trust in a narrow geography."),
        source("Local redevelopment article set", "News", "2026-04-02", 62, "Reporting is positive but mostly qualitative.")
      ]
    },
    {
      id: "demo-hale",
      name: "Victor Hale",
      office: "Executive",
      jurisdiction: "National",
      party: "Reform Bloc",
      summary: "Large national profile and strong survey reach, but record consistency varies sharply by issue area.",
      metrics: { record: 71, transparency: 68, consistency: 52, survey: 84, confidence: 74 },
      issues: { housing: 59, transport: 66, smallBusiness: 78, ethics: 62 },
      gaps: ["Issue positions shifted during the demo timeline.", "Survey signal is broad but polarized."],
      sources: [
        source("National vote alignment index", "Public record", "2026-01-16", 70, "Mixed alignment between stated priorities and votes."),
        source("Disclosure summary", "Public record", "2026-02-27", 68, "Baseline compliance, limited explanatory detail."),
        source("National favorability tracker", "Survey", "2026-05-30", 81, "Large sample, strong reach, high polarization.")
      ]
    },
    {
      id: "demo-santos",
      name: "Irene Santos",
      office: "Legislative",
      jurisdiction: "National",
      party: "People First",
      summary: "Strong ethics score and transparent documentation, with weaker delivery evidence because several policies are still pending.",
      metrics: { record: 67, transparency: 91, consistency: 84, survey: 72, confidence: 82 },
      issues: { housing: 82, transport: 61, smallBusiness: 70, ethics: 94 },
      gaps: ["Policy delivery still pending; current score leans on process quality.", "Needs post-implementation outcome review."],
      sources: [
        source("Public disclosure archive", "Public record", "2026-04-09", 95, "Clear disclosures, readable amendments, strong date trail."),
        source("Ethics committee transcript", "Public record", "2026-05-02", 88, "Consistent process language and public reasoning."),
        source("Housing reform explainer set", "News", "2026-05-19", 73, "Cited policy role, outcomes not yet measurable.")
      ]
    },
    {
      id: "demo-brooks",
      name: "Jonah Brooks",
      office: "Local",
      jurisdiction: "State",
      party: "County Alliance",
      summary: "Useful administrative record, but confidence is low because several source categories are missing.",
      metrics: { record: 58, transparency: 55, consistency: 64, survey: 60, confidence: 49 },
      issues: { housing: 54, transport: 57, smallBusiness: 66, ethics: 51 },
      gaps: ["Missing survey recency.", "Few independent news sources.", "Public records are fragmented."],
      sources: [
        source("County meeting archive", "Public record", "2026-02-03", 59, "Some records are available, but formatting is inconsistent."),
        source("Procurement notice review", "Public record", "2026-03-14", 53, "Procurement trail exists but lacks explanatory notes."),
        source("Regional newsletter mentions", "News", "2026-04-21", 45, "Low source diversity; not enough for high confidence.")
      ]
    }
  ];

  const tiers = ["S", "A", "B", "C", "Review"];
  const state = {
    selected: new Set(["demo-rivera", "demo-santos"]),
    active: "demo-rivera"
  };

  const els = {
    search: document.querySelector("#pt-search"),
    jurisdiction: document.querySelector("#pt-jurisdiction"),
    office: document.querySelector("#pt-office"),
    sort: document.querySelector("#pt-sort"),
    reset: document.querySelector("#pt-reset"),
    board: document.querySelector("#pt-tier-board"),
    summary: document.querySelector("#pt-summary-strip"),
    compare: document.querySelector("#pt-compare-list"),
    detail: document.querySelector("#pt-detail"),
    fitProfile: document.querySelector("#pt-fit-profile"),
    fitIssue: document.querySelector("#pt-fit-issue"),
    fitResult: document.querySelector("#pt-fit-result"),
    weights: {
      record: document.querySelector("#pt-weight-record"),
      transparency: document.querySelector("#pt-weight-transparency"),
      consistency: document.querySelector("#pt-weight-consistency"),
      survey: document.querySelector("#pt-weight-survey")
    }
  };

  Object.values(els.weights).forEach((input) => input.addEventListener("input", render));
  [els.search, els.jurisdiction, els.office, els.sort].forEach((input) => input.addEventListener("input", render));
  els.reset.addEventListener("click", () => {
    els.weights.record.value = 30;
    els.weights.transparency.value = 25;
    els.weights.consistency.value = 20;
    els.weights.survey.value = 25;
    els.sort.value = "score";
    render();
  });
  els.board.addEventListener("click", onBoardClick);
  els.fitProfile.addEventListener("change", renderFit);
  els.fitIssue.addEventListener("change", renderFit);

  populateFitProfiles();
  render();

  function source(title, type, date, confidence, note) {
    return { title, type, date, confidence, note };
  }

  function getWeights() {
    const raw = {
      record: Number(els.weights.record.value),
      transparency: Number(els.weights.transparency.value),
      consistency: Number(els.weights.consistency.value),
      survey: Number(els.weights.survey.value)
    };
    const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total]));
  }

  function scoredProfiles() {
    const weights = getWeights();
    const query = els.search.value.trim().toLowerCase();
    return profiles
      .map((profile) => ({ ...profile, score: score(profile, weights), tier: tierFor(profile, weights) }))
      .filter((profile) => els.jurisdiction.value === "all" || profile.jurisdiction === els.jurisdiction.value)
      .filter((profile) => els.office.value === "all" || profile.office === els.office.value)
      .filter((profile) => {
        if (!query) return true;
        const haystack = [
          profile.name,
          profile.office,
          profile.jurisdiction,
          profile.party,
          profile.summary,
          profile.gaps.join(" "),
          profile.sources.map((item) => `${item.title} ${item.type} ${item.note}`).join(" ")
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .sort(sorter());
  }

  function score(profile, weights) {
    const m = profile.metrics;
    const raw =
      m.record * weights.record +
      m.transparency * weights.transparency +
      m.consistency * weights.consistency +
      m.survey * weights.survey;
    return Math.round(raw * (0.72 + (m.confidence / 100) * 0.28));
  }

  function tierFor(profile, weights) {
    const value = score(profile, weights);
    if (profile.metrics.confidence < 55) return "Review";
    if (value >= 82) return "S";
    if (value >= 74) return "A";
    if (value >= 64) return "B";
    return "C";
  }

  function sorter() {
    const key = els.sort.value;
    return (a, b) => {
      if (key === "score") return b.score - a.score;
      return b.metrics[key] - a.metrics[key];
    };
  }

  function render() {
    syncWeightLabels();
    const list = scoredProfiles();
    renderSummary(list);
    renderBoard(list);
    renderCompare(list);
    renderDetail(list);
    renderFit();
  }

  function syncWeightLabels() {
    Object.entries(els.weights).forEach(([key, input]) => {
      const value = document.querySelector(`[data-weight-value="${key}"]`);
      if (value) value.textContent = input.value;
    });
  }

  function renderSummary(list) {
    const avgConfidence = list.length
      ? Math.round(list.reduce((sum, item) => sum + item.metrics.confidence, 0) / list.length)
      : 0;
    const top = list[0];
    const reviewCount = list.filter((item) => item.tier === "Review").length;
    els.summary.innerHTML = [
      stat(list.length, "profiles in view"),
      stat(top ? top.score : 0, "top adjusted score"),
      stat(`${avgConfidence}%`, "avg confidence"),
      stat(reviewCount, "needs review")
    ].join("");
  }

  function stat(value, label) {
    return `<div><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
  }

  function renderBoard(list) {
    const grouped = Object.fromEntries(tiers.map((tier) => [tier, []]));
    list.forEach((profile) => grouped[profile.tier].push(profile));
    els.board.innerHTML = tiers.map((tier) => `
      <section class="pt-tier-row" aria-label="${tier} tier">
        <div class="pt-tier-label" data-tier="${tier}">${escapeHtml(tier)}</div>
        <div class="pt-card-grid">
          ${grouped[tier].length ? grouped[tier].map(renderCard).join("") : `<p class="pt-card pt-empty-card">No profiles in this tier under the current model.</p>`}
        </div>
      </section>
    `).join("");
  }

  function renderCard(profile) {
    return `
      <button class="pt-card${profile.id === state.active ? " is-selected" : ""}" type="button" data-profile="${profile.id}">
        <div>
          <h3>${escapeHtml(profile.name)}</h3>
          <small>${escapeHtml(profile.jurisdiction)} / ${escapeHtml(profile.office)} / ${escapeHtml(profile.party)}</small>
        </div>
        <strong class="pt-score">${profile.score}</strong>
        <p>${escapeHtml(profile.summary)}</p>
        <div class="pt-card-metrics">
          <span>REC ${profile.metrics.record}</span>
          <span>TRN ${profile.metrics.transparency}</span>
          <span>CON ${profile.metrics.consistency}</span>
          <span>SRV ${profile.metrics.survey}</span>
        </div>
      </button>
    `;
  }

  function onBoardClick(event) {
    const button = event.target.closest("[data-profile]");
    if (!button) return;
    const id = button.dataset.profile;
    state.active = id;
    if (state.selected.has(id)) {
      if (state.selected.size > 1) state.selected.delete(id);
    } else {
      if (state.selected.size >= 3) state.selected.delete([...state.selected][0]);
      state.selected.add(id);
    }
    render();
  }

  function renderCompare(list) {
    const scored = new Map(list.map((item) => [item.id, item]));
    const selected = [...state.selected]
      .map((id) => scored.get(id) || profiles.find((profile) => profile.id === id))
      .filter(Boolean)
      .map((profile) => ({ ...profile, score: profile.score || score(profile, getWeights()), tier: profile.tier || tierFor(profile, getWeights()) }));

    if (!selected.length) {
      els.compare.innerHTML = `<p class="pt-empty-detail">Select up to three profiles from the tier board.</p>`;
      return;
    }

    els.compare.innerHTML = selected.map((profile) => `
      <div class="pt-compare-item">
        <h3>${escapeHtml(profile.name)}</h3>
        <strong>${profile.tier} / ${profile.score}</strong>
        <p>${escapeHtml(profile.summary)}</p>
      </div>
    `).join("");
  }

  function renderDetail(list) {
    const active = list.find((profile) => profile.id === state.active) || list[0] || profiles.find((profile) => profile.id === state.active);
    if (!active) {
      els.detail.innerHTML = `
        <div class="pt-empty-detail">
          <span>No matching profile</span>
          <p>Adjust the filters to bring profiles back into the evidence drawer.</p>
        </div>
      `;
      return;
    }
    const profile = { ...active, score: active.score || score(active, getWeights()), tier: active.tier || tierFor(active, getWeights()) };
    els.detail.innerHTML = `
      <span class="pt-eyebrow">Evidence drawer</span>
      <h2>${escapeHtml(profile.name)}</h2>
      <div class="pt-detail-meta">${escapeHtml(profile.jurisdiction)} / ${escapeHtml(profile.office)} / Tier ${escapeHtml(profile.tier)} / Score ${profile.score}</div>
      <div class="pt-detail-grid">
        <div><b>${profile.metrics.record}</b><span>record</span></div>
        <div><b>${profile.metrics.transparency}</b><span>transparency</span></div>
        <div><b>${profile.metrics.consistency}</b><span>consistency</span></div>
        <div><b>${profile.metrics.confidence}</b><span>confidence</span></div>
      </div>
      <div class="pt-source-list">
        ${profile.sources.map((item) => `
          <article class="pt-source">
            <b>${escapeHtml(item.title)}</b>
            <span>${escapeHtml(item.type)} / ${escapeHtml(item.date)} / confidence ${item.confidence}%</span>
            <p>${escapeHtml(item.note)}</p>
          </article>
        `).join("")}
        <article class="pt-source">
          <b>Known gaps</b>
          <small>What would lower confidence in production</small>
          <p>${escapeHtml(profile.gaps.join(" "))}</p>
        </article>
      </div>
    `;
  }

  function populateFitProfiles() {
    els.fitProfile.innerHTML = profiles.map((profile) => `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`).join("");
  }

  function renderFit() {
    const profile = profiles.find((item) => item.id === els.fitProfile.value) || profiles[0];
    const issue = els.fitIssue.value;
    const issueScore = profile.issues[issue] || 0;
    const readiness = Math.round((issueScore * 0.62) + (profile.metrics.confidence * 0.38));
    const bottleneck = bottleneckFor(profile, issue);
    els.fitResult.innerHTML = `
      <b>${escapeHtml(profile.name)} / ${readiness}% fit</b>
      <p>${escapeHtml(bottleneck)}</p>
    `;
  }

  function bottleneckFor(profile, issue) {
    const labels = {
      housing: "Housing fit depends on delivery evidence, not just stated platform language.",
      transport: "Transport fit is capped when record consistency and implementation authority are unclear.",
      smallBusiness: "Small business fit improves when permit, tax, and local service records are visible.",
      ethics: "Ethics fit is limited by disclosure quality, recency, and independent corroboration."
    };
    const weakest = Object.entries(profile.metrics).sort((a, b) => a[1] - b[1])[0];
    return `${labels[issue]} Current bottleneck: ${weakest[0]} is the weakest scored dimension at ${weakest[1]}.`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }
})();
