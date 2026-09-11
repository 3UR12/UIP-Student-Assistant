/* Sole owner of chrome.storage.session workflow operations. */
importScripts("../core/workflow-state.js");

const WORKFLOW_KEY = "uip.workflow.v1";
const core = globalThis.UIPScannerCore;

async function loadWorkflow() {
  try {
    const stored = await chrome.storage.session.get(WORKFLOW_KEY);
    return { ok: true, workflow: core.sanitizeWorkflow(stored[WORKFLOW_KEY]) };
  } catch (_) { return { ok: false, error: "workflow-storage-unavailable" }; }
}
async function saveWorkflow(value) {
  const workflow = core.sanitizeWorkflow(value);
  if (!workflow) return { ok: false, error: "workflow-storage-unavailable" };
  try {
    await chrome.storage.session.set({ [WORKFLOW_KEY]: workflow });
    const readback = await chrome.storage.session.get(WORKFLOW_KEY);
    const verified = core.sanitizeWorkflow(readback[WORKFLOW_KEY]);
    if (!core.workflowEquals(workflow, verified)) return { ok: false, error: "workflow-save-verification-failed" };
    return { ok: true, workflow: verified };
  } catch (_) { return { ok: false, error: "workflow-storage-unavailable" }; }
}
async function clearWorkflow() {
  try { await chrome.storage.session.remove(WORKFLOW_KEY); return { ok: true }; }
  catch (_) { return { ok: false, error: "workflow-storage-unavailable" }; }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !["UIP_WORKFLOW_LOAD", "UIP_WORKFLOW_SAVE", "UIP_WORKFLOW_CLEAR"].includes(message.type)) return undefined;
  const action = message.type === "UIP_WORKFLOW_LOAD" ? loadWorkflow()
    : message.type === "UIP_WORKFLOW_SAVE" ? saveWorkflow(message.workflow)
      : clearWorkflow();
  action.then(sendResponse).catch(() => sendResponse({ ok: false, error: "workflow-storage-unavailable" }));
  return true;
});
