import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClassFields, classLabel, type ClassSel } from "@/components/class-fields";

type Stu = { id: string; roll_number: string; full_name: string } & ClassSel;
const empty: ClassSel = { branch: "", year: "", semester: "", section: "" };

export function StudentRoster() {
  const [filter, setFilter] = useState<ClassSel>(empty);
  const [rows, setRows] = useState<Stu[]>([]);
  const [paste, setPaste] = useState("");

  const load = async () => {
    let q = supabase.from("students").select("*").order("roll_number");
    if (filter.branch) q = q.eq("branch", filter.branch);
    if (filter.year) q = q.eq("year", filter.year);
    if (filter.semester) q = q.eq("semester", filter.semester);
    if (filter.section) q = q.eq("section", filter.section);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [filter]);

  const add = async () => {
    if (!filter.branch || !filter.year || !filter.semester || !filter.section) {
      toast.error("Select branch, year, sem and sec first"); return;
    }
    const list = paste.split("\n").map((l) => l.split(/[,\t]/).map((x) => x.trim())).filter((p) => p[0]);
    if (!list.length) { toast.error("Paste at least one line: roll number, name"); return; }
    const { error } = await supabase.from("students").upsert(
      list.map(([roll, name]) => ({ roll_number: roll!.toUpperCase(), full_name: name ?? "", ...filter })),
      { onConflict: "roll_number" },
    );
    if (error) { toast.error(error.message); return; }
    toast.success(`${list.length} students saved`); setPaste(""); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Student list</h1>
      <p className="mt-1 text-muted-foreground">Pick a class to view its students, or add students to it.</p>
      <div className="mt-6 rounded-xl bg-card p-6 shadow-card flex flex-wrap gap-3 items-end">
        <ClassFields value={filter} onChange={setFilter} any />
      </div>
      <div className="mt-4 rounded-xl bg-card p-6 shadow-card">
        <p className="font-medium">Add students to {classLabel(filter) || "the selected class"}</p>
        <p className="text-sm text-muted-foreground">One per line: roll number, name (you can paste from Excel)</p>
        <textarea className="mt-2 w-full min-h-28 rounded-md border bg-background p-2 font-mono text-sm" value={paste}
          onChange={(e) => setPaste(e.target.value)} placeholder={"22761A05G1, Ravi Kumar\n22761A05G2, Sita Devi"} />
        <Button className="mt-2" onClick={add}>Save students</Button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl bg-card shadow-card">
        <p className="p-3 text-sm text-muted-foreground">{rows.length} students</p>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-3">Roll no.</th><th className="p-3">Name</th><th className="p-3">Class</th><th className="p-3" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.roll_number}</td>
                <td className="p-3">{r.full_name || "—"}</td>
                <td className="p-3">{classLabel(r)}</td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Remove</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
