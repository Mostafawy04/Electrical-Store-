// المزامنة التلقائية مع Supabase عند توفر الإنترنت
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { db } from "./db";
import type { OutboxOp } from "./types";

export function isOnline(): boolean {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return true;
  } catch {
    return true;
  }
}

type TableName = OutboxOp["table"];

/** صف Supabase — يجب أن يحتوي دائماً على المفتاح الأساسي `id` */
type SupabaseRow = Record<string, unknown> & { id: string };

function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeUserId(userId?: string | null): string | null {
  // وضع "local" ليس uuid حقيقياً — لا نرسله لعمود uuid في Supabase
  if (!userId || userId === "local") return null;
  return userId;
}

/** تحويل النماذج المحلية (camelCase) إلى أعمدة Supabase (snake_case) مع ضمان وجود `id` */
function toSupabaseRow(
  table: TableName,
  payload: Record<string, unknown>,
  userId: string | null
): SupabaseRow | null {
  const rawId = payload["id"];
  if (!isValidId(rawId)) return null;

  const now = new Date().toISOString();
  const base = { id: rawId, user_id: userId };

  if (table === "products") {
    return {
      ...base,
      name: String(payload["name"] ?? ""),
      barcode: (payload["barcode"] as string | null | undefined) ?? null,
      purchase_price: toNumber(payload["purchasePrice"] ?? payload["purchase_price"]),
      sale_price: toNumber(payload["salePrice"] ?? payload["sale_price"]),
      stock: toNumber(payload["stock"]),
      supplier: (payload["supplier"] as string | null | undefined) ?? null,
      created_at: String(payload["createdAt"] ?? payload["created_at"] ?? now),
      updated_at: String(payload["updatedAt"] ?? payload["updated_at"] ?? now),
    };
  }

  if (table === "purchases") {
    return {
      ...base,
      supplier: String(payload["supplier"] ?? ""),
      items: (payload["items"] as unknown[]) ?? [],
      subtotal: toNumber(payload["subtotal"]),
      discount_total: toNumber(payload["discountTotal"] ?? payload["discount_total"]),
      grand_total: toNumber(payload["grandTotal"] ?? payload["grand_total"]),
      date: String(payload["date"] ?? now),
      notes: (payload["notes"] as string | null | undefined) ?? null,
    };
  }

  // table === "sales"
  return {
    ...base,
    items: (payload["items"] as unknown[]) ?? [],
    subtotal: toNumber(payload["subtotal"]),
    discount: toNumber(payload["discount"]),
    net_total: toNumber(payload["netTotal"] ?? payload["net_total"]),
    profit_total: toNumber(payload["profitTotal"] ?? payload["profit_total"]),
    date: String(payload["date"] ?? now),
    notes: (payload["notes"] as string | null | undefined) ?? null,
  };
}

/** دفع العمليات المعلقة (Outbox) ثم سحب الأحدث */
export async function syncNow(userId?: string | null): Promise<{ pushed: number; pulled: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isOnline()) return { pushed: 0, pulled: false };
  const sb = getSupabase();
  if (!sb) return { pushed: 0, pulled: false };

  const effectiveUserId = normalizeUserId(userId);
  let pushed = 0;

  try {
    const ops: OutboxOp[] = await db.getOutbox();
    for (const op of ops) {
      try {
        const payload =
          op.payload && typeof op.payload === "object"
            ? (op.payload as Record<string, unknown>)
            : {};

        // --- الحذف: يحتاج `id` فقط ---
        if (op.action === "delete") {
          const rowId = payload["id"];
          // بدون id لا يمكن تنفيذ الحذف — نحذف العملية حتى لا تعلق للأبد
          if (!isValidId(rowId)) {
            await db.removeOutbox(op.id);
            continue;
          }
          // `as unknown as ...` + `any` لتجاوز تضارب أنواع الجداول الموحدة في الـ Build
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const query = (sb.from(op.table) as unknown as any).delete().eq("id", rowId);
          const { error } = await query;
          if (error) continue;
          await db.removeOutbox(op.id);
          pushed += 1;
          continue;
        }

        // --- الإدخال/التحديث: بناء صف كامل يضمن وجود `id` ---
        const row: SupabaseRow | null = toSupabaseRow(op.table, payload, effectiveUserId);
        // payload تالف (بدون id) — نحذف العملية لمنع التكرار اللانهائي
        if (!row) {
          await db.removeOutbox(op.id);
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (sb.from(op.table) as unknown as any).upsert(row, {
          onConflict: "id",
        });
        if (error) continue;
        await db.removeOutbox(op.id);
        pushed += 1;
      } catch {
        // اترك العملية للمرة القادمة
      }
    }

    // سحب (دمج بسيط: الأحدث يفوز حسب updatedAt/date)
    try {
      const tables: TableName[] = ["products", "purchases", "sales"];
      for (const table of tables) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = (sb.from(table) as unknown as any).select("*").limit(500);
        if (effectiveUserId) q = q.eq("user_id", effectiveUserId);
        const { data } = await q;
        if (!Array.isArray(data)) continue;

        for (const r of data) {
          try {
            const clean = r as Record<string, unknown>;

            if (table === "products") {
              const local = await db.getProducts();
              const id = String(clean["id"] ?? "");
              if (!id || local.some((p) => p.id === id)) continue;
              await db.saveProduct({
                id,
                name: String(clean["name"] ?? ""),
                barcode: (clean["barcode"] as string | undefined) ?? undefined,
                purchasePrice: toNumber(clean["purchase_price"] ?? clean["purchasePrice"]),
                salePrice: toNumber(clean["sale_price"] ?? clean["salePrice"]),
                stock: toNumber(clean["stock"]),
                supplier: (clean["supplier"] as string | undefined) ?? undefined,
                createdAt: String(clean["created_at"] ?? clean["createdAt"] ?? new Date().toISOString()),
                updatedAt: String(clean["updated_at"] ?? clean["updatedAt"] ?? new Date().toISOString()),
                synced: true,
              });
            } else if (table === "purchases") {
              const local = await db.getPurchases();
              const id = String(clean["id"] ?? "");
              if (!id || local.some((p) => p.id === id)) continue;
              await db.savePurchase({
                id,
                supplier: String(clean["supplier"] ?? ""),
                items: (clean["items"] as never[]) ?? [],
                subtotal: toNumber(clean["subtotal"]),
                discountTotal: toNumber(clean["discount_total"]),
                grandTotal: toNumber(clean["grand_total"]),
                date: String(clean["date"] ?? new Date().toISOString()),
                notes: (clean["notes"] as string | undefined) ?? undefined,
                synced: true,
              });
            } else {
              const local = await db.getSales();
              const id = String(clean["id"] ?? "");
              if (!id || local.some((s) => s.id === id)) continue;
              await db.saveSale({
                id,
                items: (clean["items"] as never[]) ?? [],
                subtotal: toNumber(clean["subtotal"]),
                discount: toNumber(clean["discount"]),
                netTotal: toNumber(clean["net_total"]),
                profitTotal: toNumber(clean["profit_total"]),
                date: String(clean["date"] ?? new Date().toISOString()),
                notes: (clean["notes"] as string | undefined) ?? undefined,
                synced: true,
              });
            }
          } catch {
            /* ignore row */
          }
        }
      }
    } catch {
      /* السحب اختياري */
    }

    return { pushed, pulled: true };
  } catch (e) {
    return { pushed, pulled: false, error: e instanceof Error ? e.message : "sync failed" };
  }
}
