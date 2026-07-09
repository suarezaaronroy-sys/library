import { exportAllState, importAllState } from "./store.js?v=5";

const backupExport = document.querySelector("#backup-export");
const backupImportBtn = document.querySelector("#backup-import");
const backupFile = document.querySelector("#backup-file");
const backupStatus = document.querySelector("#backup-status");

if (backupExport && backupImportBtn && backupFile && backupStatus) {
  backupExport.addEventListener("click", () => {
    const payload = exportAllState();
    const count = Object.keys(payload.data).length;
    const stamp = payload.exportedAt.slice(0, 10);
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `workbench-backup-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    backupStatus.textContent = `Backup prepared - ${count} saved ${count === 1 ? "key" : "keys"}.`;
  });

  backupImportBtn.addEventListener("click", () => backupFile.click());
  backupFile.addEventListener("change", () => {
    const file = backupFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let imported = -1;
      try {
        imported = importAllState(JSON.parse(String(reader.result)));
      } catch {}
      backupStatus.textContent = imported < 0
        ? "That file isn't a Workbench backup."
        : `Restored ${imported} ${imported === 1 ? "key" : "keys"} - reload any open workspace to apply.`;
      backupFile.value = "";
    };
    reader.readAsText(file);
  });
}
