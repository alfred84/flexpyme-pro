import { useEffect, useState } from "react";
import { cupToUsd, roundMoney, usdToCup } from "@/lib/currency";
import { formatMoney, moneyHeading } from "@/lib/format-money";

interface SalePriceInputProps {
  /** Precio unitario almacenado en CUP (libro del pedido). */
  valueCup: string;
  /** Tasa USD→CUP vigente. */
  rate: number;
  /** Deshabilita edición. */
  disabled?: boolean;
  /** Placeholder del input. */
  placeholder?: string;
  /** Callback con el precio en CUP. */
  onChangeCup: (valueCup: string) => void;
  /** Clase del input. */
  className?: string;
}

/**
 * Formatea un número para edición (hasta 2 decimales, sin forzar ceros).
 *
 * @param value - Importe.
 * @returns Texto editable.
 */
function toEditable(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return value === 0 ? "0" : "";
  }
  return String(roundMoney(value));
}

/**
 * Input de precio de venta: edita en USD y muestra el equivalente en CUP.
 * Persiste el valor en CUP para el libro del pedido.
 *
 * Si no hay tasa usable, edita directamente en CUP.
 *
 * @param props - Valor CUP, tasa y callback.
 * @returns Control de precio dual.
 */
export function SalePriceInput(props: SalePriceInputProps) {
  const {
    valueCup,
    rate,
    disabled = false,
    placeholder = "Precio",
    onChangeCup,
    className = "input input-bordered input-xs w-24",
  } = props;

  const useUsd = rate > 0;
  const cupNum = Number.parseFloat(valueCup.replace(",", "."));
  const hasCup = valueCup.trim() !== "" && Number.isFinite(cupNum);
  const usdNum = hasCup ? cupToUsd(cupNum, rate) : 0;

  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!focused) {
      setDraft(hasCup ? toEditable(useUsd ? usdNum : cupNum) : "");
    }
  }, [focused, hasCup, useUsd, usdNum, cupNum]);

  /**
   * Propaga el texto del input al valor CUP persistido.
   *
   * @param raw - Texto del input.
   */
  function commitDraft(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "." || trimmed === ",") {
      onChangeCup("");
      return;
    }
    const parsed = Number.parseFloat(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      return;
    }
    if (useUsd) {
      onChangeCup(String(usdToCup(parsed, rate)));
      return;
    }
    onChangeCup(String(roundMoney(parsed)));
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          className={className}
          placeholder={placeholder}
          disabled={disabled}
          value={focused ? draft : hasCup ? toEditable(useUsd ? usdNum : cupNum) : ""}
          onFocus={() => {
            setFocused(true);
            setDraft(hasCup ? toEditable(useUsd ? usdNum : cupNum) : "");
          }}
          onBlur={() => {
            setFocused(false);
            commitDraft(draft);
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            commitDraft(next);
          }}
          aria-label={useUsd ? moneyHeading("Precio", "USD") : moneyHeading("Precio", "CUP")}
        />
        <span className="text-[10px] text-base-content/60">{useUsd ? "USD" : "CUP"}</span>
      </div>
      {useUsd && hasCup ? (
        <span className="text-[10px] text-base-content/50">{formatMoney(cupNum, "CUP")}</span>
      ) : null}
    </div>
  );
}
