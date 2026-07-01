const resourceViewButtons = document.querySelectorAll("[data-resource-view-panel]");
resourceViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.resourceViewPanel;
    resourceViewButtons.forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    document.querySelectorAll("[data-resource-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.resourcePanel !== view;
    });
  });
});

initPasswordGenerator();
initScreenshotStudio();

function initPasswordGenerator() {
  const root = document.querySelector("#password-generator");
  if (!root) return;
  const output = document.querySelector("#password-output");
  const length = document.querySelector("#password-length");
  const lengthOutput = document.querySelector("#password-length-value");

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-password-action]")?.dataset.passwordAction;
    if (action === "generate") generate();
    if (action === "copy" && output.textContent) {
      try {
        await navigator.clipboard.writeText(output.textContent);
        event.target.textContent = "Copied";
        window.setTimeout(() => { event.target.textContent = "Copy"; }, 1400);
      } catch {
        document.querySelector("#password-strength-label").textContent = "Clipboard permission was not available";
      }
    }
  });
  root.addEventListener("change", generate);
  length.addEventListener("input", () => {
    lengthOutput.textContent = length.value;
    generate();
  });
  generate();

  function generate() {
    const sets = {
      lower: "abcdefghijklmnopqrstuvwxyz",
      upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      number: "0123456789",
      symbol: "!@#$%^&*()-_=+[]{};:,.?"
    };
    const excludeAmbiguous = root.querySelector('[data-password-option="ambiguous"]').checked;
    const ambiguous = new Set("Il1O0o|`'\"");
    const enabled = Object.entries(sets)
      .filter(([name]) => root.querySelector(`[data-password-option="${name}"]`).checked)
      .map(([, characters]) => excludeAmbiguous
        ? [...characters].filter((character) => !ambiguous.has(character)).join("")
        : characters);
    if (!enabled.length) {
      output.textContent = "";
      document.querySelector("#password-entropy").textContent = "0 bits";
      document.querySelector("#password-strength-label").textContent = "Choose at least one character set";
      return;
    }
    const requestedLength = Math.max(Number(length.value), enabled.length);
    const pool = enabled.join("");
    const characters = enabled.map((set) => set[randomIndex(set.length)]);
    while (characters.length < requestedLength) characters.push(pool[randomIndex(pool.length)]);
    secureShuffle(characters);
    output.textContent = characters.join("");
    const entropy = Math.round(requestedLength * Math.log2(pool.length));
    document.querySelector("#password-entropy").textContent = `${entropy} bits`;
    document.querySelector("#password-strength-label").textContent = entropy >= 120
      ? "Very strong"
      : entropy >= 80
        ? "Strong"
        : entropy >= 60
          ? "Reasonable"
          : "Increase the length";
  }
}

