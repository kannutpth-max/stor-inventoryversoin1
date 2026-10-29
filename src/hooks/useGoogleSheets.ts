import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SheetName = "products" | "categories" | "units" | "companies" | "departments" | "stock_in" | "stock_out";

// Every sheet is fetched in a single batched edge-function call and shared
// through one React Query cache entry — one Google API read per page load
// instead of one per sheet, keeping us inside Google's read quota.
const ALL_SHEETS: SheetName[] = ["products", "categories", "units", "companies", "departments", "stock_in", "stock_out"];
const ALL_SHEETS_KEY = ["sheets", "__all__"] as const;

type AllSheetsData = Partial<Record<SheetName, Record<string, string>[]>>;

async function fetchAllSheets(): Promise<AllSheetsData> {
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body: { action: "readAll", sheets: ALL_SHEETS },
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || "Unknown error");
  return data.data;
}

export function useSheetData<T = Record<string, string>>(sheet: SheetName) {
  return useQuery<AllSheetsData, Error, T[]>({
    queryKey: ALL_SHEETS_KEY,
    queryFn: fetchAllSheets,
    staleTime: 15_000,
    // Avoid hammering Google's read quota: no refetch on tab focus and at
    // most one spaced-out retry when a read fails.
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 5_000,
    select: (all) => ((all?.[sheet] ?? []) as unknown) as T[],
  });
}

async function callSheetFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("google-sheets", {
    body,
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || "Unknown error");
  return data.data;
}

function useInvalidateSheets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["sheets"] });
}

export function useSheetCreate(sheet: SheetName) {
  const invalidate = useInvalidateSheets();
  return useMutation({
    mutationFn: async (data: Record<string, string>) => {
      return await callSheetFunction({ action: "create", sheet, data });
    },
    onSuccess: invalidate,
  });
}

export function useSheetUpdate(sheet: SheetName) {
  const invalidate = useInvalidateSheets();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      return await callSheetFunction({ action: "update", sheet, id, data });
    },
    onSuccess: invalidate,
  });
}

export function useSheetDelete(sheet: SheetName) {
  const invalidate = useInvalidateSheets();
  return useMutation({
    mutationFn: async (id: string) => {
      return await callSheetFunction({ action: "delete", sheet, id });
    },
    onSuccess: invalidate,
  });
}
