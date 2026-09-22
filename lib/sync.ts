// المزامنة مع Supabase: دفع Outbox أولاً ثم سحب ودمج (الأحدث يفوز)
// — البيانات دائمة في السحابة لكل مستخدم ولا تُمسح عند تسجيل الخروج
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { db } from "./db";
import type { Customer, OutboxOp, Product, Purchase, Sale } from "./types";

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

function toText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
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

  if (table === "customers") {
    return {
      ...base,
      name: String(payload["name"] ?? ""),
      phone: toText(payload["phone"]),
      balance: toNumber(payload["balance"]),
      notes: toText(payload["notes"]),
      created_at: String(payload["createdAt"] ?? payload["created_at"] ?? now),
      updated_at: String(payload["updatedAt"] ?? payload["updated_at"] ?? now),
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
    customer_name: toText(payload["customerName"] ?? payload["customer_name"]),
    invoice_no: toText(payload["invoiceNo"] ?? payload["invoice_no"]),
    previous_balance: toNumber(payload["previousBalance"] ?? payload["previous_balance"]),
    paid_amount: toNumber(payload["paid"] ?? payload["paid_amount"]),
  };
}

function remoteTime(v: unknown): number {
  const t = new Date(String(v ?? "")).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** دفع العمليات المعلقة (Outbox) ثم سحب الأحدث ودمجه */
export async function syncNow(userId?: string | null): Promise<{ pushed: number; pulled: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isOnline()) return { pushed: 0, pulled: false };
  const sb = getSupabase();
  if (!sb) return { pushed: 0, pulled: false };

  const effectiveUserId = normalizeUserId(userId);
  // بدون مستخدم حقيقي لا يمكن الكتابة (RLS) ولا السحب المخصص — نكتفي بالمحلي
  if (!effectiveUserId) return { pushed: 0, pulled: false };

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const query = (sb.from(op.table) as unknown as any).delete().eq("id", rowId).eq("user_id", effectiveUserId);
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

    // سحب ودمج: الأحدث يفوز (مقارنة updated_at/date) — يحدّث الموجود ويضيف الجديد
    try {
      const tables: TableName[] = ["products", "purchases", "sales", "customers"];
      for (const table of tables) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q: any = (sb.from(table) as unknown as any)
          .select("*")
          .eq("user_id", effectiveUserId)
          .limit(1000);
        const { data, error } = await q;
        if (error || !Array.isArray(data)) continue;

        for (const r of data) {
          try {
            const clean = r as Record<string, unknown>;
            const id = String(clean["id"] ?? "");
            if (!id) continue;

            if (table === "products") {
              const local = await db.getProducts().catch(() => [] as Product[]);
              const prev = local.find((p) => p.id === id);
              const remoteUpdated = remoteTime(clean["updated_at"] ?? clean["updatedAt"]);
              const localUpdated = prev ? remoteTime((prev as Product).updatedAt) : 0;
              if (prev && remoteUpdated <= localUpdated) continue;
              await db.saveProduct({
                id,
                name: String(clean["name"] ?? prev?.name ?? ""),
                barcode: (clean["barcode"] as string | undefined) ?? prev?.barcode,
                purchasePrice: toNumber(clean["purchase_price"] ?? clean["purchasePrice"] ?? prev?.purchasePrice),
                salePrice: toNumber(clean["sale_price"] ?? clean["salePrice"] ?? prev?.salePrice),
                stock: toNumber(clean["stock"] ?? prev?.stock),
                supplier: (clean["supplier"] as string | undefined) ?? prev?.supplier,
                createdAt: String(clean["created_at"] ?? clean["createdAt"] ?? prev?.createdAt ?? new Date().toISOString()),
                updatedAt: String(clean["updated_at"] ?? clean["updatedAt"] ?? new Date().toISOString()),
                synced: true,
              });
            } else if (table === "purchases") {
              const local = await db.getPurchases().catch(() => [] as Purchase[]);
              if (local.some((p) => p.id === id)) continue; // المشتريات سجل تاريخي — لا تُحدَّث من السحب
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
            } else if (table === "customers") {
              const local = await db.getCustomers().catch(() => [] as Customer[]);
              const prev = local.find((c) => c.id === id);
              const remoteUpdated = remoteTime(clean["updated_at"] ?? clean["updatedAt"]);
              const localUpdated = prev ? remoteTime(prev.updatedAt) : 0;
              if (prev && remoteUpdated <= localUpdated) continue;
              await db.saveCustomer({
                id,
                name: String(clean["name"] ?? prev?.name ?? "عميل"),
                phone: (clean["phone"] as string | undefined) ?? prev?.phone,
                balance: toNumber(clean["balance"] ?? prev?.balance),
                notes: (clean["notes"] as string | undefined) ?? prev?.notes,
                createdAt: String(clean["created_at"] ?? clean["createdAt"] ?? prev?.createdAt ?? new Date().toISOString()),
                updatedAt: String(clean["updated_at"] ?? clean["updatedAt"] ?? new Date().toISOString()),
                synced: true,
              });
            } else {
              const local = await db.getSales().catch(() => [] as Sale[]);
              if (local.some((s) => s.id === id)) continue; // المبيعات سجل تاريخي — لا تُحدَّث من السحب
              await db.saveSale({
                id,
                items: (clean["items"] as never[]) ?? [],
                subtotal: toNumber(clean["subtotal"]),
                discount: toNumber(clean["discount"]),
                netTotal: toNumber(clean["net_total"]),
                profitTotal: toNumber(clean["profit_total"]),
                date: String(clean["date"] ?? new Date().toISOString()),
                notes: (clean["notes"] as string | undefined) ?? undefined,
                customerName: (clean["customer_name"] as string | undefined) ?? undefined,
                invoiceNo: (clean["invoice_no"] as string | undefined) ?? undefined,
                previousBalance: toNumber(clean["previous_balance"]),
                paid: toNumber(clean["paid_amount"]),
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
