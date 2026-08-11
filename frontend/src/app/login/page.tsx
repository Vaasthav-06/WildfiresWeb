"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Flame, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.push("/gis");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/gis");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F8FAFC]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Flame className="mx-auto h-10 w-10 text-orange-500" />
          <h1 className="mt-3 text-[22px] font-bold tracking-tight text-slate-900">Admin Login</h1>
          <p className="mt-1 text-[13px] text-slate-500">Wildfire Engine Management Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200/60">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  placeholder="admin@forest.gov"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-blue-600 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
