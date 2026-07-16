import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BookOpen, Loader2 } from "lucide-react";

// Login/cadastro MULTIUSUÁRIO por e-mail + senha. Cada pessoa tem sua conta.
export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = isRegister ? "/api/register" : "/api/login";
      const body = isRegister ? { name, email, password } : { email, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.location.href = "/painel";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Não foi possível continuar.");
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
          <p className="text-sm text-muted-foreground">
            {isRegister ? "Crie sua conta para começar." : "Entre com seu e-mail e senha."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {isRegister && (
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoFocus
              className="min-h-11"
              aria-label="Nome"
            />
          )}
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            autoFocus={!isRegister}
            className="min-h-11"
            aria-label="E-mail"
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="min-h-11"
            aria-label="Senha"
          />
          {error && <p className="text-sm text-red-500 break-words">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full min-h-11 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isRegister ? "Já tem conta?" : "Não tem conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
            className="text-primary font-medium hover:underline"
          >
            {isRegister ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </Card>
    </div>
  );
}
