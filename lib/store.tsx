"use client";
// إدارة الحالة المركزية: IndexedDB محلي (دائم) + Supabase سحابي (دائم لكل مستخدم)
// — تسجيل الخروج لا يمسح أي بيانات إطلاقاً؛ تُعاد المزامنة فور تسجيل الدخول
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, Customer, Product, Purchase, Sale, OutboxOp } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { db } from "./db";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { syncNow, isOnline } from "./sync";
import { uid, nowISO, toNum } from "./utils";

interface AppState {
  ready: boolean;
  userEmail: string | null;
  userId: string | null;
  online: boolean;
  syncing: boolean;
  lastSync: string | null;
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
  customers: Customer[];
  settings: AppSettings;
}

interface AppActions {
  setUser: (email: string | null, id: string | null) => void;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  addOrUpdateProduct: (p: Partial<Product> & { name: string }) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  addPurchase: (p: Purchase) => Promise<void>;
  updatePurchase: (p: Purchase) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  addSale: (s: Sale) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addOrUpdateCustomer: (c: Partial<Customer> & { name: string }) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
  findProductByBarcode: (barcode: string) => Product | undefined;
  refresh: () => Promise<void>;
  doSync: () => Promise<void>;
}

const AppCtx = createContext<(AppState & AppActions) | null>(null);

