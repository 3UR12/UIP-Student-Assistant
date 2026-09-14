/* Content-script settlement: async Moodle cards must emit a terminal event only after they appear. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

(async () => {
  const sent = [];
  let listener = null;
  let observer = null;
  let currentScan = { scannerVersion: "0.5.0", pageType: "AREA_PERSONAL", courses: [], modules: [] };
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; observer = this; this.disconnected = false; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const document = { location: { href: "https://moodle.uip.edu.pa/my/", pathname: "/my/" } };
  const chrome = {
    runtime: {
      onMessage: { addListener(value) { listener = value; } },
      sendMessage(message) { sent.push(message); return Promise.resolve(); }
    }
  };
  const context = {
    globalThis: {}, chrome, document, MutationObserver: FakeMutationObserver,
    setTimeout, clearTimeout, Promise, console
  };
  context.globalThis = context;
  context.UIPScannerCore = {
    VERSION: "0.5.0",
    scanDocument() { return currentScan; },
    findDashboardScope() { return {}; },
    findMainContent() { return {}; }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("extension/content/content.js", "utf8"), context, { filename: "content.js" });

  const response = {};
  assert.equal(listener({ type: "UIP_BEGIN_DISCOVERY_SETTLEMENT", kind: "courses", requestId: "courses-request" }, {}, (value) => Object.assign(response, value)), false);
  assert.equal(response.ok, true);
  assert.ok(observer);
  assert.equal(sent.some((message) => message.type === "UIP_MOODLE_DISCOVERY_SETTLED"), false);

  currentScan = { scannerVersion: "0.5.0", pageType: "AREA_PERSONAL", courses: [{ id: "8100" }], modules: [] };
  observer.callback([]);
  await new Promise((resolve) => setTimeout(resolve, 180));
  const settled = sent.find((message) => message.type === "UIP_MOODLE_DISCOVERY_SETTLED");
  assert.deepEqual(settled && { kind: settled.kind, requestId: settled.requestId, reason: settled.reason, courses: settled.scan.courses.length }, { kind: "courses", requestId: "courses-request", reason: "items-found", courses: 1 });
  assert.equal(observer.disconnected, true);
  console.log("content discovery settlement observer tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
