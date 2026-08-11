import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { Building2 } from "lucide-react";
import { BusinessLogo } from "@/components/common/BusinessLogo";
import { fetchInvoiceDetail } from "@/db/queries/invoices";
import { fetchAllSettings, fetchCompanySettings } from "@/db/queries/settings";
import {
  formatInvoiceAmountOrDash,
  resolveInvoiceDualAmounts,
} from "@/features/invoices/lib/invoice-dual-amounts";
import { pushFlashMessage } from "@/lib/flash-message";
import { formatDate } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import {
  invoiceFinancialLabel,
  invoiceFinancialStatus,
} from "@/lib/invoice-financial-status";

/**
 * Vista imprimible del pedido/factura; el botón Imprimir usa `window.print()`.
 *
 * Muestra montos reales CUP/USD de cobro (sin conversión por tasa de app).
 *
 * @returns Página de impresión.
 */
export function InvoicePrintPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fromFacturas = pathname.includes("/facturas/");

  const detailQuery = useQuery({
    queryKey: ["invoices", "detail", invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });

  const companyQuery = useQuery({
    queryKey: ["settings", "company"],
    queryFn: fetchCompanySettings,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings", "all"],
    queryFn: fetchAllSettings,
  });

  const logoPath = settingsQuery.data?.business_logo_path?.trim() || null;
  const logoVersion = settingsQuery.data?.business_logo_version?.trim() || null;

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de factura no válido.</span>
      </div>
    );
  }

  const inv = detailQuery.data?.invoice;
  const items = detailQuery.data?.items ?? [];
  const co = companyQuery.data;
  const hasCompanyHeader =
    co &&
    (co.companyName.trim() ||
      co.companyRnc.trim() ||
      co.companyPhone.trim() ||
      co.companyAddress.trim());
  const dual = inv ? resolveInvoiceDualAmounts(inv) : null;
  const fin = inv
    ? invoiceFinancialStatus(
        inv.balance,
        inv.paid,
        inv.status === "anulada" || Boolean(inv.cancelledAt),
      )
    : null;

  return (
    <div className="invoice-print-root">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {fromFacturas ? (
          <Link
            to="/facturas/$invoiceId"
            params={{ invoiceId: String(invoiceId) }}
            className="btn btn-ghost btn-sm"
          >
            Volver a factura
          </Link>
        ) : (
          <Link
            to="/pedidos/$invoiceId"
            params={{ invoiceId: String(invoiceId) }}
            className="btn btn-ghost btn-sm"
          >
            Volver al pedido
          </Link>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => window.print()}
          disabled={!inv}
        >
          Imprimir
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={!inv}
          onClick={() => {
            void invoke<string>("export_invoice_pdf", { id: invoiceId }).then((path) => {
              pushFlashMessage({ kind: "success", text: `PDF guardado: ${path}` });
            });
          }}
        >
          Guardar PDF
        </button>
      </div>

      {detailQuery.isLoading && <p className="print:hidden">Cargando...</p>}
      {detailQuery.isError && (
        <div className="alert alert-error print:hidden">
          <span>No se pudo cargar la factura.</span>
        </div>
      )}

      {inv && dual && (
        <article className="invoice-print-sheet rounded-lg border border-base-300 bg-base-100 p-6 shadow-sm print:border-0 print:bg-white print:p-0 print:shadow-none">
          <header className="mb-6 border-b border-base-300 pb-4 print:mb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-3">
                {logoPath && (
                  <BusinessLogo
                    path={logoPath}
                    version={logoVersion}
                    size="md"
                    fallbackIcon={Building2}
                    className="print:h-14 print:w-14"
                  />
                )}
                <div>
                  {hasCompanyHeader && co ? (
                    <div className="mb-2 space-y-0.5 print:text-black">
                      {co.companyName.trim() && (
                        <p className="text-xl font-bold">{co.companyName.trim()}</p>
                      )}
                      {co.companyRnc.trim() && (
                        <p className="text-sm text-base-content/80 print:text-gray-700">
                          RNC: {co.companyRnc.trim()}
                        </p>
                      )}
                      {co.companyPhone.trim() && (
                        <p className="text-sm text-base-content/80 print:text-gray-700">
                          Tel: {co.companyPhone.trim()}
                        </p>
                      )}
                      {co.companyAddress.trim() && (
                        <p className="whitespace-pre-wrap text-sm text-base-content/80 print:text-gray-700">
                          {co.companyAddress.trim()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-base-content/70 print:text-gray-600">FlexPyme Pro</p>
                  )}
                  <h1 className="text-2xl font-bold print:text-black">
                    {fromFacturas ? "Factura" : "Pedido"}
                  </h1>
                  <p className="font-mono text-lg print:text-black">{inv.invoiceNumber}</p>
                </div>
              </div>
              <div className="text-right text-sm print:text-black">
                <p>
                  <span className="text-base-content/60">Fecha:</span> {formatDate(inv.date)}
                </p>
                <p>
                  <span className="text-base-content/60">Estado:</span>{" "}
                  {fin ? invoiceFinancialLabel(fin) : inv.paymentStatus}
                </p>
                {inv.paymentCurrency && (
                  <p>
                    <span className="text-base-content/60">Cobro:</span>{" "}
                    <span className="uppercase">{inv.paymentCurrency}</span>
                  </p>
                )}
                {dual.rate > 0 && (
                  <p>
                    <span className="text-base-content/60">Tasa:</span> {formatAmount(dual.rate)}{" "}
                    CUP / USD
                  </p>
                )}
              </div>
            </div>
          </header>

          <section className="mb-6 grid gap-4 sm:grid-cols-2 print:text-black">
            <div>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60 print:text-gray-600">
                Cliente
              </h2>
              <p className="font-medium">{inv.clientName}</p>
              {inv.notes && (
                <div className="mt-2 text-sm">
                  <p className="text-base-content/60 print:text-gray-600">Notas</p>
                  <p className="whitespace-pre-wrap">{inv.notes}</p>
                </div>
              )}
            </div>
            <div>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60 print:text-gray-600">
                Totales (cobro real)
              </h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt>{moneyHeading("Total", "CUP")}</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmountOrDash(dual.dueCup, formatAmount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>{moneyHeading("Total", "USD")}</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmountOrDash(dual.dueUsd, formatAmount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>{moneyHeading("Pagado", "CUP")}</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmountOrDash(dual.paidCup, formatAmount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>{moneyHeading("Pagado", "USD")}</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmountOrDash(dual.paidUsd, formatAmount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-base-300 pt-2 font-semibold print:border-gray-300">
                  <dt>{moneyHeading("Pendiente", "CUP")}</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmountOrDash(dual.balanceCup, formatAmount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 font-semibold">
                  <dt>{moneyHeading("Pendiente", "USD")}</dt>
                  <dd className="tabular-nums">
                    {formatInvoiceAmountOrDash(dual.balanceUsd, formatAmount)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="table table-sm w-full print:text-black">
              <thead>
                <tr className="border-b print:break-inside-avoid">
                  <th className="text-left">Categoría</th>
                  <th className="text-left">Formato</th>
                  <th className="text-left">Tipo de trabajo</th>
                  <th className="text-left">Acabado</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">{moneyHeading("P. unit.", "USD")}</th>
                  <th className="text-right">{moneyHeading("P. unit.", "CUP")}</th>
                  <th className="text-right">{moneyHeading("Subtotal", "CUP")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((line) => (
                  <tr key={line.id} className="print:break-inside-avoid">
                    <td>{line.categoryName}</td>
                    <td>{line.formatLabel ?? "—"}</td>
                    <td>{line.service ?? "—"}</td>
                    <td>{line.finish ?? "—"}</td>
                    <td className="text-right">{line.quantity}</td>
                    <td className="text-right tabular-nums">
                      {formatInvoiceAmountOrDash(line.unitPriceUsd, formatAmount)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatInvoiceAmountOrDash(line.unitPrice, formatAmount)}
                    </td>
                    <td className="text-right tabular-nums">{formatAmount(line.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}
