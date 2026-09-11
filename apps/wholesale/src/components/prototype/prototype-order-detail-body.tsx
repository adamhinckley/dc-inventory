import { formatMoneyMinorUnits } from "../../lib/format-money";
import { orderLineSubtotalCents, orderSubtotalCents } from "../../lib/order-history";
import type { PrototypeOrder } from "../../lib/prototype/order-history-fixtures";

export function PrototypeOrderDetailBody({ order }: { order: PrototypeOrder }) {
  const currency = order.lines[0]?.currency ?? "USD";
  return (
    <>
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-sm font-semibold text-ink">Ship To</h2>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="block">{order.shipLine1}</span>
          <span className="block">
            {order.shipCity}, {order.shipRegion} {order.shipPostal}
          </span>
          <span className="block">{order.shipCountry}</span>
        </p>
      </section>
      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Order lines</caption>
          <thead className="border-b border-line text-ink-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 text-right font-medium">Qty</th>
              <th className="px-5 py-3 text-right font-medium">Price</th>
              <th className="px-5 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-5 py-3 font-medium text-ink">{line.name}</td>
                <td className="px-5 py-3 text-ink-muted">{line.sku}</td>
                <td className="px-5 py-3 text-right text-ink">{line.qty}</td>
                <td className="px-5 py-3 text-right text-ink">
                  {formatMoneyMinorUnits(line.unitPriceCents, line.currency)}
                </td>
                <td className="px-5 py-3 text-right text-ink">
                  {formatMoneyMinorUnits(
                    orderLineSubtotalCents(line.qty, line.unitPriceCents),
                    line.currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          <p className="text-sm font-semibold text-ink">Subtotal</p>
          <p className="text-base font-semibold text-ink">
            {formatMoneyMinorUnits(orderSubtotalCents(order.lines), currency)}
          </p>
        </div>
      </section>
    </>
  );
}
