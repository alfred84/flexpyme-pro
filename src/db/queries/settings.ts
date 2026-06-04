import { invoke } from "@tauri-apps/api/core";
import type { CompanySettingsDto } from "@/types/settings";

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
