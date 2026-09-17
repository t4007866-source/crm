"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fillDemo = () => {
    setEmail("admin@shisachar.co.il");
    setPassword("ChangeMe!2026");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError(res.error);
    else if (res?.ok) {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bone)" }}>
      <div
        className="hidden md:flex md:w-2/5 flex-col justify-center items-center p-12"
        style={{ background: "var(--ink)" }}
      >
        <div className="text-white text-5xl font-bold mb-4">שי סחר</div>
        <div className="text-white/70 text-lg text-center max-w-xs">
          מערכת ניהול לקוחות, לידים ומכירות
        </div>
        <div className="mt-8 w-16 h-1" style={{ background: "var(--rust)" }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-2">כניסה למערכת</h1>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            הזן את פרטי ההתחברות שלך
          </p>

          {error && (
            <div
              className="mb-4 p-3 rounded-md text-sm"
              style={{ background: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@shisachar.co.il"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "מתחבר..." : "כניסה למערכת"}
            </button>
          </form>

          <button
            onClick={fillDemo}
            className="mt-4 text-sm w-full text-center"
            style={{ color: "var(--rust)" }}
          >
            מילוי פרטי דמו
          </button>

          <div
            className="mt-6 p-3 rounded-md text-xs"
            style={{ background: "#fff8e1", border: "1px solid #ffe082", color: "#795548" }}
          >
            פרטי דמו: admin@shisachar.co.il / ChangeMe!2026
          </div>
        </div>
      </div>
    </div>
  );
}

