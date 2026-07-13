import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { BookOpen, Brain, Calendar, Zap, MessageSquare, FileText, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // Redireciona no efeito, NUNCA durante o render (anti-pattern React).
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/painel");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl text-foreground">Homework Assistant</span>
          </div>
          <a href={getLoginUrl()}>
            <Button className="gap-2 min-h-11">
              Entrar
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-card/50 border border-border">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Inteligência Artificial para seus Estudos</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight break-words">
            Seu Assistente de Estudos Inteligente
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto break-words">
            Organize suas tarefas, converse com IA, gere flashcards e cronogramas personalizados. Tudo em um único lugar, em Português.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={getLoginUrl()} className="w-full sm:w-auto">
              <Button size="lg" className="gap-2 w-full sm:w-auto min-h-12">
                Começar Agora
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <Button size="lg" variant="outline" className="w-full sm:w-auto min-h-12">
              Saber Mais
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12 sm:mb-16 break-words">Recursos Poderosos</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <FeatureCard icon={BookOpen} title="Gerenciamento de Tarefas" description="Crie, organize e priorize suas tarefas, trabalhos e provas com facilidade." tint="primary" />
            <FeatureCard icon={MessageSquare} title="Chat com IA" description="Converse com um assistente inteligente que explica conceitos e resolve problemas." tint="accent" />
            <FeatureCard icon={Zap} title="Ferramentas de Estudo" description="Gere flashcards, quizzes e guias de estudo automaticamente com IA." tint="accent" />
            <FeatureCard icon={Calendar} title="Cronograma Personalizado" description="Receba cronogramas de estudo inteligentes baseados em suas tarefas." tint="primary" />
            <FeatureCard icon={FileText} title="Upload de Arquivos" description="Envie imagens e documentos para análise e discussão com a IA." tint="primary" />
            <FeatureCard icon={Brain} title="Personalização" description="A IA aprende seu estilo e adapta respostas conforme você interage." tint="accent" />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12 sm:mb-16 break-words">Por Que Escolher Homework Assistant?</h2>

          <div className="space-y-6">
            {[
              {
                title: "100% em Português",
                description: "Interface completamente em Português (BR) para melhor compreensão.",
              },
              {
                title: "Privacidade Total",
                description: "Seus dados são seus. Cada usuário tem seus dados completamente isolados.",
              },
              {
                title: "Sem Limites",
                description: "Crie quantas tarefas, conversas e ferramentas de estudo quiser.",
              },
              {
                title: "Sempre Disponível",
                description: "Acesse de qualquer dispositivo, a qualquer hora. Funciona perfeitamente no mobile.",
              },
            ].map((benefit, idx) => (
              <div key={idx} className="flex gap-4 p-4 rounded-lg bg-card/30 border border-border hover:border-primary/50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground mb-1 break-words">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm break-words">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary/10 to-accent/10 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6 break-words">Pronto para Revolucionar Seus Estudos?</h2>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 break-words">
            Crie sua conta agora e comece a estudar de forma inteligente.
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" className="gap-2 min-h-12">
              Criar Conta Grátis
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground text-sm">
          <p>© 2026 Homework Assistant. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

type FeatureCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tint: "primary" | "accent";
};

function FeatureCard({ icon: Icon, title, description, tint }: FeatureCardProps) {
  const border = tint === "primary" ? "hover:border-primary/50" : "hover:border-accent/50";
  const bg = tint === "primary" ? "bg-primary/10" : "bg-accent/10";
  const text = tint === "primary" ? "text-primary" : "text-accent";
  return (
    <Card className={`bg-card/50 border-border ${border} transition-all p-6`}>
      <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${text}`} />
      </div>
      <h3 className="font-semibold text-foreground mb-2 break-words">{title}</h3>
      <p className="text-muted-foreground text-sm break-words">{description}</p>
    </Card>
  );
}
