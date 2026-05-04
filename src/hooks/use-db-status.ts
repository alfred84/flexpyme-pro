import { useQuery } from "@tanstack/react-query";
import { getDbStatus } from "@/db/queries/db-status";

/**
 * Loads backend database readiness status for health checks.
 */
export function useDbStatus() {
  return useQuery({
    queryKey: ["db-status"],
    queryFn: getDbStatus,
  });
}
