const root = document.querySelector("#library-tools-workspace");

if (root) {
  const form = document.querySelector("#scaffold-form");
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  form.addEventListener("input", render);
  document.querySelector("#related-input").addEventListener("input", renderRelated);
  root.addEventListener("click", async (event) => {
    const id = event.target.closest("[data-copy]")?.dataset.copy;
    if (!id) return;
    const output = document.querySelector(`#${id}`);
    try {
      await navigator.clipboard.writeText(output.value);
      event.target.textContent = "Copied";
      window.setTimeout(() => { event.target.textContent = id === "scaffold-output" ? "Copy scaffold" : "Copy markup"; }, 1500);
    } catch {
      output.select();
    }
  });
  render();
  renderRelated();

  function render() {
    const data = Object.fromEntries(new FormData(form));
    const slug = slugify(data.title);
    const tags = data.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const output = data.type === "grimoire"
      ? `---\nlayout: grimoire\ntitle: "${quote(data.title)}"\ndescription: "${quote(data.description)}"\nnumber: ${String(data.number).padStart(3, "0")}\nslug: ${slug}\ntags: [${tags.map((tag) => `"${quote(tag)}"`).join(", ")}]\n---\n\n# ${data.title || "Untitled"}\n\n`
      : `---\nlayout: note\ntitle: "${quote(data.title)}"\ndescription: "${quote(data.description)}"\ndate: ${data.date}\ntags: [${tags.map((tag) => `"${quote(tag)}"`).join(", ")}]\n---\n\n# ${data.title || "Untitled"}\n\n`;
    document.querySelector("#scaffold-output").value = output;
    document.querySelector("#metadata-output").innerHTML = `<h3>${escapeHtml(data.title || "Untitled")}</h3><p>${escapeHtml(data.description || "Add a concise description.")}</p><p><strong>Slug:</strong> ${escapeHtml(slug || "untitled")}</p><p><strong>Suggested path:</strong> /${data.type === "grimoire" ? "grimoires" : "notes"}/${escapeHtml(slug || "untitled")}.html</p>`;
  }
  function renderRelated() {
    const lines = document.querySelector("#related-input").value.split("\n").map((line) => line.trim()).filter(Boolean);
    document.querySelector("#related-output").value = lines.length
      ? `<ul class="related-links">\n${lines.map((line) => {
        const [label, url] = line.split("|").map((part) => part.trim());
        return `  <li><a href="${escapeHtml(url || "#")}">${escapeHtml(label)}</a></li>`;
      }).join("\n")}\n</ul>`
      : "";
  }
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function quote(value) {
  return String(value).replaceAll('"', '\\"').replace(/\s+/g, " ").trim();
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
