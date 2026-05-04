import { invoke } from "@tauri-apps/api/core";
import type { CompanySettingsDto } from "@/types/settings";

export async function fetchCompanySettings(): Promise<CompanySettingsDto> {
  return invoke<CompanySettingsDto>("settings_get_company");
}

export async function saveCompanySettings(payload: CompanySettingsDto): Promise<void> {
  return invoke<void>("settings_save_company", { payload });
}
