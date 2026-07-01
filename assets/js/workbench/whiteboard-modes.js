import { loadState, saveState } from "./store.js?v=4";

const PIPELINE_KEY = "aaron-workbench:v1:pipeline";
const AUTOMATION_KEY = "aaron-workbench:v1:automation-dry-run";
const PIPELINE_PATTERNS = {
  sales: ["Captured", "Qualified", "Proposal", "Decision", "Won"],
  delivery: ["Requested", "Scoped", "In progress", "Review", "Delivered"],
  hiring: ["Applied", "Screened", "Interview", "Offer", "Hired"],
  content: ["Idea", "Brief", "Production", "Approval", "Published"],
  support: ["New", "Triaged", "Working", "Waiting", "Resolved"]
};

const FLOW_LIBRARY = [
  flow("capture-form", "Capture", "Website form to CRM", "A visitor submits a form.", ["Validate required fields", "Normalize contact data", "Create or update contact", "Attach source and campaign", "Confirm receipt"], "Use one idempotency key so retries do not create duplicates.", "Invalid or duplicate contact data"),
  flow("capture-call", "Capture", "Missed call follow-up", "A tracked phone call is missed.", ["Match caller to a contact", "Create an inbound activity", "Send an acknowledgement", "Assign a callback owner", "Start response timer"], "Do not promise an exact callback time unless staffing supports it.", "Unknown caller or no available owner"),
  flow("capture-chat", "Capture", "Chat conversation intake", "A new chat starts.", ["Capture channel identity", "Ask minimum qualifying questions", "Create conversation record", "Tag intent", "Route by availability"], "Keep intake short enough that a human can take over quickly.", "Anonymous user leaves before identification"),
  flow("capture-import", "Capture", "List import with consent check", "A CSV list is uploaded.", ["Validate columns", "Check consent basis", "Deduplicate records", "Map source metadata", "Create import report"], "Quarantine uncertain consent instead of silently importing it.", "Missing consent or malformed rows"),
  flow("capture-booking", "Capture", "Booking creates opportunity", "A prospect books a meeting.", ["Verify contact details", "Create calendar activity", "Create opportunity", "Send preparation note", "Notify owner"], "Use the booking id as the stable external reference.", "Cancelled or rescheduled booking"),

  flow("qualify-score", "Qualify", "Lead scoring gate", "A contact reaches a scoring event.", ["Collect fit signals", "Apply score rules", "Record score reasons", "Choose qualified or nurture path", "Notify only on threshold crossing"], "Store why the score changed, not only the final number.", "Incomplete signals produce a false positive"),
  flow("qualify-budget", "Qualify", "Budget and authority check", "A discovery response is completed.", ["Read budget range", "Identify decision role", "Check timeline", "Flag constraints", "Route to next best action"], "Treat unknown as unknown; do not convert it into a negative.", "Sensitive answers exposed to the wrong audience"),
  flow("qualify-duplicate", "Qualify", "Duplicate opportunity check", "A new opportunity is proposed.", ["Search open opportunities", "Compare account and scope", "Select canonical record", "Merge context", "Close duplicate safely"], "Never merge automatically when ownership or value conflicts.", "Two legitimate projects look similar"),
  flow("qualify-risk", "Qualify", "Delivery risk screen", "A project request is submitted.", ["Check scope clarity", "Check capacity window", "Identify dependencies", "Score delivery risk", "Request missing information"], "Make risk factors visible to the person accepting the work.", "Risk score hides a hard blocker"),
  flow("qualify-spam", "Qualify", "Spam and abuse filter", "A new inbound record arrives.", ["Check known abuse signals", "Validate contact channel", "Rate-limit repeats", "Quarantine suspicious records", "Release verified records"], "Keep a review path for false positives.", "Legitimate high-volume source is blocked"),

  flow("route-territory", "Route", "Territory assignment", "A lead becomes qualified.", ["Resolve country and region", "Apply account ownership rules", "Check owner availability", "Assign owner", "Log routing reason"], "Resolve rule conflicts deterministically.", "Location data is missing or ambiguous"),
  flow("route-skill", "Route", "Skill-based support routing", "A case is triaged.", ["Classify issue", "Map required skill", "Check queue capacity", "Assign best queue", "Escalate if unaccepted"], "Capacity should influence routing, not only expertise.", "Classifier chooses the wrong specialty"),
  flow("route-round-robin", "Route", "Round-robin lead assignment", "A new eligible lead enters the pool.", ["Load eligible owners", "Exclude unavailable owners", "Read last assignment", "Assign next owner", "Persist rotation state"], "Lock rotation state during assignment to avoid collisions.", "Two events assign the same next owner"),
  flow("route-vip", "Route", "Priority account escalation", "A priority account creates an event.", ["Confirm priority status", "Identify account team", "Create high-priority task", "Notify escalation channel", "Start acknowledgement timer"], "Priority must be based on a maintained rule, not a stale tag.", "Every contact at the account triggers escalation"),
  flow("route-handoff", "Route", "Sales to delivery handoff", "An opportunity is marked won.", ["Freeze agreed scope", "Collect commercial context", "Create delivery record", "Assign delivery owner", "Confirm handoff acceptance"], "Require explicit acceptance instead of assuming the notification was read.", "Critical promise remains only in sales notes"),

  flow("nurture-welcome", "Nurture", "New lead welcome sequence", "A valid lead opts in.", ["Send welcome message", "Wait for engagement", "Share useful proof", "Branch on response", "Stop when a human replies"], "Every automated sequence needs a human-reply stop condition.", "Automation continues after direct conversation"),
  flow("nurture-no-show", "Nurture", "Meeting no-show recovery", "A meeting ends without attendance.", ["Confirm no-show status", "Send low-friction reschedule link", "Wait two business days", "Send one reminder", "Close or return to nurture"], "Limit reminders and preserve an easy opt-out.", "Calendar status incorrectly marks attendance"),
  flow("nurture-proposal", "Nurture", "Proposal follow-up", "A proposal is sent.", ["Record sent timestamp", "Schedule decision reminder", "Check opens or replies", "Prompt owner with context", "Stop on decision"], "Prompt the owner before sending increasingly direct messages.", "Proposal version changes after timer starts"),
  flow("nurture-content", "Nurture", "Interest-based content path", "A contact engages with a topic.", ["Record topic signal", "Update interest profile", "Select relevant resource", "Send within frequency cap", "Measure downstream action"], "Use explicit frequency caps across all campaigns.", "Multiple campaigns exceed the cap"),
  flow("nurture-reengage", "Nurture", "Dormant contact re-engagement", "A qualified contact is inactive for a set period.", ["Confirm no active opportunity", "Check communication permission", "Send useful re-entry message", "Branch on response", "Archive when inactive"], "Archive cleanly instead of nurturing forever.", "Recent activity exists outside the CRM"),

  flow("transact-invoice", "Transact", "Approved work to invoice", "Work is approved for billing.", ["Lock billable period", "Calculate approved amount", "Create invoice draft", "Request human review", "Send and record reference"], "A person should review money before the final send.", "Rate or exchange reference is stale"),
  flow("transact-payment", "Transact", "Payment confirmation", "A payment provider reports success.", ["Verify webhook signature", "Match invoice reference", "Record transaction", "Update balance", "Send receipt"], "Treat provider webhooks as the payment authority.", "Duplicate or delayed webhook"),
  flow("transact-failed", "Transact", "Failed payment recovery", "A payment attempt fails.", ["Classify failure reason", "Update payment status", "Notify payer safely", "Schedule retry when allowed", "Escalate repeated failure"], "Never expose sensitive processor details in customer messages.", "Permanent failure is retried repeatedly"),
  flow("transact-approval", "Transact", "Discount approval gate", "A quote exceeds the discount threshold.", ["Calculate discount impact", "Identify approver", "Create approval request", "Pause quote send", "Resume after recorded decision"], "Store the decision and its reason with the quote.", "Quote sends before approval returns"),
  flow("transact-contract", "Transact", "Signed agreement activation", "An agreement is signed.", ["Verify signer and version", "Store signed document", "Update commercial status", "Create onboarding tasks", "Notify responsible teams"], "Version identity matters as much as signature status.", "An obsolete version is signed"),

  flow("retain-onboard", "Retain", "Client onboarding sequence", "A contract becomes active.", ["Create onboarding checklist", "Collect required access", "Schedule kickoff", "Confirm owners", "Track readiness blockers"], "Do not mark onboarding complete while access blockers remain.", "Tasks complete without usable access"),
  flow("retain-health", "Retain", "Account health review", "A recurring review date arrives.", ["Collect usage and support signals", "Review open commitments", "Calculate health indicators", "Ask owner for judgement", "Record next action"], "Combine system signals with human judgement.", "A single metric misrepresents the relationship"),
  flow("retain-renewal", "Retain", "Renewal preparation", "A contract enters its renewal window.", ["Confirm contract dates", "Review delivered outcomes", "Identify open risks", "Prepare renewal options", "Schedule decision conversation"], "Start with outcomes and unresolved risks, not a generic reminder.", "Incorrect contract dates trigger too early"),
  flow("retain-feedback", "Retain", "Post-delivery feedback", "A deliverable is accepted.", ["Wait for initial use", "Request focused feedback", "Route negative signals", "Capture testimonial permission", "Close the loop with delivery"], "Ask specific questions tied to the delivered outcome.", "Negative feedback enters a marketing sequence"),
  flow("retain-offboard", "Retain", "Safe client offboarding", "A service ends.", ["Confirm final obligations", "Export client-owned data", "Revoke access", "Archive operating records", "Schedule appropriate follow-up"], "Access revocation needs an owner and verification step.", "Shared credentials remain active")
];

