import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SheetName = "products" | "categories" | "units" | "companies" | "departments" | "stock_in" | "stock_out" | "inventory";

async function callSheetFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body,
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || "Unknown error");
  return data.data;
}

// Fire-and-forget inventory sync (does not block UI)
function triggerInventorySync() {
  callSheetFunction({ action: "sync_inventory", sheet: "inventory" }).catch((e) => {
    console.warn("Inventory sync failed:", e);
  });
}

const STOCK_SHEETS: SheetName[] = ["stock_in", "stock_out", "products"];

export function useSheetData<T = Record<string, string>>(sheet: SheetName) {
  return useQuery<T[]>({
    queryKey: ["sheets", sheet],
    queryFn: async () => {
      return await callSheetFunction({ action: "read", sheet });
    },
  });
}

export function useSheetCreate(sheet: SheetName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, string>) => {
      return await callSheetFunction({ action: "create", sheet, data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets", sheet] });
      if (STOCK_SHEETS.includes(sheet)) triggerInventorySync();
    },
  });
}

export function useSheetUpdate(sheet: SheetName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      return await callSheetFunction({ action: "update", sheet, id, data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets", sheet] });
      if (STOCK_SHEETS.includes(sheet)) triggerInventorySync();
    },
  });
}

export function useSheetDelete(sheet: SheetName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await callSheetFunction({ action: "delete", sheet, id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets", sheet] });
      if (STOCK_SHEETS.includes(sheet)) triggerInventorySync();
    },
  });
}

export function useSyncInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await callSheetFunction({ action: "sync_inventory", sheet: "inventory" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets", "inventory"] });
    },
  });
}
