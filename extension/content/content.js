/* Passive bridge: scanning happens only after an explicit popup request. */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "UIP_SCAN_CURRENT_DOCUMENT") return undefined;
  try {
    const scan = globalThis.UIPScannerCore.scanDocument(document);
    sendResponse({ ok: true, scan });
  } catch (_) {
    sendResponse({ ok: false, error: "The page could not be scanned." });
  }
  return false;
});
