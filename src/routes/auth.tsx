import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PFPB" },
      { name: "description", content: "Sign in or create your PFPB attendance account." },
      { property: "og:title", content: "Sign in — PFPB" },
      { property: "og:description", content: "Access your PFPB student, faculty or admin account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roll, setRoll] = useState("");
  const [signupRole, setSignupRole] = useState<"student" | "faculty">("student");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/dashboard" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName, roll_number: roll, requested_role: signupRole },
        },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      setSent(true);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error(String(result.error.message ?? result.error)); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-hero grid-lines text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="font-display text-2xl font-bold">PFPB</Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Every scan counted.<br />Every proxy caught.</h2>
          <p className="mt-4 text-primary-foreground/75">Students, faculty and admins each get their own view.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {sent ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-muted-foreground">We sent a confirmation link to {email}.</p>
              <Button variant="outline" className="mt-6" onClick={() => { setSent(false); setMode("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to continue." : "Choose Student or Faculty below. Admins can change roles later."}
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <div className="space-y-1.5"><Label htmlFor="n">Full name</Label><Input id="n" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>I am a</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["student", "faculty"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setSignupRole(r)}
                            className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                              signupRole === r
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background text-foreground hover:bg-accent"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    {signupRole === "student" && (
                      <div className="space-y-1.5"><Label htmlFor="r">Roll number</Label><Input id="r" required value={roll} onChange={(e) => setRoll(e.target.value)} /></div>
                    )}
                  </>
                )}
                <div className="space-y-1.5"><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="p">Password</Label><Input id="p" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}</Button>
              </form>
              <div className="my-4 text-center text-xs text-muted-foreground">or</div>
              <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "No account?" : "Already registered?"}{" "}
                <button className="font-semibold text-primary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
