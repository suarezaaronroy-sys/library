const root = document.querySelector("#marketing-workspace");

if (root) {
  const utmForm = document.querySelector("#utm-form");
  const campaignForm = document.querySelector("#campaign-form");
  const funnelForm = document.querySelector("#funnel-form");
  campaignForm.elements.date.value = new Date().toISOString().slice(0, 7);
  utmForm.addEventListener("input", renderUtm);
  campaignForm.addEventListener("input", renderCampaign);
  funnelForm.addEventListener("input", renderFunnel);
  root.addEventListener("click", async (event) => {
    const outputId = event.target.closest("[data-copy]")?.dataset.copy;
    if (!outputId) return;
    const output = document.querySelector(`#${outputId}`);
    const text = "value" in output ? output.value : output.textContent;
    try {
      await navigator.clipboard.writeText(text);
      event.target.textContent = "Copied";
      window.setTimeout(() => { event.target.textContent = outputId === "utm-output" ? "Copy URL" : "Copy name"; }, 1600);
    } catch {
      if (output.select) output.select();
    }
  });
  renderUtm();
  renderCampaign();
  renderFunnel();

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
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
