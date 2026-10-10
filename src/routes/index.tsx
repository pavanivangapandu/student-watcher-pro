import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanLine, ShieldCheck, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PFPB — Preventing From Proxy Attendance and Bunking" },
      { name: "description", content: "Smart classroom attendance with ID scanning, proxy detection and faculty dashboards." },
      { property: "og:title", content: "PFPB — Smart Classroom Attendance" },
      { property: "og:description", content: "Stop proxy attendance and bunking with ID scanning and live faculty dashboards." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: ScanLine, title: "ID scanning", text: "Students scan their ID card QR for each lecture." },
  { icon: ShieldCheck, title: "Proxy detection", text: "Headcount vs. scans mismatches get flagged." },
  { icon: Users, title: "Faculty dashboard", text: "Live counts and missing-student lists." },
  { icon: MapPin, title: "Card location", text: "Last-seen zones from RFID / BLE readers." },
];

function Index() {
  const { user } = useCurrentUser();
  return (
    <div className="min-h-screen">
      <section className="bg-hero grid-lines text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <span className="font-display text-xl font-bold">PFPB</span>
          <Button asChild variant="secondary" size="sm">
            <Link to={user ? "/dashboard" : "/auth"}>{user ? "Dashboard" : "Sign in"}</Link>
          </Button>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16">
          <p className="text-accent font-semibold tracking-widest text-xs uppercase">Smart classroom attendance</p>
          <h1 className="mt-4 text-4xl md:text-6xl font-bold max-w-3xl leading-tight">
            Preventing From Proxy Attendance and Bunking
          </h1>
          <p className="mt-6 max-w-xl text-primary-foreground/80 text-lg">
            One place for students, faculty and admins to keep attendance honest.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to={user ? "/dashboard" : "/auth"}>{user ? "Open dashboard" : "Get started"}</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl bg-card p-6 shadow-card">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
