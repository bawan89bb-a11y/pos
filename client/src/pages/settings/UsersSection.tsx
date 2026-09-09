import { useState } from "react";
import { trpc } from "../../trpc";
import { useAuth } from "../../lib/auth";
import { Button, EmptyState, Field, inputStyle, Modal, Switch } from "../../components/ui";
import { PAGES, ACTIONS, presetForRole, type Perms, type PageId, type ActionId, type Role } from "@thoth/shared";

export default function UsersSection() {
  const { user: me } = useAuth();
  const usersQuery = trpc.users.list.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.users.update.useMutation();
  const deleteMutation = trpc.users.delete.useMutation();
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [signInAsId, setSignInAsId] = useState<string | null>(null);

  return (
    <div className="p-[18px] max-w-[860px] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
          Users & permissions
        </h2>
        <Button onClick={() => setEditingId("new")}>Add user</Button>
      </div>

      <div className="flex flex-col gap-2">
        {usersQuery.data?.map((u) => {
          const pageCount = PAGES.filter((p) => u.perms[p].view).length;
          const isSelf = u.id === me?.id;
          return (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
                {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1">
                <div className="font-medium">{u.name}</div>
                <div style={{ color: "var(--ink-3)" }}>
                  {u.username} · {u.role} · {pageCount} pages
                </div>
              </div>
              <Switch
                checked={u.active}
                onChange={async (v) => {
                  if (isSelf && !v) return alert("You cannot deactivate your own account.");
                  await updateMutation.mutateAsync({ id: u.id, patch: { active: v } });
                  utils.users.list.invalidate();
                }}
              />
              <button style={{ color: "var(--brand)" }} onClick={() => setSignInAsId(u.id)}>
                Sign in as
              </button>
              <button style={{ color: "var(--brand)" }} onClick={() => setEditingId(u.id)}>
                Edit
              </button>
              {!isSelf && (
                <button
                  style={{ color: "var(--crit)" }}
                  onClick={async () => {
                    if (!confirm(`Delete ${u.name}?`)) return;
                    await deleteMutation.mutateAsync(u.id);
                    utils.users.list.invalidate();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          );
        })}
        {!usersQuery.data?.length && <EmptyState text="No users yet." />}
      </div>

      {(editingId === "new" || (editingId && editingId !== "new")) && (
        <UserEditor userId={editingId === "new" ? null : editingId} onClose={() => setEditingId(null)} />
      )}
      {signInAsId && <SignInAsDialog userId={signInAsId} onClose={() => setSignInAsId(null)} />}
    </div>
  );
}

function SignInAsDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const usersQuery = trpc.users.list.useQuery();
  const target = usersQuery.data?.find((u) => u.id === userId);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sign in as ${target?.name ?? ""}`}
      footer={
        <>
          <span />
          <Button
            onClick={async () => {
              try {
                await login(target!.username, password);
                onClose();
              } catch {
                setError("Incorrect password");
              }
            }}
          >
            Sign in
          </Button>
        </>
      }
    >
      <Field label="Password">
        <input type="password" className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--crit)" }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

function UserEditor({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const usersQuery = trpc.users.list.useQuery();
  const existing = usersQuery.data?.find((u) => u.id === userId);
  const createMutation = trpc.users.create.useMutation();
  const updateMutation = trpc.users.update.useMutation();
  const utils = trpc.useUtils();

  const [name, setName] = useState(existing?.name ?? "");
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [role, setRole] = useState<Role>(existing?.role ?? "Cashier");
  const [active, setActive] = useState(existing?.active ?? true);
  const [perms, setPerms] = useState<Perms>(existing?.perms ?? presetForRole("Cashier"));
  const [error, setError] = useState<string | null>(null);

  function applyPreset(r: Role) {
    setRole(r);
    setPerms(presetForRole(r));
  }

  function togglePerm(page: PageId, action: ActionId) {
    setPerms({ ...perms, [page]: { ...perms[page], [action]: !perms[page][action] } });
  }

  function toggleRow(page: PageId) {
    const allOn = ACTIONS.every((a) => perms[page][a]);
    const next = { ...perms[page] } as Record<ActionId, boolean>;
    ACTIONS.forEach((a) => (next[a] = !allOn));
    setPerms({ ...perms, [page]: next });
  }

  async function save() {
    setError(null);
    if (userId === null && password !== confirmPassword) return setError("Passwords do not match");
    if (userId === null && password.length < 4) return setError("Password must be at least 4 characters");
    if (password && password !== confirmPassword) return setError("Passwords do not match");

    try {
      if (userId) {
        await updateMutation.mutateAsync({ id: userId, patch: { name, username, email, role, active, perms, password: password || undefined } });
      } else {
        await createMutation.mutateAsync({ name, username, password, email, role, active, perms });
      }
      utils.users.list.invalidate();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Could not save this user");
    }
  }

  return (
    <Modal open onClose={onClose} title={userId ? "Edit user" : "Add user"} width={720} footer={<><span className="text-[13px]" style={{ color: "var(--crit)" }}>{error}</span><Button onClick={save}>Save user</Button></>}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Name">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Username">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} placeholder={userId ? "Leave blank to keep current" : ""} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <input type="password" className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role preset">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={role} onChange={(e) => applyPreset(e.target.value as Role)}>
            <option>Owner</option>
            <option>Manager</option>
            <option>Cashier</option>
            <option>Custom</option>
          </select>
        </Field>
      </div>
      <Switch checked={active} onChange={setActive} label="Active" />

      <table className="w-full text-[12px] mt-4">
        <thead>
          <tr className="text-left" style={{ color: "var(--ink-3)" }}>
            <th className="py-1.5"></th>
            {ACTIONS.map((a) => (
              <th key={a} className="py-1.5 text-center capitalize">
                {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAGES.map((p) => (
            <tr key={p} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="py-1.5 capitalize font-medium cursor-pointer" onClick={() => toggleRow(p)}>
                {p}
              </td>
              {ACTIONS.map((a) => (
                <td key={a} className="py-1.5 text-center">
                  <input type="checkbox" checked={perms[p][a]} onChange={() => togglePerm(p, a)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
