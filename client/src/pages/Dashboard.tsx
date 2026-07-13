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
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const normalize = (v: unknown): string =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery();
  const { data: memories } = trpc.memories.list.useQuery();
  const { data: flashcards } = trpc.flashcards.list.useQuery({});
  const { data: conversations } = trpc.conversations.list.useQuery();

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const done = all.filter((t) => normalize(t.status) === "concluida").length;
    const overdue = all.filter(
      (t) =>
        normalize(t.status) !== "concluida" &&
        t.dueDate &&
        new Date(t.dueDate).getTime() < now
    ).length;
    const dueSoon = all.filter(
      (t) =>
        normalize(t.status) !== "concluida" &&
        t.dueDate &&
        new Date(t.dueDate).getTime() >= now &&
        new Date(t.dueDate).getTime() < now + dayMs
    ).length;
    const pending = all.length - done;
    const pct = all.length > 0 ? Math.round((done / all.length) * 100) : 0;
    return { total: all.length, done, pending, overdue, dueSoon, pct };
  }, [tasks]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return (tasks ?? [])
      .filter(
        (t) =>
          normalize(t.status) !== "concluida" &&
          t.dueDate &&
          new Date(t.dueDate).getTime() >= now &&
          new Date(t.dueDate).getTime() < now + 7 * dayMs
      )
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      )
      .slice(0, 5);
  }, [tasks]);

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
                const overdueOrSoon =
                  new Date(t.dueDate!).getTime() < Date.now() + 24 * 60 * 60 * 1000;
                return (
                  <li
                    key={t.id}
                    className="p-3 rounded bg-muted/50 flex items-start justify-between gap-2 flex-wrap"
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
                      variant={overdueOrSoon ? "destructive" : "secondary"}
                      className="text-xs whitespace-nowrap"
                    >
                      {new Date(t.dueDate!).toLocaleDateString("pt-BR")}
                    </Badge>
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
              className="min-h-11 gap-2 w-full sm:w-auto"
              onClick={() => navigate("/tarefas")}
            >
              <Plus className="w-4 h-4" /> Nova Tarefa
            </Button>
            <Button
              variant="outline"
              className="min-h-11 gap-2 w-full sm:w-auto"
              onClick={() => navigate("/chat")}
            >
              <MessageSquare className="w-4 h-4" /> Abrir Chat
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
  color: "blue" | "green" | "red" | "amber";
  highlight?: boolean;
};

const colorClasses: Record<StatCardProps["color"], string> = {
  blue: "text-blue-500",
  green: "text-green-500",
  red: "text-red-500",
  amber: "text-amber-500",
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
