/**
 * Shared payload returned by database readiness command.
 */
export interface DbStatusPayload {
  status: "ready" | "browser-dev";
  dbPath: string;
}
