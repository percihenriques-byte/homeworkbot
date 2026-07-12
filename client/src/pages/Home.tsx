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
      navigate("/tarefas");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/50 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-white">Homework Assistant</span>
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
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">Inteligência Artificial para seus Estudos</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight break-words">
            Seu Assistente de Estudos Inteligente
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto break-words">
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12 sm:mb-16 break-words">Recursos Poderosos</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all p-6">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Gerenciamento de Tarefas</h3>
              <p className="text-slate-400 text-sm">
                Crie, organize e priorize suas tarefas, trabalhos e provas com facilidade.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all p-6">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Chat com IA</h3>
              <p className="text-slate-400 text-sm">
                Converse com um assistente inteligente que explica conceitos e resolve problemas.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-pink-500/50 transition-all p-6">
              <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Ferramentas de Estudo</h3>
              <p className="text-slate-400 text-sm">
                Gere flashcards, quizzes e guias de estudo automaticamente com IA.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-green-500/50 transition-all p-6">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Cronograma Personalizado</h3>
              <p className="text-slate-400 text-sm">
                Receba cronogramas de estudo inteligentes baseados em suas tarefas.
              </p>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-500/50 transition-all p-6">
              <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Upload de Arquivos</h3>
              <p className="text-slate-400 text-sm">
                Envie imagens e documentos para análise e discussão com a IA.
              </p>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all p-6">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">Personalização</h3>
              <p className="text-slate-400 text-sm">
                A IA aprende seu estilo e adapta respostas conforme você interage.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-16">Por Que Escolher Homework Assistant?</h2>

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
              <div key={idx} className="flex gap-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-slate-600 transition-colors">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{benefit.title}</h3>
                  <p className="text-slate-400 text-sm">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-t border-slate-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 break-words">Pronto para Revolucionar Seus Estudos?</h2>
          <p className="text-lg sm:text-xl text-slate-300 mb-8 break-words">
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
      <footer className="border-t border-slate-700 py-8 px-4 sm:px-6 lg:px-8 bg-slate-950/50">
        <div className="max-w-6xl mx-auto text-center text-slate-400 text-sm">
          <p>© 2026 Homework Assistant. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
