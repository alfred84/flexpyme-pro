import { invoke } from "@tauri-apps/api/core";
import type { CompanySettingsDto } from "@/types/settings";

export interface BackupInfoDto {
  fileName: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  kind: string;
}

export interface BackupOverviewDto {
  dbPath: string;
  backupDir: string;
  intervalDays: number;
  lastScheduledBackupAt: string | null;
  backups: BackupInfoDto[];
}

export interface RestoreDatabaseDto {
  restoredPath: string;
  safetyBackupPath: string;
}

export async function fetchCompanySettings(): Promise<CompanySettingsDto> {
  return invoke<CompanySettingsDto>("settings_get_company");
}

export async function saveCompanySettings(payload: CompanySettingsDto): Promise<void> {
  return invoke<void>("settings_save_company", { payload });
}

/**
 * Reads all key-value settings as a record (business profile, currency, USD rate, theme).
 */
export async function fetchAllSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("settings_get_all");
}

/**
 * Upserts a single setting key/value pair.
 */
export async function setSettingValue(key: string, value: string): Promise<void> {
  return invoke<void>("settings_set_value", { key, value });
}

/**
 * Creates a timestamped backup copy of the database, returning its path.
 */
export async function backupDatabase(): Promise<string> {
  return invoke<string>("settings_backup_database");
}

/** Returns backup settings and the five most recent backup files. */
export async function fetchBackupOverview(): Promise<BackupOverviewDto> {
  return invoke<BackupOverviewDto>("settings_get_backup_overview");
}

/** Persists the automatic backup interval in days. */
export async function setBackupIntervalDays(days: number): Promise<BackupOverviewDto> {
  return invoke<BackupOverviewDto>("settings_set_backup_interval_days", { days });
}

/** Runs a scheduled backup only when the configured interval has elapsed. */
export async function runScheduledBackupIfDue(): Promise<BackupInfoDto | null> {
  return invoke<BackupInfoDto | null>("settings_run_scheduled_backup_if_due");
}

/** Restores a compatible SQLite database over the active `flexpyme.db`. */
export async function restoreDatabase(sourcePath: string): Promise<RestoreDatabaseDto> {
  return invoke<RestoreDatabaseDto>("settings_restore_database", { sourcePath });
}

/** Copies logo image to app data and stores path in settings. */
export async function updateBusinessLogo(sourcePath: string): Promise<string> {
  return invoke<string>("update_business_logo", { sourcePath });
}

/** Clears business logo setting. */
export async function removeBusinessLogo(): Promise<void> {
  return invoke("remove_business_logo");
}

/** Returns absolute path of the active SQLite database. */
export async function getDbLocation(): Promise<string> {
  return invoke<string>("get_db_location");
}

/** Opens the folder that contains the database file. */
export async function openDbFolder(): Promise<void> {
  return invoke("open_db_folder");
}

