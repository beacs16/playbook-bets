import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Coins } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — PlayBook" }, { name: "description", content: "Create a free PlayBook account and claim 10,000 virtual coins." }] }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username }, emailRedirectTo: `${window.location.origin}/sportsbook` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — 10,000 coins added!");
    navigate({ to: "/sportsbook" });
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border bg-card/80 p-8 backdrop-blur">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Coins className="h-3.5 w-3.5" /> 10,000 free coins
        </div>
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Free forever. No deposits. Virtual coins only.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">Min 8 characters.</p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
