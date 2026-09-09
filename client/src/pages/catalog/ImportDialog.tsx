import { useRef, useState } from "react";
import { trpc } from "../../trpc";
import { Modal, Button } from "../../components/ui";
import { parseCsvToObjects, toCsv } from "@thoth/shared";

export function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = trpc.products.import.useMutation();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsvToObjects(String(reader.result)));
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = toCsv(
      ["Name", "SKU", "Category", "Brand", "Supplier", "Cost", "Retail", "Stock", "Tags", "Expiry"],
      [["Sample Product", "SKU-001", "Grocery", "Brand Co", "Main Supplier", "1.50", "3.00", "20", "sample,demo", ""]]
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "products-template.csv";
    a.click();
  }

  async function doImport() {
    if (!rows) return;
    const payload = rows.map((r) => ({
      name: r.Name ?? "",
      sku: r.SKU ?? "",
      category: r.Category ?? "",
      brand: r.Brand ?? "",
      supplier: r.Supplier ?? "",
      cost: Math.round(parseFloat(r.Cost || "0") * 100),
      retail: Math.round(parseFloat(r.Retail || "0") * 100),
      stock: Number(r.Stock || 0),
      tags: (r.Tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      expiry: r.Expiry || null,
    }));
    const res = await importMutation.mutateAsync(payload);
    setResult(res);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import products"
      footer={
        result ? (
          <>
            <span />
            <Button onClick={onDone}>Done</Button>
          </>
        ) : (
          <>
            <button className="text-[13px]" style={{ color: "var(--brand)" }} onClick={downloadTemplate}>
              Download template
            </button>
            <Button disabled={!rows?.length} onClick={doImport}>
              Import {rows?.length ?? 0} rows
            </Button>
          </>
        )
      }
    >
      {result ? (
        <p className="text-[14px]">
          Imported {result.created} products. Skipped {result.skipped} rows with no name or SKU.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            CSV header: Name, SKU, Category, Brand, Supplier, Cost, Retail, Stock, Tags, Expiry. Unknown brands and
            suppliers are created automatically; rows without a name are skipped.
          </p>
          <input ref={fileRef} type="file" accept=".csv" onChange={onFile} />
          {rows && (
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
              {rows.length} rows ready to import.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
