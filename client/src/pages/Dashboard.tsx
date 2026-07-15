import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  MessageSquare,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Brain,
  Settings as SettingsIcon,
  ChevronRight,
  Sparkles,
  Flame,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { computeStreak } from "@shared/computeStreak";
import { computeTaskStats } from "@shared/taskStats";
import { computeStudyStats } from "@shared/studyStats";
import { getUpcomingTasks } from "@shared/upcomingTasks";
import { isDueSoon } from "@shared/taskUrgency";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery();
  const { data: memories } = trpc.memories.list.useQuery();
  const { data: flashcards } = trpc.flashcards.list.useQuery({});
  const { data: conversations } = trpc.conversations.list.useQuery();
  const { data: integrationSettings } = trpc.integrationSettings.get.useQuery();

  // stats agregados delegados pra @shared/taskStats (testável + usa
  // mesma lógica de urgência que a página Tarefas).
  const stats = useMemo(() => computeTaskStats(tasks ?? []), [tasks]);

  // Streak: dias consecutivos até hoje com qualquer atividade.
  // Local-only: usa dados já carregados no dashboard, sem query extra.
  // Lógica delegada pro util testável em @shared/computeStreak.
  const streak = useMemo(() => {
    const all: Array<Date | string | null | undefined> = [];
    for (const t of tasks ?? []) {
      all.push(t.createdAt, t.completedAt);
    }
    for (const c of conversations ?? []) all.push(c.updatedAt);
    for (const m of memories ?? []) all.push(m.createdAt);
    for (const f of flashcards ?? []) all.push((f as any).lastReviewedAt);
    return computeStreak(all);
  }, [tasks, conversations, memories, flashcards]);

  const upcoming = useMemo(() => getUpcomingTasks(tasks ?? []), [tasks]);

  const studyStats = useMemo(
    () =>
      computeStudyStats({
        tasks: (tasks ?? []) as any,
        flashcards: (flashcards ?? []) as any,
        conversations: (conversations ?? []) as any,
        memories: (memories ?? []) as any,
      }),
    [tasks, flashcards, conversations, memories]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold break-words">
          Olá{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do seu progresso e próximos prazos.
        </p>
      </div>

      {/* Alerta de atrasadas — só aparece se houver, chama atenção */}
      {stats.overdue > 0 && (
        <Card className="p-4 border-red-500/50 bg-red-500/10 flex items-start gap-3 flex-wrap">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              Você tem {stats.overdue} tarefa{stats.overdue === 1 ? "" : "s"} atrasada{stats.overdue === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-muted-foreground break-words">
              Vá em Minhas Tarefas para revisar e priorizar.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => {
              // Preseleciona filtro em Tarefas (localStorage é o que Tasks.tsx
              // já lê no init do state — assim abre já filtrado em Atrasadas).
              try {
                localStorage.setItem("tasks-filter", "atrasadas");
              } catch {
                // storage cheio/desativado — segue a viagem, sem preseleção
              }
              navigate("/tarefas");
            }}
          >
            Ver atrasadas
          </Button>
        </Card>
      )}

      {/* Onboarding: aparece somente quando faltam passos importantes.
          Só renderiza depois que TODAS as queries resolveram, senão
          renderiza checklist como "0/4" enquanto carrega.
          integrationSettings pode ser null (não configurado ainda) ou
          undefined (query rodando) — testar com !== undefined. */}
      {!tasksLoading &&
        tasks !== undefined &&
        memories !== undefined &&
        conversations !== undefined &&
        integrationSettings !== undefined && (() => {
        const steps = [
          {
            label: "Configurar Gmail para receber tarefas por email",
            done: Boolean(integrationSettings?.gmailUser && integrationSettings?.gmailAppPassword),
            path: "/configuracoes",
            icon: SettingsIcon,
          },
          {
            label: "Adicionar sua primeira Memória (IA aprende seu estilo)",
            done: (memories?.length ?? 0) > 0,
            path: "/memorias",
            icon: Brain,
          },
          {
            label: "Criar sua primeira tarefa",
            done: (tasks?.length ?? 0) > 0,
            path: "/tarefas",
            icon: BookOpen,
          },
          {
            label: "Começar uma conversa com a IA",
            done: (conversations?.length ?? 0) > 0,
            path: "/chat",
            icon: MessageSquare,
          },
        ];
        const doneCount = steps.filter((s) => s.done).length;
        if (doneCount === steps.length) return null; // tudo pronto: some
        return (
          <Card className="p-4 border-primary/40">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h2 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Primeiros passos ({doneCount}/{steps.length})
              </h2>
              <Progress value={(doneCount / steps.length) * 100} className="w-full sm:w-40" />
            </div>
            <ul className="space-y-2">
              {steps.map((step) => {
                const StepIcon = step.icon;
                return (
                  <li key={step.path}>
                    <button
                      className={`w-full flex items-center gap-3 p-3 rounded transition-colors min-h-11 text-left ${step.done ? "opacity-60" : "hover:bg-muted"}`}
                      onClick={() => navigate(step.path)}
                      disabled={step.done}
                    >
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <StepIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={`text-sm break-words flex-1 ${step.done ? "line-through" : ""}`}>{step.label}</span>
                      {!step.done && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })()}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Clock}
          label="Pendentes"
          value={tasksLoading ? null : stats.pending}
          color="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Concluídas"
          value={tasksLoading ? null : stats.done}
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          label="Atrasadas"
          value={tasksLoading ? null : stats.overdue}
          color="red"
          highlight={!tasksLoading && stats.overdue > 0}
        />
        <StatCard
          icon={Calendar}
          label="Vencem em 24h"
          value={tasksLoading ? null : stats.dueSoon}
          color="amber"
          highlight={!tasksLoading && stats.dueSoon > 0}
        />
      </div>

      {/* Progress */}
      {stats.total > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <p className="text-sm font-medium">
              Progresso geral: {stats.done} de {stats.total} tarefas
            </p>
            <span className="text-sm text-muted-foreground">{stats.pct}%</span>
          </div>
          <Progress value={stats.pct} />
        </Card>
      )}

      {/* Estatísticas de estudo — atividade além das tarefas */}
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Seu estudo
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            {streak > 0 && (
              <span className="text-sm font-medium text-orange-500 flex items-center gap-1" title="Dias consecutivos com atividade">
                <Flame className="w-4 h-4" />
                {streak} dia{streak === 1 ? "" : "s"} seguido{streak === 1 ? "" : "s"}
              </span>
            )}
            {studyStats.activeDays > 0 && (
              <span className="text-sm font-medium text-amber-500">
                🔥 Ativo em {studyStats.activeDays} de 7 dias
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={BookOpen} label="Flashcards" value={studyStats.flashcards} color="cyan" />
          <StatCard icon={Zap} label="Revisões feitas" value={studyStats.reviews} color="amber" />
          <StatCard icon={MessageSquare} label="Conversas" value={studyStats.conversations} color="green" />
          <StatCard icon={Brain} label="Memórias" value={studyStats.memories} color="purple" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming tasks */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Próximos 7 dias
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => navigate("/tarefas")}
            >
              Ver todas
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground break-words">
              Nenhuma tarefa nos próximos 7 dias. Aproveite pra planejar!
            </p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((t) => {
                // Prazo em ≤24h → vermelho; senão, cinza. Mesma regra usada
                // na página Tarefas (@shared/taskUrgency).
                const dueSoon = isDueSoon(t as any);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => navigate(`/tarefas?highlight=${t.id}`)}
                      className="w-full p-3 rounded bg-muted/50 hover:bg-muted flex items-start justify-between gap-2 flex-wrap text-left transition-colors min-h-11"
                    >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm break-words">{t.title}</p>
                      {t.subject && (
                        <p className="text-xs text-muted-foreground break-words">
                          {t.subject}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={dueSoon ? "destructive" : "secondary"}
                      className="text-xs whitespace-nowrap"
                    >
                      {new Date(t.dueDate!).toLocaleDateString("pt-BR")}
                    </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Quick stats + actions */}
        <Card className="p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4" /> Seus materiais
          </h2>
          <div className="space-y-2 mb-4">
            <MaterialRow
              icon={BookOpen}
              label="Flashcards criados"
              value={flashcards?.length ?? 0}
              onClick={() => navigate("/ferramentas")}
            />
            <MaterialRow
              icon={MessageSquare}
              label="Conversas com IA"
              value={conversations?.length ?? 0}
              onClick={() => navigate("/chat")}
            />
            <MaterialRow
              icon={Brain}
              label="Memórias salvas"
              value={memories?.length ?? 0}
              onClick={() => navigate("/memorias")}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="min-h-11 gap-2 w-full sm:w-auto glow-primary"
              onClick={() => navigate("/chat")}
            >
              <Sparkles className="w-4 h-4" /> Pedir ao Jarvis
            </Button>
            <Button
              variant="outline"
              className="min-h-11 gap-2 w-full sm:w-auto"
              onClick={() => navigate("/tarefas")}
            >
              <Plus className="w-4 h-4" /> Nova Tarefa
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  color: "blue" | "green" | "red" | "amber" | "purple" | "cyan";
  highlight?: boolean;
};

const colorClasses: Record<StatCardProps["color"], string> = {
  blue: "text-blue-500",
  green: "text-green-500",
  red: "text-red-500",
  amber: "text-amber-500",
  purple: "text-purple-400",
  cyan: "text-cyan-400",
};

function StatCard({ icon: Icon, label, value, color, highlight }: StatCardProps) {
  return (
    <Card className={`p-4 ${highlight ? "border-current " + colorClasses[color] : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
        <p className="text-xs uppercase tracking-wide text-muted-foreground break-words">
          {label}
        </p>
      </div>
      {value === null ? (
        <div className="h-8 sm:h-9 w-12 rounded bg-muted animate-pulse" />
      ) : (
        <p className="text-2xl sm:text-3xl font-bold">{value}</p>
      )}
    </Card>
  );
}

type MaterialRowProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  onClick: () => void;
};

function MaterialRow({ icon: Icon, label, value, onClick }: MaterialRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 p-3 rounded hover:bg-muted transition-colors min-h-11 text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm break-words">{label}</span>
      </div>
      <Badge variant="secondary">{value}</Badge>
    </button>
  );
}
