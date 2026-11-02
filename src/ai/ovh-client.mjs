export class OvhAI {
  constructor(bridge, ownKey = false) { this.bridge = bridge; this.ownKey = ownKey; }
  get batch() { return !this.ownKey; }
  batchDetect(blocks) { return this.bridge.ovhRequest("analyze", { blocks }, true); }
  request(type, payload) { return this.ownKey ? this.bridge.ownOvhRequest(type, payload, true) : this.bridge.ovhRequest(type, payload, true); }
  stop() { return (this.ownKey ? this.bridge.ownOvhCancel() : this.bridge.ovhCancel()).catch(() => {}); }
}
