import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";

export default function Login() {
  const { login, loginError, clearLoginError } = useAuth();
  const { data: settings } = useSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      // error surfaced via loginError
    } finally {
      setSubmitting(false);
    }
  }

  const initials = (settings?.store ?? "Thoth POS")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center justify-center h-screen w-screen" style={{ background: "var(--plane)" }}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[380px] p-8 shadow-xl flex flex-col gap-5"
        style={{ background: "var(--surface)", borderRadius: "var(--radius-modal)" }}
      >
        <div className="flex flex-col items-center gap-3 mb-1">
          {settings?.logo ? (
            <img src={settings.logo} alt="" className="w-14 h-14 rounded-xl object-cover" />
          ) : (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-[20px] font-bold"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              {initials}
            </div>
          )}
          <span className="font-semibold text-[16px]" style={{ color: "var(--ink)" }}>
            {settings?.store ?? "Thoth POS"}
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
            Username
          </span>
          <input
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearLoginError();
            }}
            className="w-full px-3 py-2.5 text-[14px] border outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: "var(--radius-control)", color: "var(--ink)" }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearLoginError();
            }}
            className="w-full px-3 py-2.5 text-[14px] border outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: "var(--radius-control)", color: "var(--ink)" }}
          />
        </label>

        {loginError && (
          <p className="text-[13px]" style={{ color: "var(--crit)" }}>
            {loginError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="w-full py-2.5 font-medium text-[14px] disabled:opacity-50"
          style={{ background: "var(--brand)", color: "#fff", borderRadius: "var(--radius-control)" }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
