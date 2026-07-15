import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Wand2, BookOpen, HelpCircle, Trash2, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type Tool = "flashcards" | "quiz" | "guide";

const toolCopy: Record<Tool, { title: string; description: string; button: string; subjectPlaceholder: string }> = {
  flashcards: {
    title: "Flashcards",
    description: "Gere flashcards automaticamente a partir de seu conteúdo.",
    button: "Gerar Flashcards",
    subjectPlaceholder: "Ex: Matemática",
  },
  quiz: {
    title: "Quiz",
    description: "Crie quizzes para testar seu conhecimento.",
    button: "Gerar Quiz",
    subjectPlaceholder: "Ex: História",
  },
  guide: {
    title: "Guia",
    description: "Gere guias de estudo estruturados.",
    button: "Gerar Guia",
    subjectPlaceholder: "Ex: Português",
  },
};

export default function StudyTools() {
  const generateFlashcardsMutation = trpc.studyTools.generateFlashcards.useMutation();
  const generateQuizMutation = trpc.studyTools.generateQuiz.useMutation();
  const generateGuideMutation = trpc.studyTools.generateStudyGuide.useMutation();
  const deleteFlashcardMutation = trpc.flashcards.delete.useMutation();
  const deleteQuizMutation = trpc.quizzes.delete.useMutation();
  const deleteGuideMutation = trpc.studyGuides.delete.useMutation();

  const { data: flashcards, refetch: refetchFlashcards, isLoading: flashcardsLoading } = trpc.flashcards.list.useQuery({});
  const { data: quizzes, refetch: refetchQuizzes, isLoading: quizzesLoading } = trpc.quizzes.list.useQuery();
  const { data: guides, refetch: refetchGuides, isLoading: guidesLoading } = trpc.studyGuides.list.useQuery();

  const materialsLoading = flashcardsLoading || quizzesLoading || guidesLoading;

  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tool>("flashcards");
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyMode, setStudyMode] = useState<null | { subject?: string }>(null);
  const [selectedGuide, setSelectedGuide] = useState<any>(null);
  const [playingQuiz, setPlayingQuiz] = useState<any>(null);

  const isPending =
    generateFlashcardsMutation.isPending ||
    generateQuizMutation.isPending ||
    generateGuideMutation.isPending;

  const closeAndReset = () => {
    setIsOpen(false);
    setContent("");
    setSubject("");
  };

  const handleGenerate = async (tool: Tool) => {
    if (!content.trim()) {
      toast.error(
        `Adicione conteúdo para gerar ${tool === "flashcards" ? "flashcards" : tool === "quiz" ? "o quiz" : "o guia"}`
      );
      return;
    }
    try {
      if (tool === "flashcards") {
        await generateFlashcardsMutation.mutateAsync({ content, subject });
        await refetchFlashcards();
        toast.success("Flashcards gerados com sucesso!");
      } else if (tool === "quiz") {
        await generateQuizMutation.mutateAsync({ content, subject, questionCount: 5 });
        await refetchQuizzes();
        toast.success("Quiz gerado com sucesso!");
      } else {
        await generateGuideMutation.mutateAsync({ content, subject });
        await refetchGuides();
        toast.success("Guia de estudo gerado com sucesso!");
      }
      closeAndReset();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao gerar conteúdo. Tente novamente.");
    }
  };

  const openWith = (tool: Tool) => {
    setActiveTab(tool);
    setIsOpen(true);
  };

  const handleDeleteFlashcard = async (id: number) => {
    try {
      await deleteFlashcardMutation.mutateAsync({ id });
      await refetchFlashcards();
      toast.success("Flashcard removido");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao remover flashcard");
    }
  };

  // Exporta um deck como texto (Pergunta / Resposta) pra área de
  // transferência — o usuário cola em WhatsApp, email, docs, etc. Sem
  // backend nem link público: compartilhar é copiar e colar.
  const handleExportDeck = async (subject: string, cards: any[]) => {
    const text =
      `Flashcards — ${subject}\n\n` +
      cards
        .map((c: any, i: number) => `${i + 1}. P: ${c.question}\n   R: ${c.answer}`)
        .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${cards.length} flashcard(s) copiado(s) — cole onde quiser`);
    } catch {
      toast.error("Não foi possível copiar. Seu navegador pode ter bloqueado.");
    }
  };

  const handleDeleteQuiz = async (id: number) => {
    try {
      await deleteQuizMutation.mutateAsync({ id });
      await refetchQuizzes();
      toast.success("Quiz removido");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao remover quiz");
    }
  };

  const handleDeleteGuide = async (id: number) => {
    try {
      await deleteGuideMutation.mutateAsync({ id });
      await refetchGuides();
      toast.success("Guia removido");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao remover guia");
    }
  };

  const renderTabContent = (tool: Tool) => {
    const copy = toolCopy[tool];
    return (
      <TabsContent value={tool} className="space-y-4">
        <p className="text-sm text-muted-foreground">{copy.description}</p>
        <div>
          <label className="text-sm font-medium">Disciplina</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={copy.subjectPlaceholder}
            className="min-h-11 mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Conteúdo *</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole o conteúdo aqui..."
            rows={6}
            className="mt-1"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto min-h-11">
            Cancelar
          </Button>
          <Button
            onClick={() => handleGenerate(tool)}
            disabled={isPending}
            className="w-full sm:w-auto min-h-11"
          >
            {isPending ? "Gerando..." : copy.button}
          </Button>
        </div>
      </TabsContent>
    );
  };

  // Agrupa flashcards por disciplina pra facilitar estudar por matéria
  const flashcardsBySubject = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const fc of flashcards ?? []) {
      const key = fc.subject || "Sem disciplina";
      (groups[key] ??= []).push(fc);
    }
    return groups;
  }, [flashcards]);

  const studyCards = useMemo(() => {
    if (!studyMode) return [];
    const subj = studyMode.subject;
    if (!subj) return flashcards ?? [];
    return flashcardsBySubject[subj] ?? [];
  }, [studyMode, flashcards, flashcardsBySubject]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold">Ferramentas de Estudo</h1>
        <Button className="gap-2 min-h-11" onClick={() => setIsOpen(true)}>
          <Wand2 className="w-4 h-4" />
          Gerar com IA
        </Button>
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          // Limpa o form ao fechar (sem gerar) pra próxima abertura
          // não trazer conteúdo velho.
          if (!open) {
            setContent("");
            setSubject("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Ferramentas de Estudo</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tool)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
              <TabsTrigger value="guide">Guia</TabsTrigger>
            </TabsList>
            {renderTabContent("flashcards")}
            {renderTabContent("quiz")}
            {renderTabContent("guide")}
          </Tabs>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <ToolCard
          icon={BookOpen}
          title="Flashcards"
          description="Crie e revise flashcards para memorizar conceitos"
          onClick={() => openWith("flashcards")}
        />
        <ToolCard
          icon={HelpCircle}
          title="Quizzes"
          description="Teste seu conhecimento com quizzes interativos"
          onClick={() => openWith("quiz")}
        />
        <ToolCard
          icon={Wand2}
          title="Guias de Estudo"
          description="Gere guias estruturados para seus estudos"
          onClick={() => openWith("guide")}
        />
      </div>

      {/* Materiais gerados — antes estavam invisíveis */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Meus Materiais</h2>

        {materialsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-11 w-full rounded" />
                  <Skeleton className="h-11 w-full rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
        <>
        {/* Flashcards */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Flashcards
              <Badge variant="secondary">{flashcards?.length ?? 0}</Badge>
            </h3>
            {(flashcards?.length ?? 0) > 0 && (
              <Button
                size="sm"
                className="min-h-11 gap-2"
                onClick={() => {
                  setStudyIndex(0);
                  setStudyMode({});
                }}
              >
                Estudar todos
              </Button>
            )}
          </div>
          {(flashcards?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum flashcard ainda. Use "Gerar com IA" pra criar seu primeiro deck.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(flashcardsBySubject).map(([subj, cards]) => (
                <div key={subj} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <p className="text-sm font-medium">
                      {subj} <span className="text-muted-foreground">({cards.length})</span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11 gap-2"
                        onClick={() => handleExportDeck(subj, cards)}
                        aria-label={`Compartilhar flashcards de ${subj}`}
                        title="Copiar deck pra compartilhar"
                      >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Compartilhar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => {
                          setStudyIndex(0);
                          setStudyMode({ subject: subj });
                        }}
                      >
                        Estudar
                      </Button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {cards.slice(0, 3).map((c: any) => (
                      <li key={c.id} className="text-sm text-muted-foreground flex items-center justify-between gap-2">
                        <span className="break-words truncate flex-1">• {c.question}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          aria-label="Remover"
                          onClick={() => handleDeleteFlashcard(c.id)}
                          disabled={deleteFlashcardMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </li>
                    ))}
                    {cards.length > 3 && (
                      <li className="text-xs text-muted-foreground">+ {cards.length - 3} mais…</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Guides */}
        <Card className="p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Wand2 className="w-4 h-4" /> Guias de Estudo
            <Badge variant="secondary">{guides?.length ?? 0}</Badge>
          </h3>
          {(guides?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum guia gerado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {(guides ?? []).map((g: any) => (
                <li key={g.id} className="flex items-center gap-2">
                  <button
                    className="flex-1 text-left p-3 rounded hover:bg-muted transition-colors min-h-11"
                    onClick={() => setSelectedGuide(g)}
                  >
                    <p className="font-medium break-words">{g.title}</p>
                    {g.subject && (
                      <p className="text-xs text-muted-foreground">{g.subject}</p>
                    )}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 shrink-0"
                    aria-label="Remover guia"
                    onClick={() => handleDeleteGuide(g.id)}
                    disabled={deleteGuideMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Quizzes */}
        <Card className="p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4" /> Quizzes
            <Badge variant="secondary">{quizzes?.length ?? 0}</Badge>
          </h3>
          {(quizzes?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum quiz gerado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {(quizzes ?? []).map((q: any) => {
                const hasQuestions = Array.isArray(q.questions) && q.questions.length > 0;
                return (
                  <li key={q.id}>
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 text-left p-3 rounded hover:bg-muted transition-colors min-h-11 flex items-center justify-between gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => hasQuestions && setPlayingQuiz(q)}
                        disabled={!hasQuestions}
                        title={hasQuestions ? "Jogar quiz" : "Quiz sem questões"}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium break-words">{q.title}</p>
                          {q.subject && (
                            <p className="text-xs text-muted-foreground">{q.subject}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {q.totalQuestions ?? (Array.isArray(q.questions) ? q.questions.length : 0)} questões
                          </p>
                        </div>
                        {hasQuestions && (
                          <Badge variant="secondary" className="whitespace-nowrap">Jogar</Badge>
                        )}
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 shrink-0"
                        aria-label="Remover quiz"
                        onClick={() => handleDeleteQuiz(q.id)}
                        disabled={deleteQuizMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        </>
        )}
      </section>

      {/* Modal de estudo dos flashcards */}
      <Dialog open={studyMode !== null} onOpenChange={(open) => !open && setStudyMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Estudar {studyMode?.subject ? `— ${studyMode.subject}` : "flashcards"}
            </DialogTitle>
          </DialogHeader>
          {studyCards.length > 0 && (
            <StudyDeck
              cards={studyCards}
              index={studyIndex}
              onIndexChange={setStudyIndex}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de jogar quiz */}
      <Dialog open={playingQuiz !== null} onOpenChange={(open) => !open && setPlayingQuiz(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="break-words">{playingQuiz?.title}</DialogTitle>
          </DialogHeader>
          {playingQuiz && (
            <QuizGame
              questions={playingQuiz.questions ?? []}
              onClose={() => setPlayingQuiz(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de visualizar guia de estudo */}
      <Dialog open={selectedGuide !== null} onOpenChange={(open) => !open && setSelectedGuide(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">
              {selectedGuide?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedGuide && (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <Streamdown>{String(selectedGuide.content ?? "")}</Streamdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ToolCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
};

function ToolCard({ icon: Icon, title, description, onClick }: ToolCardProps) {
  return (
    <Card
      className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer min-h-40"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Icon className="w-12 h-12 mx-auto mb-3 text-primary" />
      <h3 className="font-semibold mb-2 break-words">{title}</h3>
      <p className="text-sm text-muted-foreground break-words">{description}</p>
    </Card>
  );
}

type StudyDeckProps = {
  cards: any[];
  index: number;
  onIndexChange: (i: number) => void;
};

function StudyDeck({ cards, index, onIndexChange }: StudyDeckProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const reviewMutation = trpc.flashcards.review.useMutation();
  const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
  const card = cards[safeIndex];

  const toggleAnswer = () => {
    const next = !showAnswer;
    setShowAnswer(next);
    // Registra revisão quando o usuário revela a resposta pela 1a vez.
    // Fire-and-forget — não bloqueia a UI, se falhar o toast já mostra
    // resposta e revisão fica com contador stale.
    if (next && card?.id) {
      reviewMutation.mutate({ id: card.id });
    }
  };

  const goPrev = () => {
    setShowAnswer(false);
    onIndexChange(Math.max(0, safeIndex - 1));
  };
  const goNext = () => {
    setShowAnswer(false);
    onIndexChange(Math.min(cards.length - 1, safeIndex + 1));
  };
  const restart = () => {
    setShowAnswer(false);
    onIndexChange(0);
  };

  // Atalhos de teclado: ← anterior, → próximo, Espaço/Enter vira o card.
  // Só ativa quando não digitando em input/textarea (typing em busca não
  // deve mudar de card acidentalmente).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleAnswer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, showAnswer, card?.id]);

  if (!card) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {safeIndex + 1} / {cards.length}
        </span>
        {card.subject && <Badge variant="secondary">{card.subject}</Badge>}
      </div>

      <button
        type="button"
        onClick={toggleAnswer}
        className="w-full min-h-56 sm:min-h-64 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted transition-colors p-6 text-left"
      >
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          {showAnswer ? "Resposta" : "Pergunta"}
        </p>
        <p className="text-base sm:text-lg break-words whitespace-pre-wrap">
          {showAnswer ? card.answer : card.question}
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          {showAnswer ? "Toque para ver a pergunta" : "Toque para ver a resposta"}
          <span className="hidden sm:inline"> · atalhos: ← → espaço</span>
        </p>
      </button>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={safeIndex === 0}
          className="min-h-11 gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </Button>
        <Button variant="ghost" onClick={restart} className="min-h-11 gap-2">
          <RotateCcw className="w-4 h-4" /> Recomeçar
        </Button>
        <Button
          onClick={goNext}
          disabled={safeIndex === cards.length - 1}
          className="min-h-11 gap-2"
        >
          Próximo <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

type QuizGameProps = {
  questions: any[];
  onClose: () => void;
};

function QuizGame({ questions, onClose }: QuizGameProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);

  const total = questions.length;
  const q = questions[index];
  const currentAnswer = answers[index];
  const isCorrect = currentAnswer !== undefined && currentAnswer === q?.correctAnswer;

  const score = useMemo(
    () =>
      questions.reduce(
        (acc, question, i) => (answers[i] === question.correctAnswer ? acc + 1 : acc),
        0
      ),
    [answers, questions]
  );

  if (finished) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const badge = pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "📚";
    return (
      <div className="space-y-4">
        <div className="text-center py-4 border-b border-border">
          <p className="text-5xl mb-2">{badge}</p>
          <p className="text-3xl sm:text-4xl font-bold">{pct}%</p>
          <p className="text-muted-foreground">
            {score} de {total} questões corretas
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-2">Revisão:</p>
          {questions.map((question, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === question.correctAnswer;
            const skipped = !userAnswer;
            return (
              <div
                key={i}
                className={`p-3 rounded border text-sm ${
                  skipped
                    ? "border-border bg-muted/30"
                    : isCorrect
                      ? "border-green-500/40 bg-green-500/5"
                      : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <p className="font-medium break-words mb-1">
                  {i + 1}. {question.question}
                </p>
                {skipped ? (
                  <p className="text-xs text-muted-foreground">Não respondida</p>
                ) : (
                  <p className={`text-xs ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                    {isCorrect ? "✓ Correto" : `✗ Sua resposta: ${userAnswer}`}
                  </p>
                )}
                {!isCorrect && !skipped && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Resposta correta: {question.correctAnswer}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-center pt-2 border-t border-border">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setAnswers({});
              setIndex(0);
              setFinished(false);
            }}
          >
            Jogar novamente
          </Button>
          <Button className="min-h-11" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Este quiz não tem questões salvas.
      </p>
    );
  }

  const options: string[] = Array.isArray(q.options) ? q.options : [];

  // Se por algum motivo essa questão específica veio sem opções válidas
  // (quiz antigo, gerado antes da validação server-side), avisa e permite
  // pular pra próxima em vez de travar o jogo.
  if (options.length < 2) {
    return (
      <div className="space-y-4 text-center py-4">
        <p className="text-muted-foreground break-words">
          Esta questão está sem opções válidas e foi pulada.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
          {index < total - 1 ? (
            <Button className="min-h-11" onClick={() => setIndex(index + 1)}>
              Próxima questão
            </Button>
          ) : (
            <Button className="min-h-11" onClick={() => setFinished(true)}>
              Ver resultado
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Questão {index + 1} / {total}
        </span>
        <span>Acertos: {score}</span>
      </div>

      <div className="p-4 rounded-lg bg-muted/30 border">
        <p className="text-base sm:text-lg font-medium break-words">{q.question}</p>
      </div>

      <div className="space-y-2">
        {options.map((opt, i) => {
          const chosen = currentAnswer === opt;
          const correctChoice = q.correctAnswer === opt;
          const showResult = currentAnswer !== undefined;
          return (
            <button
              key={i}
              onClick={() => !showResult && setAnswers({ ...answers, [index]: opt })}
              disabled={showResult}
              className={`w-full text-left p-3 rounded border transition-colors min-h-11 break-words ${
                !showResult
                  ? "hover:bg-muted"
                  : correctChoice
                    ? "border-green-500 bg-green-500/10"
                    : chosen
                      ? "border-red-500 bg-red-500/10"
                      : "opacity-60"
              }`}
            >
              <span className="flex items-center gap-2">
                {showResult && correctChoice && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
                {showResult && chosen && !correctChoice && (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span>{opt}</span>
              </span>
            </button>
          );
        })}
      </div>

      {currentAnswer !== undefined && (
        <p className={`text-sm text-center ${isCorrect ? "text-green-500" : "text-red-500"}`}>
          {isCorrect ? "Correto!" : `Resposta correta: ${q.correctAnswer}`}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
        >
          Anterior
        </Button>
        {index < total - 1 ? (
          <Button
            className="min-h-11"
            onClick={() => setIndex(index + 1)}
            disabled={currentAnswer === undefined}
          >
            Próxima
          </Button>
        ) : (
          <Button
            className="min-h-11"
            onClick={() => setFinished(true)}
            disabled={currentAnswer === undefined}
          >
            Ver resultado
          </Button>
        )}
      </div>
    </div>
  );
}
