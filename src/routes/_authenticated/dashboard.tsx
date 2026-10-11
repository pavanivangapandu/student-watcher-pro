import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FacultyAttendance, StudentIdCard } from "@/components/attendance";
import { StudentRoster } from "@/components/student-roster";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PFPB" },
      { name: "description", content: "Your PFPB attendance dashboard." },
      { property: "og:title", content: "Dashboard — PFPB" },
      { property: "og:description", content: "Role-based attendance dashboard." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, role, loading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="font-display text-xl font-bold">PFPB</span>
          <div className="flex items-center gap-3">
            {role && <Badge className="bg-sidebar-primary text-sidebar-primary-foreground capitalize">{role}</Badge>}
            <span className="hidden sm:inline text-sm opacity-80">{user?.email}</span>
            <Button size="sm" variant="secondary" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : role === "admin" ? (
          <div className="space-y-12"><AdminPanel />{user && <FacultyAttendance userId={user.id} />}<StudentRoster /></div>
        ) : role === "faculty" ? (
          user && <div className="space-y-12"><FacultyAttendance userId={user.id} /><StudentRoster /></div>
        ) : user ? (
          <StudentIdCard userId={user.id} name={(user.user_metadata?.['full_name'] as string) ?? ""} roll={(user.user_metadata?.['roll_number'] as string) ?? null} />
        ) : (
          <Placeholder title="Student dashboard" text="Please sign in again." />
        )}
      </main>
    </div>
  );
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-card p-8 shadow-card">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{text}</p>
    </div>
  );
}

type Row = { id: string; full_name: string; email: string | null; roll_number: string | null; role: AppRole | null };

function AdminPanel() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, roll_number").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setRows((profiles ?? []).map((p) => ({ ...p, role: (roles?.find((r) => r.user_id === p.id)?.role as AppRole) ?? null })));
  };
  useEffect(() => { load(); }, []);

  const change = async (id: string, role: AppRole) => {
    const { error } = await supabase.rpc("set_user_role", { _user_id: id, _role: role });
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    load();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Admin — Users</h1>
      <p className="mt-1 text-muted-foreground">Assign student, faculty or admin roles.</p>
      <div className="mt-6 overflow-x-auto rounded-xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Roll no.</th><th className="p-3">Role</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.full_name || "—"}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3">{r.roll_number || "—"}</td>
                <td className="p-3">
                  <select
                    className="rounded-md border bg-background px-2 py-1"
                    value={r.role ?? ""}
                    onChange={(e) => change(r.id, e.target.value as AppRole)}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
