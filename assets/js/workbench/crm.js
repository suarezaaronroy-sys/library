const root = document.querySelector("#crm-workspace");

if (root) {
  const pipelineForm = document.querySelector("#pipeline-form");
  pipelineForm.addEventListener("input", renderPipeline);
  ["regex-pattern", "regex-flags", "regex-text"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", renderRegex));
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "format-json") formatJson(2);
    if (action === "minify-json") formatJson(0);
  });
  document.querySelector("#request-form").addEventListener("submit", sendRequest);
  renderPipeline();
  renderRegex();

  function renderPipeline() {
    const data = Object.fromEntries(new FormData(pipelineForm));
    const leads = Number(data.leads) || 0;
    const qualified = Number(data.qualified) || 0;
    const won = Number(data.won) || 0;
    const value = Number(data.value) || 0;
    const metrics = [
      ["Lead → qualified", `${leads ? qualified / leads * 100 : 0}%`],
      ["Qualified → won", `${qualified ? won / qualified * 100 : 0}%`],
      ["Overall win rate", `${leads ? won / leads * 100 : 0}%`],
      ["Won value", `${data.currency} ${(won * value).toLocaleString()}`]
    ];
    document.querySelector("#pipeline-output").innerHTML = metrics.map(([label, valueText]) =>
      `<div><span>${label}</span><strong>${valueText.includes("%") ? `${Number.parseFloat(valueText).toFixed(1)}%` : valueText}</strong></div>`
    ).join("");
  }
  function formatJson(spaces) {
    try {
      document.querySelector("#json-output").value = JSON.stringify(JSON.parse(document.querySelector("#json-input").value), null, spaces);
      document.querySelector("#json-status").textContent = "Valid JSON.";
    } catch (error) {
      document.querySelector("#json-output").value = "";
      document.querySelector("#json-status").textContent = error.message;
    }
  }
  function renderRegex() {
    const pattern = document.querySelector("#regex-pattern").value;
    const flags = document.querySelector("#regex-flags").value;
    const text = document.querySelector("#regex-text").value;
    if (!pattern) {
      document.querySelector("#regex-output").textContent = "Enter a pattern.";
      return;
    }
    try {
      const regex = new RegExp(pattern, flags);
      const matches = flags.includes("g") ? [...text.matchAll(regex)].map((item) => item[0]) : [text.match(regex)?.[0]].filter(Boolean);
      document.querySelector("#regex-output").textContent = matches.length ? `${matches.length} match(es)\n${matches.join("\n")}` : "No matches.";
    } catch (error) {
      document.querySelector("#regex-output").textContent = error.message;
    }
  }
  async function sendRequest(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const output = document.querySelector("#request-output");
    output.textContent = "Sending...";
    try {
      const options = { method: data.method, headers: { Accept: "application/json" } };
      if (!["GET", "DELETE"].includes(data.method) && data.body) {
        JSON.parse(data.body);
        options.headers["Content-Type"] = "application/json";
        options.body = data.body;
      }
      const response = await fetch(data.url, options);
      const text = await response.text();
      output.textContent = `${response.status} ${response.statusText}\n\n${text.slice(0, 5000)}`;
    } catch (error) {
      output.textContent = `Request failed\n${error.message}`;
    }
  }
}
