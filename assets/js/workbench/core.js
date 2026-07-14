const SESSION_KEY = "aaron-workbench:v1:session";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || { recent: [] };
  } catch {
    return { recent: [] };
  }
}

function writeSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function cleanTitle(value) {
  return String(value || "Workbench").replace(/\s+/g, " ").trim();
}

const frame = document.querySelector(".workbench-frame");
if (frame) {
  const workspace = frame.dataset.workspace || "index";
  const title = cleanTitle(document.querySelector(".workbench-header h1")?.textContent);
  const url = `${location.pathname}${location.search}`;
  const at = new Date().toISOString();
  const session = readSession();
  const record = { workspace, title, url, at };

  session.last = record;
  session.recent = [record, ...(session.recent || []).filter((item) => item.url !== url)].slice(0, 8);
  writeSession(session);

  document.querySelectorAll(".workbench-nav a, .workbench-ledger-row").forEach((link) => {
    link.addEventListener("click", () => {
      const label = cleanTitle(link.querySelector("h2")?.textContent || link.textContent);
      const next = {
        workspace: link.getAttribute("href") || "",
        title: label,
        url: link.getAttribute("href") || "",
        at: new Date().toISOString()
      };
      const fresh = readSession();
      fresh.lastIntent = next;
      fresh.recent = [next, ...(fresh.recent || []).filter((item) => item.url !== next.url)].slice(0, 8);
      writeSession(fresh);
    });
  });
}
