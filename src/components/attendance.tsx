import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClassFields, classLabel, type ClassSel } from "@/components/class-fields";

type Session = { id: string; classroom: string; subject: string; is_open: boolean; created_at: string } & ClassSel;
type Att = { student_id: string; scanned_at: string; name?: string | undefined; roll?: string | null | undefined };

export function StudentIdCard({ userId, name, roll }: { userId: string; name: string; roll: string | null }) {
  const [history, setHistory] = useState<{ scanned_at: string; session_id: string }[]>([]);
  useEffect(() => {
    supabase.from("attendance").select("scanned_at, session_id").eq("student_id", userId)
      .order("scanned_at", { ascending: false }).then(({ data }) => setHistory(data ?? []));
  }, [userId]);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl bg-card p-8 shadow-card text-center">
        <h1 className="text-2xl font-bold">My digital ID card</h1>
        <p className="text-muted-foreground mt-1">Show this QR code to your faculty to mark attendance.</p>
        <div className="mt-6 inline-block rounded-lg bg-background p-4">
          <QRCodeSVG value={`PFPB:${userId}`} size={220} />
        </div>
        <p className="mt-4 font-semibold">{name || "—"}</p>
        <p className="text-sm text-muted-foreground">Roll no: {roll || "—"}</p>
      </div>
      <div className="rounded-xl bg-card p-8 shadow-card">
        <h2 className="text-xl font-bold">My attendance</h2>
        <p className="text-muted-foreground text-sm">{history.length} sessions attended</p>
        <ul className="mt-4 space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.session_id} className="border-t pt-2">{new Date(h.scanned_at).toLocaleString()}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FacultyAttendance({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [classroom, setClassroom] = useState("");
  const [subject, setSubject] = useState("");
  const [cls, setCls] = useState<ClassSel>({ branch: "", year: "", semester: "", section: "" });

  const load = async () => {
    const { data } = await supabase.from("class_sessions").select("*").eq("faculty_id", userId)
      .order("created_at", { ascending: false });
    setSessions(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!classroom.trim()) { toast.error("Enter a classroom"); return; }
    if (!cls.branch || !cls.year || !cls.semester || !cls.section) { toast.error("Select branch, year, sem and sec"); return; }
    const { data, error } = await supabase.from("class_sessions")
      .insert({ classroom: classroom.trim(), subject: subject.trim(), faculty_id: userId, ...cls }).select().single();
    if (error) { toast.error(error.message); return; }
    setClassroom(""); setSubject(""); setActive(data); load();
  };

  if (active) return <SessionScanner session={active} onBack={() => { setActive(null); load(); }} />;

  return (
    <div>
      <h1 className="text-3xl font-bold">Classroom sessions</h1>
      <div className="mt-6 rounded-xl bg-card p-6 shadow-card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40"><label className="text-sm">Classroom</label><Input value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="e.g. Room 204" /></div>
        <div className="flex-1 min-w-40"><label className="text-sm">Subject</label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. DBMS" /></div>
        <ClassFields value={cls} onChange={setCls} />
        <Button onClick={create}>Start session</Button>
      </div>
      <div className="mt-6 space-y-2">
        {sessions.map((s) => (
          <button key={s.id} onClick={() => setActive(s)} className="w-full text-left rounded-lg bg-card p-4 shadow-card flex justify-between items-center hover:bg-muted">
            <span><span className="font-semibold">{s.classroom}</span> {s.subject && `· ${s.subject}`} {classLabel(s) && `· ${classLabel(s)}`}
              <span className="block text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span></span>
            <Badge variant={s.is_open ? "default" : "secondary"}>{s.is_open ? "Open" : "Closed"}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionScanner({ session, onBack }: { session: Session; onBack: () => void }) {
  const [list, setList] = useState<Att[]>([]);
  const [open, setOpen] = useState(session.is_open);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = useRef(false);
  const recent = useRef<{ code: string; t: number }>({ code: "", t: 0 });

  const load = async () => {
    const { data } = await supabase.from("attendance").select("student_id, scanned_at")
      .eq("session_id", session.id).order("scanned_at", { ascending: false });
    const ids = (data ?? []).map((d) => d.student_id);
    const [{ data: profs }, { data: roster }] = ids.length
      ? await Promise.all([
          supabase.from("profiles").select("id, full_name, roll_number").in("id", ids),
          supabase.from("students").select("id, full_name, roll_number").in("id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const all = [...(profs ?? []), ...(roster ?? [])];
    setList((data ?? []).map((d) => {
      const p = all.find((x) => x.id === d.student_id);
      return { ...d, name: p?.full_name, roll: p?.roll_number };
    }));
  };
  useEffect(() => { load(); }, []);

  const submit = async (code: string) => {
    const now = Date.now();
    if (busy.current || (recent.current.code === code && now - recent.current.t < 2500)) return;
    busy.current = true; recent.current = { code, t: now };
    const { data, error } = await supabase.rpc("record_scan", { _session_id: session.id, _code: code });
    busy.current = false;
    if (error) { setLast({ ok: false, text: error.message }); toast.error(error.message); return; }
    const r = data as { status: string; message?: string; name?: string; roll_number?: string };
    const who = `${r.name || "Student"}${r.roll_number ? ` (${r.roll_number})` : ""}`;
    if (r.status === "recorded") { setLast({ ok: true, text: `Marked present: ${who}` }); toast.success(`Present: ${who}`); load(); }
    else if (r.status === "duplicate") { setLast({ ok: false, text: `Duplicate scan rejected: ${who} already marked` }); toast.warning("Already marked — duplicate rejected"); }
    else { setLast({ ok: false, text: r.message ?? "Scan failed" }); toast.error(r.message ?? "Scan failed"); }
  };

  const close = async () => {
    const { error } = await supabase.from("class_sessions").update({ is_open: false }).eq("id", session.id);
    if (error) { toast.error(error.message); return; }
    setOpen(false); toast.success("Session closed");
  };

  return (
    <div>
      <Button variant="ghost" onClick={onBack}>← All sessions</Button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Scan station · {session.classroom} {session.subject && <span className="text-muted-foreground text-xl">· {session.subject}</span>}<span className="block text-lg text-muted-foreground">{classLabel(session)}</span></h1>
        {open && <Button variant="outline" onClick={close}>Close session</Button>}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="rounded-xl bg-card p-6 shadow-card">
          {open ? <>
            <p className="mb-3 font-medium">Show your ID card to the camera, or type your roll number</p>
            <Camera onScan={submit} />
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { submit(manual.trim()); setManual(""); } }}>
              <Input autoFocus className="h-12 text-lg" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Type roll number and press Enter" />
              <Button type="submit" className="h-12">Enter</Button>
            </form>
            {last && <p className={`mt-4 rounded-md p-4 text-lg font-semibold ${last.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{last.text}</p>}
          </> : <p className="text-muted-foreground">This session is closed. No more scans accepted.</p>}
        </div>
        <div className="space-y-6">
          <div className="rounded-xl bg-primary p-6 text-center text-primary-foreground shadow-card">
            <p className="text-sm uppercase tracking-wide opacity-80">Total ID cards scanned</p>
            <p className="font-display text-7xl font-bold">{list.length}</p>
          </div>
          <div className="rounded-xl bg-card p-6 shadow-card">
            <h2 className="font-bold text-lg">Recent scans</h2>
            <ul className="mt-3 space-y-2 text-sm max-h-96 overflow-y-auto">
              {list.map((a) => (
                <li key={a.student_id} className="flex justify-between border-t pt-2">
                  <span>{a.name || "—"} <span className="text-muted-foreground">{a.roll}</span></span>
                  <span className="text-muted-foreground">{new Date(a.scanned_at).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Camera({ onScan }: { onScan: (code: string) => void }) {
  const cb = useRef(onScan);
  cb.current = onScan;
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;
    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (cancelled) return;
      const s = new Html5Qrcode("qr-reader");
      try {
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (t) => cb.current(t), () => {});
        scanner = s;
        if (cancelled) s.stop().then(() => s.clear()).catch(() => {});
      } catch (e) { setErr("Camera unavailable. Allow camera access or type the roll number below."); }
    });
    return () => { cancelled = true; scanner?.stop().then(() => scanner?.clear()).catch(() => {}); };
  }, []);
  return (
    <div>
      <div id="qr-reader" className="w-full overflow-hidden rounded-lg bg-muted min-h-48" />
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
