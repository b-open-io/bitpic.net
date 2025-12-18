"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { StatusResponse } from "@/lib/api";
import { api } from "@/lib/api";

export function Status() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      const data = await api.getStatus();
      setStatus(data);
      setLoading(false);
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading || !status) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
        <span className="text-xs">Loading...</span>
      </Badge>
    );
  }

  const getStatusColor = () => {
    if (!status.connected) return "bg-red-500";
    if (status.syncing) return "bg-amber-500";
    return "bg-green-500";
  };

  const getStatusText = () => {
    if (!status.connected) return "Disconnected";
    if (status.syncing)
      return `Syncing (${status.blockHeight.toLocaleString()})`;
    return `Block ${status.blockHeight.toLocaleString()}`;
  };

  return (
    <Badge variant="outline" className="gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${getStatusColor()}`} />
      <span className="text-xs">{getStatusText()}</span>
    </Badge>
  );
}