function initScreenshotStudio() {
  const root = document.querySelector("#screenshot-studio");
  if (!root) return;
  const canvas = document.querySelector("#screenshot-canvas");
  const context = canvas.getContext("2d");
  const base = document.createElement("canvas");
  const baseContext = base.getContext("2d");
  const upload = document.querySelector("#screenshot-upload");
  const status = document.querySelector("#screenshot-status");
  let hasImage = false;
  let marks = [];
  let drawing = null;

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-screenshot-action]")?.dataset.screenshotAction;
    if (action === "capture") await captureScreen();
    if (action === "upload") upload.click();
    if (action === "undo") {
      marks.pop();
      draw();
      setStatus(marks.length ? "Last mark removed" : "All marks removed");
    }
    if (action === "reset") {
      marks = [];
      draw();
      setStatus("Marks reset");
    }
    if (action === "download") downloadImage();
  });
  upload.addEventListener("change", () => loadFile(upload.files[0]));
  document.addEventListener("paste", (event) => {
    const image = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"));
    if (image) loadFile(image.getAsFile());
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!hasImage) return;
    const point = canvasPoint(event);
    drawing = { type: selectedMode(), x: point.x, y: point.y, width: 0, height: 0 };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const point = canvasPoint(event);
    drawing.width = point.x - drawing.x;
    drawing.height = point.y - drawing.y;
    draw(drawing);
  });
  canvas.addEventListener("pointerup", () => {
    if (!drawing) return;
    if (Math.abs(drawing.width) > 4 && Math.abs(drawing.height) > 4) marks.push(normalizeMark(drawing));
    drawing = null;
    draw();
    setStatus(marks.length ? `${marks.length} mark${marks.length === 1 ? "" : "s"} applied locally` : "Mark was too small");
  });
  drawEmpty();

  async function captureScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("Screen capture is not supported in this browser");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      if (!video.videoWidth) await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
      setBase(video, video.videoWidth, video.videoHeight);
      setStatus("Screen captured locally");
    } catch {
      setStatus("Screen capture was cancelled");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  async function loadFile(file) {
    if (!file) return;
    try {
      const image = await createImageBitmap(file);
      setBase(image, image.width, image.height);
      image.close();
      setStatus("Image loaded locally");
    } catch {
      setStatus("That image could not be opened");
    } finally {
      upload.value = "";
    }
  }

  function setBase(source, width, height) {
    const scale = Math.min(1, 1920 / width);
    base.width = Math.max(1, Math.round(width * scale));
    base.height = Math.max(1, Math.round(height * scale));
    baseContext.clearRect(0, 0, base.width, base.height);
    baseContext.drawImage(source, 0, 0, base.width, base.height);
    canvas.width = base.width;
    canvas.height = base.height;
    marks = [];
    hasImage = true;
    document.querySelector("#screenshot-empty").hidden = true;
    draw();
  }

  function draw(preview) {
    if (!hasImage) {
      drawEmpty();
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(base, 0, 0);
    [...marks, ...(preview ? [normalizeMark(preview)] : [])].forEach(drawMark);
  }

  function drawMark(mark) {
    context.save();
    if (mark.type === "redact") {
      context.fillStyle = "#111111";
      context.fillRect(mark.x, mark.y, mark.width, mark.height);
    } else {
      context.fillStyle = "rgba(250, 204, 21, .28)";
      context.strokeStyle = "rgba(202, 138, 4, .9)";
      context.lineWidth = Math.max(2, canvas.width / 600);
      context.fillRect(mark.x, mark.y, mark.width, mark.height);
      context.strokeRect(mark.x, mark.y, mark.width, mark.height);
    }
    context.restore();
  }

  function drawEmpty() {
    context.fillStyle = "#ede9e0";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(28,25,23,.08)";
    context.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 48) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y < canvas.height; y += 48) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
  }

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height
    };
  }

  function selectedMode() {
    return root.querySelector('input[name="screenshotMode"]:checked')?.value || "redact";
  }

  function downloadImage() {
    if (!hasImage) {
      setStatus("Capture or open an image first");
      return;
    }
    const format = document.querySelector("#screenshot-format").value;
    const filename = slug(document.querySelector("#screenshot-name").value) || "workbench-screenshot";
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.${format === "jpeg" ? "jpg" : "png"}`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Image download prepared");
    }, `image/${format}`, format === "jpeg" ? 0.92 : undefined);
  }

  function setStatus(message) {
    status.textContent = message;
  }
}

function normalizeMark(mark) {
  return {
    type: mark.type,
    x: mark.width < 0 ? mark.x + mark.width : mark.x,
    y: mark.height < 0 ? mark.y + mark.height : mark.y,
    width: Math.abs(mark.width),
    height: Math.abs(mark.height)
  };
}

function randomIndex(length) {
  if (length <= 0) return 0;
  const limit = Math.floor(256 / length) * length;
  const byte = new Uint8Array(1);
  do crypto.getRandomValues(byte); while (byte[0] >= limit);
  return byte[0] % length;
}

function secureShuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