async function queueOp(table: OutboxOp["table"], action: OutboxOp["action"], payload: unknown) {
  try {
    if (!isSupabaseConfigured()) return;
    await db.pushOutbox({ id: uid("op"), table, action, payload, createdAt: nowISO() });
  } catch { /* لا نكسر التطبيق */ }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  const refresh = useCallback(async () => {
    try {
      const [p, pu, s, cu, st] = await Promise.all([
        db.getProducts().catch(() => [] as Product[]),
        db.getPurchases().catch(() => [] as Purchase[]),
        db.getSales().catch(() => [] as Sale[]),
        db.getCustomers().catch(() => [] as Customer[]),
        db.getSettings(DEFAULT_SETTINGS).catch(() => DEFAULT_SETTINGS),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setPurchases(Array.isArray(pu) ? pu : []);
      setSales(Array.isArray(s) ? s : []);
      setCustomers(Array.isArray(cu) ? cu : []);
      setSettings({ ...DEFAULT_SETTINGS, ...(st ?? {}) });
    } catch {
      // يبقى التطبيق يعمل بالحالة الفارغة
    } finally {
      setReady(true);
    }
  }, []);

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const r = await syncNow(userIdRef.current);
      if (r.pulled) {
        setLastSync(nowISO());
        await refresh();
      }
    } catch { /* ignore */ }
    finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refresh]);

  // استعادة الجلسة + أول تحميل + الاشتراك في تغيّر المصادقة
  useEffect(() => {
    let alive = true;
    let authSub: { unsubscribe: () => void } | null = null;
    (async () => {
      // حمّل المحلي أولاً ليعمل التطبيق فوراً (Offline-first)
      await refresh();
      try {
        const sb = getSupabase();
        if (!isSupabaseConfigured() || !sb) {
          try {
            const em = localStorage.getItem("salesapp_session_email");
            if (alive && em) { setUserEmail(em); setUserId("local"); }
          } catch { /* ignore */ }
        } else {
          const { data } = await sb.auth.getSession();
          if (alive && data.session?.user) {
            const u = data.session.user;
            setUserEmail(u.email ?? null);
            setUserId(u.id);
            // اسحب بيانات هذا المستخدم من السحابة فوراً
            try {
              const r = await syncNow(u.id);
              if (alive && r.pulled) {
                setLastSync(nowISO());
                await refresh();
              }
            } catch { /* ignore */ }
          }
          // تابع الدخول/الخروج لاحقاً (انتهاء الجلسة، دخول جديد…)
          try {
            const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
              if (!alive) return;
              if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
                const u = session?.user;
                if (u) {
                  setUserEmail(u.email ?? null);
                  setUserId(u.id);
                  // دخول (جديد أو مستعاد): اسحب السحابة وادمجها مع المحلي
                  void (async () => {
                    try {
                      const r = await syncNow(u.id);
                      if (r.pulled) {
                        setLastSync(nowISO());
                        await refresh();
                      }
                    } catch { /* ignore */ }
                  })();
                }
              } else if (event === "SIGNED_OUT") {
                // خروج: نمسح الهوية فقط — البيانات المحلية والسحابية تبقى كما هي
                setUserEmail(null);
                setUserId(null);
                try { localStorage.removeItem("salesapp_session_email"); } catch { /* ignore */ }
              }
            });
            authSub = listener.subscription;
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      try {
        setOnline(isOnline());
      } catch { /* ignore */ }
    })();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      try { authSub?.unsubscribe(); } catch { /* ignore */ }
    };
  }, [refresh]);

  // مزامنة تلقائية كل 60 ثانية عند الاتصال
  useEffect(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setInterval(() => {
      try {
        if (isOnline() && isSupabaseConfigured() && userIdRef.current) void doSync();
      } catch { /* ignore */ }
    }, 60000);
    return () => { if (syncTimer.current) clearInterval(syncTimer.current); };
  }, [doSync]);

  // مزامنة فورية عند عودة الإنترنت أو تغيّر المستخدم (دخول)
  useEffect(() => {
    if (online && userId) void doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, userId]);

  // تطبيق الثيم وحجم/نوع الخط والاتجاه
  useEffect(() => {
    try {
      const root = document.documentElement;
      root.classList.toggle("dark", !!settings.darkMode);
      root.setAttribute("dir", settings.language === "en" ? "ltr" : "rtl");
      root.setAttribute("lang", settings.language === "en" ? "en" : "ar");
      const size = settings.fontSize === "small" ? "15px" : settings.fontSize === "large" ? "19px" : "17px";
      root.style.fontSize = size;
      root.dataset.font = settings.fontFamily;
    } catch { /* ignore */ }
  }, [settings.darkMode, settings.fontSize, settings.fontFamily, settings.language]);

  const setUser = useCallback((email: string | null, id: string | null) => {
    setUserEmail(email);
    setUserId(id);
    try {
      if (email) localStorage.setItem("salesapp_session_email", email);
      else localStorage.removeItem("salesapp_session_email");
    } catch { /* ignore */ }
    // ملاحظة: لا نمسح أي بيانات محلية هنا أبداً — فقط الهوية
  }, []);

  const saveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    // تحديث فوري للواجهة + حفظ تلقائي في IndexedDB (Auto-save)
    let next: AppSettings = DEFAULT_SETTINGS;
    setSettings((prev) => {
      next = { ...prev, ...patch };
      return next;
    });
    // مهلة دقيقة لضمان التقاط أحدث حالة بعد الـ re-render
    await new Promise((r) => setTimeout(r, 30));
    try {
      await db.saveSettings(next);
    } catch {
      // نعيد المحاولة من الحالة الحالية عند الفشل
      setSettings((prev) => {
        void db.saveSettings(prev).catch(() => undefined);
        return prev;
      });
    }
  }, []);

  const addOrUpdateProduct = useCallback(async (p: Partial<Product> & { name: string }) => {
    const now = nowISO();
    const item: Product = {
      id: p.id ?? uid("prd"),
      name: (p.name ?? "").trim() || "صنف بدون اسم",
      barcode: p.barcode?.trim() || undefined,
      purchasePrice: Math.max(0, toNum(p.purchasePrice)),
      salePrice: Math.max(0, toNum(p.salePrice)),
      stock: Math.max(0, Math.floor(toNum(p.stock))),
      supplier: p.supplier?.trim() || undefined,
      createdAt: p.createdAt ?? now,
      updatedAt: now,
      synced: false,
    };
    await db.saveProduct(item).catch(() => undefined);
    setProducts((prev) => {
      const rest = prev.filter((x) => x.id !== item.id);
      return [...rest, item];
    });
    void queueOp("products", "upsert", item);
    return item;
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await db.deleteProduct(id).catch(() => undefined);
    setProducts((prev) => prev.filter((x) => x.id !== id));
    void queueOp("products", "delete", { id });
  }, []);

  const addPurchase = useCallback(async (p: Purchase) => {
    const row = { ...p, synced: false };
    await db.savePurchase(row).catch(() => undefined);
    setPurchases((prev) => [...prev.filter((x) => x.id !== row.id), row]);
    // تحديث المخزون تلقائياً + أسعار البيع المقترحة
    for (const it of row.items ?? []) {
      try {
        const match = products.find(
          (x) => (it.productId && x.id === it.productId) || (it.barcode && x.barcode === it.barcode) || x.name === it.productName
        );
        if (match) {
          await db.saveProduct({ ...match, stock: match.stock + Math.max(0, toNum(it.qty)), purchasePrice: toNum(it.purchasePrice, match.purchasePrice), salePrice: toNum(it.salePrice, match.salePrice), updatedAt: nowISO() }).catch(() => undefined);
        } else {
          await db.saveProduct({
            id: it.productId ?? uid("prd"),
            name: it.productName,
            barcode: it.barcode,
            purchasePrice: toNum(it.purchasePrice),
            salePrice: toNum(it.salePrice),
            stock: Math.max(0, toNum(it.qty)),
            supplier: row.supplier,
            createdAt: nowISO(),
            updatedAt: nowISO(),
            synced: false,
          }).catch(() => undefined);
        }
      } catch { /* تابع باقي الأصناف */ }
    }
    const fresh = await db.getProducts().catch(() => products);
    setProducts(fresh);
    void queueOp("purchases", "upsert", row);
  }, [products]);

  const updatePurchase = useCallback(async (p: Purchase) => {
    await db.savePurchase({ ...p, synced: false }).catch(() => undefined);
    setPurchases((prev) => [...prev.filter((x) => x.id !== p.id), p]);
    void queueOp("purchases", "upsert", p);
  }, []);

  const deletePurchase = useCallback(async (id: string) => {
    await db.deletePurchase(id).catch(() => undefined);
    setPurchases((prev) => prev.filter((x) => x.id !== id));
    void queueOp("purchases", "delete", { id });
  }, []);

  const addSale = useCallback(async (s: Sale) => {
    const row = { ...s, synced: false };
    await db.saveSale(row).catch(() => undefined);
    setSales((prev) => [...prev.filter((x) => x.id !== row.id), row]);
    // خصم المخزون
    for (const it of row.items ?? []) {
      try {
        const match = products.find((x) => (it.productId && x.id === it.productId) || (it.barcode && x.barcode === it.barcode) || x.name === it.name);
        if (match) {
          await db.saveProduct({ ...match, stock: Math.max(0, match.stock - Math.max(0, toNum(it.qty))), updatedAt: nowISO() }).catch(() => undefined);
        }
      } catch { /* ignore */ }
    }
    const fresh = await db.getProducts().catch(() => products);
    setProducts(fresh);
    void queueOp("sales", "upsert", row);
  }, [products]);

  const deleteSale = useCallback(async (id: string) => {
    await db.deleteSale(id).catch(() => undefined);
    setSales((prev) => prev.filter((x) => x.id !== id));
    void queueOp("sales", "delete", { id });
  }, []);

  const addOrUpdateCustomer = useCallback(async (c: Partial<Customer> & { name: string }) => {
    const now = nowISO();
    const row: Customer = {
      id: c.id ?? uid("cus"),
      name: (c.name ?? "").trim() || "عميل بدون اسم",
      phone: c.phone?.trim() || undefined,
      balance: Math.max(0, toNum(c.balance)),
      notes: c.notes?.trim() || undefined,
      createdAt: c.createdAt ?? now,
      updatedAt: now,
      synced: false,
    };
    await db.saveCustomer(row).catch(() => undefined);
    setCustomers((prev) => [...prev.filter((x) => x.id !== row.id), row]);
    void queueOp("customers", "upsert", row);
    return row;
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    await db.deleteCustomer(id).catch(() => undefined);
    setCustomers((prev) => prev.filter((x) => x.id !== id));
    void queueOp("customers", "delete", { id });
  }, []);

  const findProductByBarcode = useCallback((barcode: string) => {
    const b = (barcode ?? "").trim();
    if (!b) return undefined;
    return products.find((p) => (p.barcode ?? "").trim() === b);
  }, [products]);

  const value = useMemo(
    () => ({
      ready, userEmail, userId, online, syncing, lastSync,
      products, purchases, sales, customers, settings,
      setUser, saveSettings, addOrUpdateProduct, deleteProduct,
      addPurchase, updatePurchase, deletePurchase, addSale, deleteSale,
      addOrUpdateCustomer, deleteCustomer,
      findProductByBarcode, refresh, doSync,
    }),
    [ready, userEmail, userId, online, syncing, lastSync, products, purchases, sales, customers, settings,
      setUser, saveSettings, addOrUpdateProduct, deleteProduct, addPurchase, updatePurchase,
      deletePurchase, addSale, deleteSale, addOrUpdateCustomer, deleteCustomer,
      findProductByBarcode, refresh, doSync]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppState & AppActions {
  const ctx = useContext(AppCtx);
  if (!ctx) {
    // fallback آمن يمنع الانهيار خارج المزود
    return {
      ready: true, userEmail: null, userId: null, online: true, syncing: false, lastSync: null,
      products: [], purchases: [], sales: [], customers: [], settings: DEFAULT_SETTINGS,
      setUser: () => undefined,
      saveSettings: async () => undefined,
      addOrUpdateProduct: async (p) => ({ id: uid("prd"), name: p.name, purchasePrice: 0, salePrice: 0, stock: 0, createdAt: nowISO(), updatedAt: nowISO() }),
      deleteProduct: async () => undefined,
      addPurchase: async () => undefined,
      updatePurchase: async () => undefined,
      deletePurchase: async () => undefined,
      addSale: async () => undefined,
      deleteSale: async () => undefined,
      addOrUpdateCustomer: async (c) => ({ id: uid("cus"), name: c.name, phone: undefined, balance: 0, createdAt: nowISO(), updatedAt: nowISO() }),
      deleteCustomer: async () => undefined,
      findProductByBarcode: () => undefined,
      refresh: async () => undefined,
      doSync: async () => undefined,
    };
  }
  return ctx;
}
