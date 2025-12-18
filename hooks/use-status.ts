import { useQuery } from "@tanstack/react-query";
import type { StatusResponse } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

async function fetchStatus(): Promise<StatusResponse> {
  const response = await fetch(`${API_URL}/api/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch status: ${response.statusText}`);
  }
  return response.json();
}

export function useStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
    refetchInterval: 30000,
    retry: 2,
  });
}
