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

/** دفع العمليات المعلقة (Outbox) ثم سحب الأحدث */
export async function syncNow(userId?: string | null): Promise<{ pushed: number; pulled: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isOnline()) return { pushed: 0, pulled: false };
  const sb = getSupabase();
  if (!sb) return { pushed: 0, pulled: false };

  let pushed = 0;
  try {
    const ops: OutboxOp[] = await db.getOutbox();
    for (const op of ops) {
      try {
        const row = { ...(op.payload as Record<string, unknown>), user_id: userId ?? null };
        if (op.action === "delete") {
          const { error } = await sb.from(op.table).delete().eq("id", (row as { id: string }).id);
          if (error) continue;
        } else {
          const { error } = await sb.from(op.table).upsert(row, { onConflict: "id" });
          if (error) continue;
        }
        await db.removeOutbox(op.id);
        pushed += 1;
      } catch {
        // اترك العملية للمرة القادمة
      }
    }

    // سحب (دمج بسيط: الأحدث يفوز حسب updatedAt/date)
    try {
      const query = userId
        ? { eq: "user_id" as const, val: userId }
        : null;
      for (const table of ["products", "purchases", "sales"] as const) {
        let q = sb.from(table).select("*").limit(500);
        if (query) q = q.eq(query.eq, query.val);
        const { data } = await q;
        if (Array.isArray(data)) {
          for (const row of data) {
            try {
              const clean = row as Record<string, unknown>;
              if (table === "products") {
                const local = await db.getProducts();
                const exists = local.find((p) => p.id === clean.id);
                if (!exists) {
                  await db.saveProduct({
                    id: String(clean.id ?? ""),
                    name: String(clean.name ?? ""),
                    barcode: (clean.barcode as string) ?? undefined,
                    purchasePrice: Number(clean.purchasePrice ?? clean.purchase_price ?? 0) || 0,
                    salePrice: Number(clean.salePrice ?? clean.sale_price ?? 0) || 0,
                    stock: Number(clean.stock ?? 0) || 0,
                    supplier: (clean.supplier as string) ?? undefined,
                    createdAt: String(clean.createdAt ?? clean.created_at ?? new Date().toISOString()),
                    updatedAt: String(clean.updatedAt ?? clean.updated_at ?? new Date().toISOString()),
                    synced: true,
                  });
                }
              }
            } catch { /* ignore row */ }
          }
        }
      }
    } catch { /* السحب اختياري */ }

    return { pushed, pulled: true };
  } catch (e) {
    return { pushed, pulled: false, error: e instanceof Error ? e.message : "sync failed" };
  }
}
