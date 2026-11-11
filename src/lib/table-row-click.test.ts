import { afterEach, describe, expect, it } from "vitest";
import { isInteractiveEventTarget, shouldIgnoreRowActivation } from "./table-row-click";

describe("table-row-click", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("treats buttons and links as interactive", () => {
    document.body.innerHTML = `<button type="button">Editar</button>`;
    expect(isInteractiveEventTarget(document.querySelector("button"))).toBe(true);
  });

  it("treats nested content inside a link as interactive", () => {
    document.body.innerHTML = `<a href="#"><span>Imprimir</span></a>`;
    expect(isInteractiveEventTarget(document.querySelector("span"))).toBe(true);
  });

  it("does not treat plain table cells as interactive", () => {
    document.body.innerHTML = `<table><tbody><tr><td>Cliente</td></tr></tbody></table>`;
    expect(isInteractiveEventTarget(document.querySelector("td"))).toBe(false);
  });

  it("ignores activation when the user has selected text", () => {
    const original = window.getSelection.bind(window);
    window.getSelection = () =>
      ({
        toString: () => "Cliente",
      }) as Selection;

    expect(shouldIgnoreRowActivation({ target: null })).toBe(true);
    window.getSelection = original;
  });
});
