import { useQuery } from "@tanstack/react-query";
import type { StatusResponse } from "@/lib/types";

async function fetchStatus(): Promise<StatusResponse> {
  // Use relative URL - Next.js rewrites /api/status to the backend
  const response = await fetch("/api/status");
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
