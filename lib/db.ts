// طبقة التخزين المحلي: IndexedDB أولاً، ثم LocalStorage كاحتياطي — تعمل Offline بالكامل
import type { OutboxOp, Product, Purchase, Sale, AppSettings } from "./types";
import { safeParseJSON } from "./utils";

const DB_NAME = "sales-app-db";
const DB_VERSION = 1;
const STORES = ["products", "purchases", "sales", "kv", "outbox"] as const;

function idbSupported(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: "id" });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    } catch (e) {
      reject(e);
    }
  });
}

async function idbAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, "readonly");
      const os = tx.objectStore(store);
      const req = os.getAll();
      req.onsuccess = () => resolve((req.result ?? []) as T[]);
      req.onerror = () => reject(req.error ?? new Error("getAll failed"));
      tx.oncomplete = () => db.close();
    } catch (e) {
      try { db.close(); } catch { /* ignore */ }
      reject(e);
    }
  });
}

async function idbPut(store: string, value: Record<string, unknown>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error ?? new Error("put failed"));
    } catch (e) {
      try { db.close(); } catch { /* ignore */ }
      reject(e);
    }
  });
}

async function idbDelete(store: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error ?? new Error("delete failed"));
    } catch (e) {
      try { db.close(); } catch { /* ignore */ }
      reject(e);
    }
  });
}

async function idbClear(store: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error ?? new Error("clear failed"));
    } catch (e) {
      try { db.close(); } catch { /* ignore */ }
      reject(e);
    }
  });
}

// ---- LocalStorage fallback ----
const LS_PREFIX = "salesapp_";
function lsGet<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    return safeParseJSON<T>(localStorage.getItem(LS_PREFIX + key), fallback);
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch { /* تجاهل امتلاء التخزين */ }
}

// ---- واجهة موحدة ----
export const db = {
  async getProducts(): Promise<Product[]> {
    try {
      if (idbSupported()) return await idbAll<Product>("products");
    } catch { /* fallback */ }
    return lsGet<Product[]>("products", []);
  },
  async saveProduct(p: Product): Promise<void> {
    try {
      if (idbSupported()) { await idbPut("products", p as unknown as Record<string, unknown>); return; }
    } catch { /* fallback */ }
    const all = lsGet<Product[]>("products", []).filter((x) => x.id !== p.id);
    all.push(p);
    lsSet("products", all);
  },
  async deleteProduct(id: string): Promise<void> {
    try {
      if (idbSupported()) { await idbDelete("products", id); return; }
    } catch { /* fallback */ }
    lsSet("products", lsGet<Product[]>("products", []).filter((x) => x.id !== id));
  },

  async getPurchases(): Promise<Purchase[]> {
    try {
      if (idbSupported()) return await idbAll<Purchase>("purchases");
    } catch { /* fallback */ }
    return lsGet<Purchase[]>("purchases", []);
  },
  async savePurchase(p: Purchase): Promise<void> {
    try {
      if (idbSupported()) { await idbPut("purchases", p as unknown as Record<string, unknown>); return; }
    } catch { /* fallback */ }
    const all = lsGet<Purchase[]>("purchases", []).filter((x) => x.id !== p.id);
    all.push(p);
    lsSet("purchases", all);
  },
  async deletePurchase(id: string): Promise<void> {
    try {
      if (idbSupported()) { await idbDelete("purchases", id); return; }
    } catch { /* fallback */ }
    lsSet("purchases", lsGet<Purchase[]>("purchases", []).filter((x) => x.id !== id));
  },

  async getSales(): Promise<Sale[]> {
    try {
      if (idbSupported()) return await idbAll<Sale>("sales");
    } catch { /* fallback */ }
    return lsGet<Sale[]>("sales", []);
  },
  async saveSale(s: Sale): Promise<void> {
    try {
      if (idbSupported()) { await idbPut("sales", s as unknown as Record<string, unknown>); return; }
    } catch { /* fallback */ }
    const all = lsGet<Sale[]>("sales", []).filter((x) => x.id !== s.id);
    all.push(s);
    lsSet("sales", all);
  },
  async deleteSale(id: string): Promise<void> {
    try {
      if (idbSupported()) { await idbDelete("sales", id); return; }
    } catch { /* fallback */ }
    lsSet("sales", lsGet<Sale[]>("sales", []).filter((x) => x.id !== id));
  },

  async getSettings(fallback: AppSettings): Promise<AppSettings> {
    try {
      if (idbSupported()) {
        const all = await idbAll<{ id: string; value: AppSettings }>("kv");
        const hit = all.find((x) => x.id === "settings");
        if (hit?.value) return { ...fallback, ...hit.value };
      }
    } catch { /* fallback */ }
    return { ...fallback, ...lsGet<Partial<AppSettings>>("settings", {}) };
  },
  async saveSettings(s: AppSettings): Promise<void> {
    try {
      if (idbSupported()) { await idbPut("kv", { id: "settings", value: s }); return; }
    } catch { /* fallback */ }
    lsSet("settings", s);
  },

  async getOutbox(): Promise<OutboxOp[]> {
    try {
      if (idbSupported()) return await idbAll<OutboxOp>("outbox");
    } catch { /* fallback */ }
    return lsGet<OutboxOp[]>("outbox", []);
  },
  async pushOutbox(op: OutboxOp): Promise<void> {
    try {
      if (idbSupported()) { await idbPut("outbox", op as unknown as Record<string, unknown>); return; }
    } catch { /* fallback */ }
    const all = lsGet<OutboxOp[]>("outbox", []);
    all.push(op);
    lsSet("outbox", all);
  },
  async removeOutbox(id: string): Promise<void> {
    try {
      if (idbSupported()) { await idbDelete("outbox", id); return; }
    } catch { /* fallback */ }
    lsSet("outbox", lsGet<OutboxOp[]>("outbox", []).filter((x) => x.id !== id));
  },
  async clearOutbox(): Promise<void> {
    try {
      if (idbSupported()) { await idbClear("outbox"); return; }
    } catch { /* fallback */ }
    lsSet("outbox", []);
  },
};
