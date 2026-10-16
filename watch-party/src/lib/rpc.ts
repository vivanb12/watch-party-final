import { supabase } from "@/integrations/supabase/client";

/** Untyped RPC helper — all room and movie logic lives in database functions. */
export async function rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, args ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}
