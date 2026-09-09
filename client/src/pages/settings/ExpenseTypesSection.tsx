import { useState } from "react";
import { trpc } from "../../trpc";
import { Button, inputStyle } from "../../components/ui";

export default function ExpenseTypesSection() {
  const typesQuery = trpc.expenseTypes.list.useQuery();
  const utils = trpc.useUtils();
  const createMutation = trpc.expenseTypes.create.useMutation();
  const updateMutation = trpc.expenseTypes.update.useMutation();
  const deleteMutation = trpc.expenseTypes.delete.useMutation();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2a78d6");

  return (
    <div className="p-[18px] max-w-[560px] flex flex-col gap-4">
      <h2 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
        Expense types
      </h2>
      <div className="flex flex-col gap-2">
        {typesQuery.data?.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-[13px] py-1.5 border-b" style={{ borderColor: "var(--line)" }}>
            <input
              type="color"
              value={t.color}
              className="w-7 h-7 border rounded"
              style={inputStyle}
              onChange={async (e) => {
                await updateMutation.mutateAsync({ id: t.id, patch: { color: e.target.value } });
                utils.expenseTypes.list.invalidate();
              }}
            />
            <input
              className="flex-1 px-2 py-1 border outline-none text-[13px]"
              style={inputStyle}
              defaultValue={t.name}
              onBlur={async (e) => {
                if (e.target.value !== t.name) {
                  await updateMutation.mutateAsync({ id: t.id, patch: { name: e.target.value } });
                  utils.expenseTypes.list.invalidate();
                }
              }}
            />
            <button
              style={{ color: "var(--crit)" }}
              onClick={async () => {
                const reassignTo = typesQuery.data?.find((o) => o.id !== t.id)?.id;
                if (!reassignTo) return alert("Add another type first.");
                if (!confirm(`Delete ${t.name}?`)) return;
                await deleteMutation.mutateAsync({ id: t.id, reassignToId: reassignTo });
                utils.expenseTypes.list.invalidate();
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 border" style={inputStyle} />
        <input className="flex-1 px-3 py-2 text-[14px] border outline-none" style={inputStyle} placeholder="New type name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          onClick={async () => {
            if (!name.trim()) return;
            await createMutation.mutateAsync({ name, color });
            utils.expenseTypes.list.invalidate();
            setName("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