const pipelineRoot = document.querySelector("#pipeline-visualizer");
const automationRoot = document.querySelector("#automation-runner");
const viewButtons = document.querySelectorAll("[data-whiteboard-view]");

if (viewButtons.length) {
  viewButtons.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.whiteboardView)));
}

if (pipelineRoot) initPipeline();
if (automationRoot) initAutomation();

function switchView(view) {
  viewButtons.forEach((button) => button.setAttribute("aria-selected", String(button.dataset.whiteboardView === view)));
  document.querySelectorAll("[data-whiteboard-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.whiteboardPanel !== view;
  });
  if (view === "board") window.dispatchEvent(new CustomEvent("whiteboard:board-shown"));
}

function initPipeline() {
  let state = loadState(PIPELINE_KEY, createPipelineState("sales"));
  const form = document.querySelector("#pipeline-form");
  const template = document.querySelector("#pipeline-template");
  const board = document.querySelector("#pipeline-board");
  template.value = state.template;
  render();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    state.cards.push({
      id: `card-${Date.now()}`,
      title: values.title.trim(),
      owner: values.owner.trim(),
      value: Number(values.value) || 0,
      stageId: state.stages[0].id
    });
    form.reset();
    persist("Item added");
  });

  template.addEventListener("change", () => {
    state = createPipelineState(template.value);
    persist("Pattern changed");
  });

  pipelineRoot.addEventListener("click", (event) => {
    const action = event.target.closest("[data-pipeline-action]")?.dataset.pipelineAction;
    const deleteId = event.target.closest("[data-pipeline-delete]")?.dataset.pipelineDelete;
    if (action === "reset") {
      state = createPipelineState(template.value);
      persist("Pipeline reset");
    }
    if (deleteId) {
      state.cards = state.cards.filter((card) => card.id !== deleteId);
      persist("Item removed");
    }
  });

  board.addEventListener("change", (event) => {
    const cardId = event.target.dataset.cardStage;
    if (!cardId) return;
    const card = state.cards.find((item) => item.id === cardId);
    if (card) card.stageId = event.target.value;
    persist("Stage updated");
  });

  board.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-pipeline-card]");
    if (card) event.dataTransfer.setData("text/plain", card.dataset.pipelineCard);
  });
  board.addEventListener("dragover", (event) => {
    if (event.target.closest("[data-pipeline-stage]")) event.preventDefault();
  });
  board.addEventListener("drop", (event) => {
    const stage = event.target.closest("[data-pipeline-stage]");
    if (!stage) return;
    event.preventDefault();
    const card = state.cards.find((item) => item.id === event.dataTransfer.getData("text/plain"));
    if (card) card.stageId = stage.dataset.pipelineStage;
    persist("Item moved");
  });

  function persist(message) {
    saveState(PIPELINE_KEY, state);
    document.querySelector("#pipeline-status").textContent = `${message} - saved locally`;
    render();
  }

  function render() {
    const options = state.stages.map((stage) => `<option value="${stage.id}">${escapeHtml(stage.name)}</option>`).join("");
    board.innerHTML = state.stages.map((stage) => {
      const cards = state.cards.filter((card) => card.stageId === stage.id);
      const total = cards.reduce((sum, card) => sum + card.value, 0);
      return `<section class="pipeline-stage" data-pipeline-stage="${stage.id}">
        <header><span>${String(cards.length).padStart(2, "0")}</span><strong>${escapeHtml(stage.name)}</strong><small>${total ? numberMoney(total) : ""}</small></header>
        <div class="pipeline-card-list">${cards.map((card) => `
          <article class="pipeline-card" draggable="true" data-pipeline-card="${card.id}">
            <strong>${escapeHtml(card.title)}</strong>
            <small>${escapeHtml(card.owner || "Unassigned")}${card.value ? ` - ${numberMoney(card.value)}` : ""}</small>
            <div><select data-card-stage="${card.id}" aria-label="Move ${escapeHtml(card.title)}">${options.replace(`value="${card.stageId}"`, `value="${card.stageId}" selected`)}</select><button type="button" data-pipeline-delete="${card.id}" aria-label="Delete ${escapeHtml(card.title)}">x</button></div>
          </article>`).join("") || `<p>Drop an item here.</p>`}</div>
      </section>`;
    }).join("");
  }
}

