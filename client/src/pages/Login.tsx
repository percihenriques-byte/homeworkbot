import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BookOpen, Loader2 } from "lucide-react";

// Login por senha única (substitui o OAuth do Manus). Envia pra /api/simple-login;
// se OK, recarrega no painel (pra o auth.me pegar a sessão nova).
export default function Login() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/simple-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/painel";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Senha incorreta.");
    } catch {
      setError("Não consegui conectar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Homework Assistant</h1>
          <p className="text-sm text-muted-foreground">Digite a senha para entrar.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            autoFocus
            className="min-h-11"
            aria-label="Senha"
          />
          {error && <p className="text-sm text-red-500 break-words">{error}</p>}
          <Button type="submit" disabled={loading || !password} className="w-full min-h-11 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
