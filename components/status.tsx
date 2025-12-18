"use client";

import { Badge } from "@/components/ui/badge";
import { useStatus } from "@/hooks/use-status";

export function Status() {
  const { data: status, isLoading, isError } = useStatus();

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
        <span className="text-xs">...</span>
      </Badge>
    );
  }

  if (isError || !status) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-xs">Offline</span>
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
