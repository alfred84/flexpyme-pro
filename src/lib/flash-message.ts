export type FlashKind = "success" | "error" | "info";

export interface FlashMessage {
  kind: FlashKind;
  text: string;
}

const FLASH_KEY = "flexpyme.flash";

export function pushFlashMessage(message: FlashMessage): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(FLASH_KEY, JSON.stringify(message));
}

export function popFlashMessage(): FlashMessage | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(FLASH_KEY);
  if (!raw) {
    return null;
  }
  window.sessionStorage.removeItem(FLASH_KEY);
  try {
    const parsed = JSON.parse(raw) as FlashMessage;
    if (!parsed?.kind || !parsed?.text) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
