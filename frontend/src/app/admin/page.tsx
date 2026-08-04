"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion } from "framer-motion";
import {
  Users, Map, Shield, Database, Plus, Trash2, RefreshCw,
  LogOut, UserPlus, CheckCircle2, XCircle, Activity,
} from "lucide-react";

interface Zone { id: number; name: string; type: string; state?: string; district?: string; area_ha?: number; metadata: Record<string, unknown> }
interface User { id: number; email: string; role: string; full_name?: string; is_active: boolean }
interface Stats { zones: number; users: number; alerts: number }

const ZONE_TYPES = ["core_forest", "buffer_zone", "eco_sensitive", "beat_boundary", "range_boundary", "compartment"];

export default function AdminPage() {
  const { user, isAuthenticated, isLoading, logout, getHeaders } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"zones" | "users" | "system">("zones");
  const [zones, setZones] = useState<Zone[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  const fetchZones = useCallback(async () => {
    const r = await fetch(api("/api/v1/admin/zones"), { headers: getHeaders() });
    if (r.ok) setZones(await r.json());
  }, [getHeaders]);

  const fetchUsers = useCallback(async () => {
    const r = await fetch(api("/api/v1/auth/users"), { headers: getHeaders() });
    if (r.ok) setUsers(await r.json());
  }, [getHeaders]);

  const fetchStats = useCallback(async () => {
    const r = await fetch(api("/api/v1/admin/stats"), { headers: getHeaders() });
    if (r.ok) setStats(await r.json());
  }, [getHeaders]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchZones();
    fetchUsers();
    fetchStats();
  }, [isAuthenticated, fetchZones, fetchUsers, fetchStats]);

  const deleteZone = async (id: number) => {
    await fetch(api(`/api/v1/admin/zones/${id}`), { method: "DELETE", headers: getHeaders() });
    fetchZones();
    fetchStats();
  };

  const toggleUser = async (id: number, active: boolean) => {
    await fetch(api(`/api/v1/auth/users/${id}`), {
      method: "PUT",
      headers: { ...getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !active }),
    });
    fetchUsers();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              {user?.email} · {user?.role}
            </p>
          </div>
          <button onClick={logout} className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Zones", value: stats.zones, icon: Map, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Users", value: stats.users, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Alerts", value: stats.alerts, icon: Activity, color: "text-orange-600", bg: "bg-orange-50" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                <p className="text-[28px] font-bold tabular-nums text-slate-800">{s.value}</p>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {[
            { key: "zones" as const, label: "Zones", icon: Map },
            { key: "users" as const, label: "Users", icon: Users },
            { key: "system" as const, label: "System", icon: Shield },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors rounded-t-lg ${
                tab === t.key ? "text-blue-600 bg-white border border-b-white -mb-px" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Zones Tab */}
        {tab === "zones" && (
          <div className="rounded-xl bg-white ring-1 ring-slate-200/60 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-700">{zones.length} zones</p>
              <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700">
                <Plus className="h-3 w-3" /> Add Zone
              </button>
            </div>
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-2.5 font-semibold text-slate-600">Name</th>
                  <th className="px-5 py-2.5 font-semibold text-slate-600">Type</th>
                  <th className="px-5 py-2.5 font-semibold text-slate-600">State</th>
                  <th className="px-5 py-2.5 font-semibold text-slate-600">Area (ha)</th>
                  <th className="px-5 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {zones.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No zones created yet</td></tr>
                )}
                {zones.map((z) => (
                  <tr key={z.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-2.5 font-medium text-slate-700">{z.name}</td>
                    <td className="px-5 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{z.type}</span></td>
                    <td className="px-5 py-2.5 text-slate-500">{z.state || "—"}</td>
                    <td className="px-5 py-2.5 text-slate-500">{z.area_ha?.toLocaleString() || "—"}</td>
                    <td className="px-5 py-2.5">
                      <button onClick={() => deleteZone(z.id)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="rounded-xl bg-white ring-1 ring-slate-200/60 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-700">{users.length} users</p>
            </div>
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-2.5 font-semibold text-slate-600">Email</th>
                  <th className="px-5 py-2.5 font-semibold text-slate-600">Role</th>
                  <th className="px-5 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-5 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No users found</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-700">{u.email}</td>
                    <td className="px-5 py-2.5"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{u.role}</span></td>
                    <td className="px-5 py-2.5">
                      {u.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" /> Disabled</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <button onClick={() => toggleUser(u.id, u.is_active)} className="text-[11px] font-medium text-blue-600 hover:text-blue-800">
                        {u.is_active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* System Tab */}
        {tab === "system" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white ring-1 ring-slate-200/60 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-blue-600" />
                  <p className="text-[13px] font-bold text-slate-700">Database</p>
                </div>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-slate-500">Provider</span><span className="font-medium text-slate-700">NeonDB Postgres</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">PostGIS</span><span className="font-medium text-emerald-600">Enabled</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-medium text-emerald-600">Connected</span></div>
                </div>
              </div>

              <div className="rounded-xl bg-white ring-1 ring-slate-200/60 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="text-[13px] font-bold text-slate-700">Authentication</p>
                </div>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-medium text-slate-700">JWT (HS256)</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Access TTL</span><span className="font-medium text-slate-700">15 minutes</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Refresh TTL</span><span className="font-medium text-slate-700">7 days</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
