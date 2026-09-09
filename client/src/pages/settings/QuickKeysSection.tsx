import { useState } from "react";
import { trpc } from "../../trpc";
import { Button, Field, inputStyle, Modal, Switch } from "../../components/ui";
import type { QuickKeyLayout, QuickKeyPage, QuickKey } from "@thoth/shared";

export default function QuickKeysSection() {
  const settingsQuery = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation();
  const layoutsQuery = trpc.quickKeys.list.useQuery();
  const utils = trpc.useUtils();
  const createMutation = trpc.quickKeys.create.useMutation();
  const copyMutation = trpc.quickKeys.copy.useMutation();
  const deleteMutation = trpc.quickKeys.delete.useMutation();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="p-[18px] max-w-[900px] flex flex-col gap-5">
      <div>
        <h2 className="text-[16px] font-semibold mb-1" style={{ color: "var(--ink)" }}>
          Quick keys
        </h2>
        <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
          Assign products as quick keys to help process sales faster. Rename, reposition and recolor keys, or
          organize your buttons into folders and pages.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={!!settingsQuery.data?.quickKeys} onChange={(v) => updateSettings.mutate({ quickKeys: v })} />
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            Enable quick keys for this register
          </div>
          <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
            Toggle the switch to enable your Quick Keys for your register. You can turn this back on at anytime
            without losing your settings.
          </div>
        </div>
      </div>

      <div>
        <Button
          onClick={async () => {
            const name = prompt("Layout name", "New layout");
            if (!name) return;
            await createMutation.mutateAsync({ name });
            utils.quickKeys.list.invalidate();
          }}
        >
          Add layout
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {layoutsQuery.data?.map((l) => (
          <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="flex-1">
              <div className="font-medium">{l.name}</div>
              <div style={{ color: "var(--ink-3)" }}>
                {l.pages.length} page{l.pages.length === 1 ? "" : "s"} ·{" "}
                {l.pages.reduce((s, p) => s + p.keys.filter(Boolean).length, 0)} keys
              </div>
            </div>
            <button
              style={{ color: "var(--brand)" }}
              onClick={() => {
                updateSettings.mutate({ activeLayoutId: l.id });
              }}
            >
              Use
            </button>
            <button style={{ color: "var(--brand)" }} onClick={() => setEditingId(l.id)}>
              Edit
            </button>
            <button
              style={{ color: "var(--ink-3)" }}
              onClick={async () => {
                await copyMutation.mutateAsync(l.id);
                utils.quickKeys.list.invalidate();
              }}
            >
              Copy
            </button>
            <button
              style={{ color: "var(--crit)" }}
              onClick={async () => {
                if (!confirm(`Delete layout "${l.name}"?`)) return;
                await deleteMutation.mutateAsync(l.id);
                utils.quickKeys.list.invalidate();
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {editingId && <LayoutEditor layoutId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function LayoutEditor({ layoutId, onClose }: { layoutId: string; onClose: () => void }) {
  const layoutQuery = trpc.quickKeys.get.useQuery(layoutId);
  const productsQuery = trpc.products.list.useQuery({ status: "active" });
  const updateMutation = trpc.quickKeys.update.useMutation();
  const utils = trpc.useUtils();

  const [pages, setPages] = useState<QuickKeyPage[] | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [folderStack, setFolderStack] = useState<QuickKey[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  if (!layoutQuery.data) return null;
  const currentPages = pages ?? layoutQuery.data.pages;
  if (!pages) setPages(layoutQuery.data.pages);

  const page = currentPages[pageIdx];
  const container = folderStack.length ? folderStack[folderStack.length - 1] : page;
  const keys = container?.keys ?? [];

  function setKeysInContainer(newKeys: (QuickKey | null)[]) {
    if (!pages) return;
    const nextPages = [...pages];
    if (folderStack.length === 0) {
      nextPages[pageIdx] = { ...nextPages[pageIdx], keys: newKeys };
      setPages(nextPages);
    } else {
      // update the folder object nested inside the current page's keys
      const newFolder = { ...folderStack[folderStack.length - 1], keys: newKeys };
      const newStack = [...folderStack.slice(0, -1), newFolder];
      const pageKeys = [...(nextPages[pageIdx].keys ?? [])];
      const idx = pageKeys.findIndex((k) => k?.id === newFolder.id);
      if (idx >= 0) pageKeys[idx] = newFolder;
      nextPages[pageIdx] = { ...nextPages[pageIdx], keys: pageKeys };
      setPages(nextPages);
      setFolderStack(newStack);
    }
  }

  function assignSlot(i: number) {
    const type = prompt("Type 'product' or 'folder'", "product");
    if (type === "folder") {
      const label = prompt("Folder name", "Folder") ?? "Folder";
      const next = [...keys];
      next[i] = { id: cryptoId(), type: "folder", label, color: "#5433eb", keys: Array(20).fill(null) };
      setKeysInContainer(next);
    } else if (type === "product") {
      const sku = prompt("Product SKU to assign");
      const product = productsQuery.data?.find((p) => p.sku === sku);
      if (!product) return alert("No product with that SKU");
      const next = [...keys];
      next[i] = { id: cryptoId(), type: "product", label: product.name, color: product.color, productId: product.id };
      setKeysInContainer(next);
    }
  }

  function editSlot(i: number) {
    const key = keys[i];
    if (!key) return;
    const action = prompt("Type 'rename', 'recolor' or 'remove'", "rename");
    const next = [...keys];
    if (action === "remove") {
      next[i] = null;
    } else if (action === "recolor") {
      const color = prompt("New color (hex)", key.color) ?? key.color;
      next[i] = { ...key, color };
    } else {
      const label = prompt("New label", key.label) ?? key.label;
      next[i] = { ...key, label };
    }
    setKeysInContainer(next);
  }

  function onDrop(i: number) {
    if (dragFrom === null || dragFrom === i) return;
    const next = [...keys];
    [next[dragFrom], next[i]] = [next[i], next[dragFrom]];
    setKeysInContainer(next);
    setDragFrom(null);
  }

  async function save() {
    if (!pages) return;
    await updateMutation.mutateAsync({ id: layoutId, pages });
    utils.quickKeys.list.invalidate();
    onClose();
  }

  function addPage() {
    if (!pages) return;
    const name = prompt("Page name", `Page ${pages.length + 1}`);
    if (!name) return;
    setPages([...pages, { id: cryptoId(), name, keys: Array(20).fill(null) }]);
  }

  function deletePage() {
    if (!pages || pages.length <= 1) return alert("Can't delete the last page.");
    if (!confirm(`Delete "${page.name}"?`)) return;
    const next = pages.filter((_, i) => i !== pageIdx);
    setPages(next);
    setPageIdx(0);
  }

  return (
    <Modal open onClose={onClose} title={`Edit layout · ${layoutQuery.data.name}`} width={620} footer={<><span /><Button onClick={save}>Save layout</Button></>}>
      <div className="flex items-center gap-3 mb-3">
        {folderStack.length > 0 ? (
          <button className="text-[12px]" style={{ color: "var(--brand)" }} onClick={() => setFolderStack(folderStack.slice(0, -1))}>
            ← Back
          </button>
        ) : (
          <>
            {currentPages.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setPageIdx(i)}
                className="text-[12px] font-medium px-2 py-1 rounded"
                style={{ background: i === pageIdx ? "var(--brand-soft)" : "transparent", color: i === pageIdx ? "var(--brand)" : "var(--ink-2)" }}
              >
                {p.name}
              </button>
            ))}
            <button className="text-[12px]" style={{ color: "var(--brand)" }} onClick={addPage}>
              + Page
            </button>
            <button className="text-[12px]" style={{ color: "var(--ink-3)" }} onClick={deletePage}>
              Delete page
            </button>
          </>
        )}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(5, 78px)" }}>
        {keys.map((key, i) => (
          <div
            key={i}
            draggable={!!key}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            onClick={() => (key ? (key.type === "folder" ? setFolderStack([...folderStack, key]) : editSlot(i)) : assignSlot(i))}
            className="rounded-md flex flex-col items-center justify-center text-[10.5px] font-medium text-center px-1 cursor-pointer select-none"
            style={{
              width: 78,
              height: 78,
              background: key ? key.color + "22" : "var(--surface-2)",
              border: key ? `1px solid ${key.color}` : "1px dashed var(--line-2)",
              color: "var(--ink)",
            }}
          >
            {key ? key.label : "+"}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function cryptoId() {
  return `qkk_${Math.random().toString(36).slice(2, 11)}`;
}
