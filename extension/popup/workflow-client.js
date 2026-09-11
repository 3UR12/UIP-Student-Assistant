/* Popup-to-service-worker workflow messages with bounded completion. */
(function attachWorkflowClient(global) {
  const timeout = (promise, milliseconds) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: "workflow-storage-unavailable" }), milliseconds);
    Promise.resolve(promise).then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve({ ok: false, error: "workflow-storage-unavailable" }); });
  });
  const request = (message) => timeout(new Promise((resolve) => chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError || !response) { resolve({ ok: false, error: "workflow-storage-unavailable" }); return; }
    resolve(response);
  })), 3000);
  global.UIPWorkflowClient = { load: () => request({ type: "UIP_WORKFLOW_LOAD" }), save: (workflow) => request({ type: "UIP_WORKFLOW_SAVE", workflow }), clear: () => request({ type: "UIP_WORKFLOW_CLEAR" }) };
})(globalThis);
