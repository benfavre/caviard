import { EventEmitter } from "node:events";
import { UpdateController } from "./updater.mjs";

const stores = {
  "mac-app-store": "App Store",
  "microsoft-store": "Microsoft Store",
};

export function distributionChannel({ mas = false, windowsStore = false, metadata = {} } = {}) {
  // Native flags take priority over package metadata, including for old builds.
  if (mas) return "mac-app-store";
  if (windowsStore) return "microsoft-store";
  return Object.hasOwn(stores, metadata.distributionChannel)
    ? metadata.distributionChannel
    : "direct";
}

export class StoreUpdateController extends EventEmitter {
  constructor(channel) {
    super();
    if (!Object.hasOwn(stores, channel)) throw new Error("Unknown store channel");
    this.store = stores[channel];
  }
  snapshot() {
    return { phase: "store", version: null, percent: 0,
      message: `Les mises à jour sont gérées par ${this.store}. Vous pouvez les activer dans ses réglages.` };
  }
  async check() { return this.snapshot(); }
  install() { return { ok: false, reason: "store-managed", message: this.snapshot().message }; }
  start() {}
  dispose() { this.removeAllListeners(); }
}

export async function createUpdateController({ channel, loadUpdater, ...options }) {
  // Do not even load electron-updater in a store package. MAS excludes Electron's
  // native updater; replacing a Store-owned install from GitHub is never valid.
  if (Object.hasOwn(stores, channel)) return new StoreUpdateController(channel);
  if (channel !== "direct") throw new Error("Unknown distribution channel");
  const updater = await loadUpdater();
  updater.logger = { info() {}, warn() {}, error() {}, debug() {} };
  return new UpdateController(updater, options);
}
