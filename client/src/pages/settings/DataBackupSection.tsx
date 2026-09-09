import { useRef, useState } from "react";
import { trpc } from "../../trpc";
import { useAuth } from "../../lib/auth";
import { can } from "@thoth/shared";
import { Button } from "../../components/ui";

export default function DataBackupSection() {
  const { user } = useAuth();
  const countsQuery = trpc.settings.recordCounts.useQuery();
  const utils = trpc.useUtils();
  const exportMutation = trpc.settings.exportBackup.useQuery(undefined, { enabled: false });
  const restoreMutation = trpc.settings.restoreBackup.useMutation();
  const resetMutation = trpc.settings.resetDemoData.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function downloadBackup() {
    const { data } = await exportMutation.refetch();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `thoth-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("This replaces all products, sales, customers and expenses with the backup file. Continue?")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        const data = JSON.parse(String(reader.result));
        await restoreMutation.mutateAsync(data);
        utils.invalidate();
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  }

  async function resetDemo() {
    if (!confirm("Reset all data to the original demo dataset? This cannot be undone.")) return;
    setBusy(true);
    try {
      await resetMutation.mutateAsync();
      utils.invalidate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-[18px] max-w-[640px] flex flex-col gap-5">
      <h2 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
        Data & backup
      </h2>

      <div className="rounded-[10px] p-4 grid grid-cols-3 gap-3 text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        {countsQuery.data &&
          Object.entries(countsQuery.data).map(([key, count]) => (
            <div key={key}>
              <div style={{ color: "var(--ink-3)" }} className="capitalize">
                {key.replace(/([A-Z])/g, " $1")}
              </div>
              <div className="tabular-nums font-semibold">{count as number}</div>
            </div>
          ))}
      </div>

      {can(user?.perms, "settings", "export") && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            Backup
          </h3>
          <Button variant="secondary" onClick={downloadBackup}>
            Download JSON backup
          </Button>
        </div>
      )}

      {can(user?.perms, "settings", "edit") && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            Restore
          </h3>
          <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
            Restoring replaces products, brands, suppliers, customers, sales, expenses and quick keys with the
            contents of the backup file.
          </p>
          <input ref={fileRef} type="file" accept="application/json" disabled={busy} onChange={onRestoreFile} />
        </div>
      )}

      {can(user?.perms, "settings", "delete") && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            Reset to demo data
          </h3>
          <div>
            <Button variant="destructive" disabled={busy} onClick={resetDemo}>
              Reset to demo data
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
