// panel.js — client-side logic for the Accessibility Assistant sidebar webview

(function () {
  const vscode = acquireVsCodeApi();
  const output       = document.getElementById("output");
  const spinner      = document.getElementById("spinner");
  const status       = document.getElementById("statusText");
  const modelName    = document.getElementById("modelName");
  const modelSelect  = document.getElementById("modelSelect");
  const btnAnalyse   = document.getElementById("btnAnalyse");
  const btnClear     = document.getElementById("btnClear");

  let currentStreamBlock = null;

  // Button / dropdown handlers
  btnAnalyse.addEventListener("click", () => {
    vscode.postMessage({ type: "analyseFile" });
  });
  modelSelect.addEventListener("change", () => {
    const selected = modelSelect.value;
    if (selected) {
      vscode.postMessage({ type: "selectModel", model: selected });
    }
  });
  btnClear.addEventListener("click", () => {
    output.innerHTML = "";
    currentStreamBlock = null;
    vscode.postMessage({ type: "clear" });
  });

  // Helpers
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function appendLog(text) {
    currentStreamBlock = null;
    const el = document.createElement("div");
    el.className = "log-line";
    el.innerHTML = escapeHtml(text);
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }

  function appendStream(text) {
    if (!currentStreamBlock) {
      currentStreamBlock = document.createElement("div");
      currentStreamBlock.className = "stream-block";
      output.appendChild(currentStreamBlock);
    }
    currentStreamBlock.textContent += text;
    output.scrollTop = output.scrollHeight;
  }

  function setButtons(enabled) {
    btnAnalyse.disabled = !enabled;
  }

  // Message handler
  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "log":
        appendLog(msg.text);
        break;

      case "stream":
        appendStream(msg.text);
        break;

      case "streamStart":
        currentStreamBlock = null;
        break;

      case "streamEnd":
        currentStreamBlock = null;
        break;

      case "analysisStart":
        setButtons(false);
        spinner.classList.add("active");
        status.textContent = "Analysing…";
        if (output.children.length > 0) {
          const sep = document.createElement("div");
          sep.className = "separator";
          output.appendChild(sep);
        }
        break;

      case "analysisEnd":
        setButtons(true);
        spinner.classList.remove("active");
        status.textContent = "Idle";
        break;

      case "setModels": {
        // Populate the dropdown with available models
        modelSelect.innerHTML = "";
        if (msg.models.length === 0) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.disabled = true;
          opt.selected = true;
          opt.textContent = "No models found";
          modelSelect.appendChild(opt);
        } else {
          msg.models.forEach(function (m) {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            if (m === msg.current) { opt.selected = true; }
            modelSelect.appendChild(opt);
          });
          // Update the badge to reflect the current selection
          modelName.textContent = msg.current || msg.models[0];
        }
        break;
      }

      case "setModel":
        modelName.textContent = msg.model || "(none)";
        // Sync the dropdown selection
        if (msg.model) { modelSelect.value = msg.model; }
        break;
    }
  });
})();