function initAutomation() {
  let state = loadState(AUTOMATION_KEY, { selectedId: FLOW_LIBRARY[0].id, notes: {} });
  const library = document.querySelector("#automation-library");
  const detail = document.querySelector("#automation-detail");
  const search = document.querySelector("#automation-search");
  renderLibrary();
  renderDetail();

  search.addEventListener("input", renderLibrary);
  library.addEventListener("click", (event) => {
    const id = event.target.closest("[data-automation-flow]")?.dataset.automationFlow;
    if (!id) return;
    state.selectedId = id;
    saveState(AUTOMATION_KEY, state);
    renderLibrary();
    renderDetail();
  });
  detail.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-automation-action]")?.dataset.automationAction;
    const selected = FLOW_LIBRARY.find((item) => item.id === state.selectedId);
    if (action === "run") renderRun(selected);
    if (action === "copy") {
      const text = flowText(selected);
      try {
        await navigator.clipboard.writeText(text);
        document.querySelector("#automation-run-status").textContent = "Flow copied";
      } catch {
        document.querySelector("#automation-run-status").textContent = "Copy unavailable";
      }
    }
  });
  detail.addEventListener("input", (event) => {
    if (event.target.id !== "automation-notes") return;
    state.notes[state.selectedId] = event.target.value;
    saveState(AUTOMATION_KEY, state);
    document.querySelector("#automation-run-status").textContent = "Meeting note saved locally";
  });

  function renderLibrary() {
    const query = search.value.trim().toLowerCase();
    const matches = FLOW_LIBRARY.filter((item) => !query || [
      item.title, item.stage, item.trigger, item.best, item.failure, ...item.steps
    ].join(" ").toLowerCase().includes(query));
    library.innerHTML = ["Capture", "Qualify", "Route", "Nurture", "Transact", "Retain"].map((stage) => {
      const flows = matches.filter((item) => item.stage === stage);
      if (!flows.length) return "";
      return `<section><h3>${stage}<span>${String(flows.length).padStart(2, "0")}</span></h3>${flows.map((item) =>
        `<button type="button" data-automation-flow="${item.id}"${item.id === state.selectedId ? ' aria-current="true"' : ""}>${escapeHtml(item.title)}</button>`
      ).join("")}</section>`;
    }).join("") || `<p class="resource-empty">No flows match that search.</p>`;
  }

  function renderDetail() {
    const selected = FLOW_LIBRARY.find((item) => item.id === state.selectedId) || FLOW_LIBRARY[0];
    detail.innerHTML = `<div class="automation-detail-head"><span>${selected.stage}</span><h2>${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.trigger)}</p></div>
      <ol class="automation-steps">${selected.steps.map((step) => `<li><span></span><p>${escapeHtml(step)}</p></li>`).join("")}</ol>
      <div class="automation-guardrails">
        <div><span>Best practice</span><p>${escapeHtml(selected.best)}</p></div>
        <div><span>Failure to test</span><p>${escapeHtml(selected.failure)}</p></div>
      </div>
      <label class="workbench-field"><span>Meeting notes</span><textarea id="automation-notes" placeholder="What changed during the walkthrough?">${escapeHtml(state.notes[selected.id] || "")}</textarea></label>
      <div class="tool-actions"><button class="workbench-button primary" type="button" data-automation-action="run">Run dry test</button><button class="workbench-button" type="button" data-automation-action="copy">Copy flow</button></div>
      <output id="automation-run-status" class="tool-status" aria-live="polite">Ready to walk through</output>
      <div id="automation-run-output" class="automation-run-output"></div>`;
  }

  function renderRun(selected) {
    document.querySelector("#automation-run-output").innerHTML = [
      `Trigger accepted: ${selected.trigger}`,
      ...selected.steps.map((step, index) => `Step ${index + 1} passed: ${step}`),
      `Failure gate reviewed: ${selected.failure}`,
      `Dry run complete - no external actions were sent.`
    ].map((line, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(line)}</p></div>`).join("");
    document.querySelector("#automation-run-status").textContent = "Dry run complete";
  }
}

function createPipelineState(template) {
  return {
    schemaVersion: 1,
    template,
    stages: PIPELINE_PATTERNS[template].map((name, index) => ({ id: `stage-${index + 1}`, name })),
    cards: []
  };
}

function flow(id, stage, title, trigger, steps, best, failure) {
  return { id, stage, title, trigger, steps, best, failure };
}

function flowText(item) {
  return [
    item.title.toUpperCase(),
    `Stage: ${item.stage}`,
    `Trigger: ${item.trigger}`,
    "",
    ...item.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `Best practice: ${item.best}`,
    `Failure to test: ${item.failure}`
  ].join("\n");
}

function numberMoney(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
