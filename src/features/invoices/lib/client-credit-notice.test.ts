import { describe, expect, it } from "vitest";
import {
  mergeAdvanceCreditIntoNotice,
  previewClientCreditNotice,
  shouldShowClientCreditNotice,
} from "@/features/invoices/lib/client-credit-notice";

describe("previewClientCreditNotice", () => {
  it("applies existing credit to the due amount", () => {
    const notice = previewClientCreditNotice({
      existingCreditCup: 500,
      applyClientCredit: true,
      balanceDueCup: 200,
      receivedCupEquiv: 0,
      overpaymentDisposition: "change",
    });
    expect(notice.creditToApplyCup).toBe(200);
    expect(notice.creditToAddCup).toBe(0);
    expect(notice.creditAfterCup).toBe(300);
    expect(shouldShowClientCreditNotice(notice)).toBe(true);
  });

  it("adds overpayment as credit when disposition is credit", () => {
    const notice = previewClientCreditNotice({
      existingCreditCup: 0,
      applyClientCredit: true,
      balanceDueCup: 100,
      receivedCupEquiv: 150,
      overpaymentDisposition: "credit",
    });
    expect(notice.creditToAddCup).toBe(50);
    expect(notice.creditAfterCup).toBe(50);
    expect(shouldShowClientCreditNotice(notice)).toBe(true);
  });

  it("does not notify when paying the exact due without credit", () => {
    const notice = previewClientCreditNotice({
      existingCreditCup: 0,
      applyClientCredit: true,
      balanceDueCup: 100,
      receivedCupEquiv: 100,
      overpaymentDisposition: "change",
    });
    expect(shouldShowClientCreditNotice(notice)).toBe(false);
  });

  it("merges advance overpayment into the checkout notice", () => {
    const checkout = previewClientCreditNotice({
      existingCreditCup: 80,
      applyClientCredit: true,
      balanceDueCup: 50,
      receivedCupEquiv: 0,
      overpaymentDisposition: "change",
    });
    const merged = mergeAdvanceCreditIntoNotice(checkout, 25);
    expect(merged.creditToApplyCup).toBe(50);
    expect(merged.creditToAddCup).toBe(25);
    expect(merged.creditAfterCup).toBe(55);
  });
});
