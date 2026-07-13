import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit2, Clock, Zap, AlertCircle, RefreshCw, BookMarked, CircleCheck, Circle, Sparkles, Copy, Mail, MessageSquare, RotateCcw, CopyPlus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Streamdown } from "streamdown";
import { normalize } from "@shared/normalize";
import { toast } from "sonner";

export default function Tasks() {
  const [, navigate] = useLocation();
  const { data: tasks, isLoading, refetch } = trpc.tasks.list.useQuery();
  const { data: integrationSettings } = trpc.integrationSettings.get.useQuery();
  const createTaskMutation = trpc.tasks.create.useMutation();
  const updateTaskMutation = trpc.tasks.update.useMutation();
  const deleteTaskMutation = trpc.tasks.delete.useMutation();
  const toddleSyncMutation = trpc.toddle.sync.useMutation();
  const importIcsMutation = trpc.toddle.importIcs.useMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const completeTaskMutation = trpc.chat.completeTask.useMutation();
  const sendCompletedEmailMutation = trpc.email.sendCompletedTask.useMutation();
  const createConvMutation = trpc.conversations.create.useMutation();
  const [toddleConnected, setToddleConnected] = useState(false);
  const [aiResult, setAiResult] = useState<{ taskId: number; taskTitle: string; content: string } | null>(null);
  // ID vindo do deep-link (?highlight=) — usado pra rolar até a tarefa e
  // destacá-la por alguns segundos ao chegar do Dashboard.
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Lê ?highlight= da URL quando as tarefas já carregaram, rola até o card
  // e aplica o realce temporário. Depois limpa o param da URL pra não
  // re-destacar em refresh.
  useEffect(() => {
    if (isLoading || !tasks) return;
    const raw = new URLSearchParams(window.location.search).get("highlight");
    const id = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(id)) return;
    setHighlightId(id);
    // Espera o próximo frame pra garantir que o card já está no DOM.
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`task-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const clearTimer = window.setTimeout(() => setHighlightId(null), 2600);
    // Remove o query param sem recarregar (mantém histórico limpo).
    window.history.replaceState(null, "", "/tarefas");
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const handleIcsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Limpa o input já pra permitir reimportar o mesmo arquivo depois.
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (limite 5MB).");
      return;
    }
    try {
      const content = await file.text();
      const res = await importIcsMutation.mutateAsync({ content });
      await refetch();
      if (res.imported === 0) {
        toast.info(
          res.skipped > 0
            ? `Nada novo: as ${res.skipped} tarefa(s) do arquivo já existem.`
            : "Nenhuma tarefa importada."
        );
      } else {
        toast.success(
          `${res.imported} tarefa(s) importada(s)` +
            (res.skipped > 0 ? ` — ${res.skipped} já existiam e foram puladas.` : ".")
        );
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao importar o arquivo .ics");
    }
  };

  const handleToddleSync = async () => {
    try {
      await toddleSyncMutation.mutateAsync();
      await refetch();
      toast.success("Sincronização concluída!");
    } catch (error: any) {
      // Mensagem do TRPCError propaga daqui — usuário vê texto honesto
      toast.error(error?.message || "Erro ao sincronizar com o Toddle");
    }
  };

  useEffect(() => {
    if (integrationSettings?.toddleEmail) {
      setToddleConnected(true);
    } else {
      setToddleConnected(false);
    }
  }, [integrationSettings]);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Filtro persiste entre visitas via localStorage — usuario que trabalha
  // sempre em "concluidas" nao precisa mudar toda vez que abre a pagina.
  const [filter, setFilter] = useState<"todas" | "pendentes" | "concluidas">(() => {
    if (typeof window === "undefined") return "pendentes";
    const saved = localStorage.getItem("tasks-filter");
    return saved === "todas" || saved === "pendentes" || saved === "concluidas"
      ? saved
      : "pendentes";
  });
  useEffect(() => {
    try {
      localStorage.setItem("tasks-filter", filter);
    } catch {
      // Storage cheio ou privacy mode — ignora silenciosamente.
    }
  }, [filter]);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    difficulty: "médio" as const,
    priority: "média" as const,
    type: "tarefa" as const,
    subject: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    try {
      if (editingId) {
        await updateTaskMutation.mutateAsync({
          id: editingId,
          ...formData,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        });
        toast.success("Tarefa atualizada!");
      } else {
        await createTaskMutation.mutateAsync({
          ...formData,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        });
        toast.success("Tarefa criada!");
      }
      setFormData({
        title: "",
        description: "",
        dueDate: "",
        difficulty: "médio",
        priority: "média",
        type: "tarefa",
        subject: "",
        notes: "",
      });
      setEditingId(null);
      setIsOpen(false);
      refetch();
    } catch (error) {
      toast.error("Erro ao salvar tarefa");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    // Captura a tarefa completa ANTES de deletar, pra recriar no "Desfazer".
    const removed = (tasks as any[] | undefined)?.find((t) => t.id === deleteConfirm.id);
    try {
      await deleteTaskMutation.mutateAsync({ id: deleteConfirm.id });
      setDeleteConfirm(null);
      refetch();
      toast.success("Tarefa deletada!", {
        action: removed
          ? {
              label: "Desfazer",
              onClick: async () => {
                try {
                  await createTaskMutation.mutateAsync({
                    title: String(removed.title ?? ""),
                    description: removed.description || undefined,
                    dueDate: removed.dueDate ? new Date(removed.dueDate) : undefined,
                    difficulty: removed.difficulty as any,
                    priority: removed.priority as any,
                    type: removed.type as any,
                    subject: removed.subject || undefined,
                    notes: removed.notes || undefined,
                  });
                  await refetch();
                  toast.success("Tarefa restaurada");
                } catch (err: any) {
                  toast.error(err?.message || "Não foi possível restaurar");
                }
              },
            }
          : undefined,
      });
    } catch (error) {
      toast.error("Erro ao deletar tarefa");
    }
  };

  const handleDuplicateTask = async (task: any) => {
    try {
      await createTaskMutation.mutateAsync({
        title: `${task.title} (cópia)`,
        description: task.description || undefined,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        difficulty: task.difficulty as any,
        priority: task.priority as any,
        type: task.type as any,
        subject: task.subject || undefined,
        notes: task.notes || undefined,
      });
      await refetch();
      toast.success("Tarefa duplicada");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao duplicar tarefa");
    }
  };

  const handleAskAiAboutTask = async (task: any) => {
    try {
      const conv = await createConvMutation.mutateAsync({
        title: `Sobre: ${task.title}`,
        taskId: task.id,
      });
      if (conv && typeof conv === "object" && "id" in conv) {
        // Hint pro Chat.tsx auto-selecionar essa conv ao montar.
        try {
          localStorage.setItem("chat-preselect-id", String(conv.id));
        } catch {}
        navigate("/chat");
        toast.success("Conversa criada com contexto da tarefa!");
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar conversa");
    }
  };

  const handleCompleteWithAI = async (task: any) => {
    try {
      const res = await completeTaskMutation.mutateAsync({ taskId: task.id });
      setAiResult({ taskId: task.id, taskTitle: task.title, content: res.content });
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao gerar conteúdo com IA");
    }
  };

  const handleSendCompletedEmail = async () => {
    if (!aiResult) return;
    try {
      await sendCompletedEmailMutation.mutateAsync({ taskId: aiResult.taskId });
      toast.success("Email enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar email");
    }
  };

  const handleToggleComplete = async (task: any) => {
    const currentStatus = normalize(task.status);
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluída";
    try {
      await updateTaskMutation.mutateAsync({ id: task.id, status: newStatus as any });
      toast.success(newStatus === "concluída" ? "Tarefa concluída!" : "Tarefa reaberta");
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar status");
    }
  };

  const priorityColors = {
    baixa: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    média: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    alta: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  const difficultyColors = {
    fácil: "bg-green-500/10 text-green-700 dark:text-green-400",
    médio: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    difícil: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-11 w-32" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card/50 border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-11 w-11 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Ordena por prioridade. Usa `?? 3` (nao `|| 3`) pra que "alta"=0 nao vire 3.
  // normalize() vem de @shared/normalize — evita variacoes ("Média"/"media"/etc)
  // furarem o mapa.
  const priorityRank: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  const allTasks = [...(tasks || [])].sort((a, b) => {
    // Concluídas por último
    const aDone = normalize(a.status) === "concluida" ? 1 : 0;
    const bDone = normalize(b.status) === "concluida" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    // Depois por prioridade
    const aRank = priorityRank[normalize(a.priority)] ?? 3;
    const bRank = priorityRank[normalize(b.priority)] ?? 3;
    if (aRank !== bRank) return aRank - bRank;
    // Depois por data mais próxima
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aDue - bDue;
  });

  const searchLower = search.trim().toLowerCase();
  const sortedTasks = allTasks.filter((t) => {
    const done = normalize(t.status) === "concluida";
    if (filter === "pendentes" && done) return false;
    if (filter === "concluidas" && !done) return false;
    if (searchLower) {
      const hay = `${t.title ?? ""} ${t.description ?? ""} ${t.subject ?? ""}`.toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  });

  const totalDone = allTasks.filter((t) => normalize(t.status) === "concluida").length;
  const totalPending = allTasks.length - totalDone;

  return (
    <div className="space-y-6">
      {!toddleConnected && (
        <Card className="bg-amber-500/10 border-amber-500/30 p-4 flex items-start gap-3 flex-wrap">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground mb-1">Conecte sua conta Toddle</p>
            <p className="text-sm text-muted-foreground break-words">Configure suas credenciais do Toddle em Configurações para sincronizar automaticamente suas tarefas e atribuições.</p>
          </div>
        </Card>
      )}

      {toddleConnected && (
        <Card className="bg-green-500/10 border-green-500/30 p-4 flex items-start gap-3 flex-wrap">
          <Zap className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Credenciais Toddle salvas</p>
            <p className="text-sm text-muted-foreground break-words">
              Suas credenciais estão prontas. Clique em "Sincronizar" para importar tarefas do Toddle.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-h-11 w-full sm:w-auto"
            onClick={handleToddleSync}
            disabled={toddleSyncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${toddleSyncMutation.isPending ? "animate-spin" : ""}`} />
            {toddleSyncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </Card>
      )}

      {/* Import por arquivo .ics — não precisa de credencial nem API externa.
          Exporte o calendário do Toddle/Google/Outlook e importe aqui. */}
      <Card className="p-4 flex items-start gap-3 flex-wrap">
        <BookMarked className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">Importar tarefas de um arquivo (.ics)</p>
          <p className="text-sm text-muted-foreground break-words">
            Exporte o calendário do Toddle (ou Google/Outlook) e selecione o arquivo aqui. As tarefas já existentes são ignoradas automaticamente.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={handleIcsFile}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2 min-h-11 w-full sm:w-auto"
          onClick={() => fileInputRef.current?.click()}
          disabled={importIcsMutation.isPending}
        >
          <BookMarked className="w-4 h-4" />
          {importIcsMutation.isPending ? "Importando..." : "Importar .ics"}
        </Button>
      </Card>

      {allTasks.length > 0 && (() => {
        const pct = allTasks.length > 0 ? Math.round((totalDone / allTasks.length) * 100) : 0;
        return (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <p className="text-sm font-medium">
                Progresso: {totalDone} de {allTasks.length} concluída{allTasks.length === 1 ? "" : "s"}
              </p>
              <span className="text-sm text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} />
          </Card>
        );
      })()}

      {allTasks.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex gap-1 rounded-lg bg-muted p-1 self-start flex-wrap">
            <button
              onClick={() => setFilter("pendentes")}
              className={`px-3 py-2 rounded text-sm min-h-9 transition-colors ${filter === "pendentes" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pendentes ({totalPending})
            </button>
            <button
              onClick={() => setFilter("concluidas")}
              className={`px-3 py-2 rounded text-sm min-h-9 transition-colors ${filter === "concluidas" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              Concluídas ({totalDone})
            </button>
            <button
              onClick={() => setFilter("todas")}
              className={`px-3 py-2 rounded text-sm min-h-9 transition-colors ${filter === "todas" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              Todas ({allTasks.length})
            </button>
          </div>
          <Input
            placeholder="Buscar por título, descrição ou disciplina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setSearch("");
              }
            }}
            className="min-h-11 sm:flex-1"
          />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Minhas Tarefas</h1>
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            // Ao fechar (sem submit), limpa o form pra próxima abertura
            // não vir com estado stale (útil quando edita task X, cancela,
            // e clica "Nova Tarefa" — antes vinha pré-preenchido com X).
            if (!open) {
              setEditingId(null);
              setFormData({
                title: "",
                description: "",
                dueDate: "",
                difficulty: "médio",
                priority: "média",
                type: "tarefa",
                subject: "",
                notes: "",
              });
            }
          }}
        >
            <DialogTrigger asChild>
              <Button className="gap-2 min-h-11">
                <Plus className="w-4 h-4" />
                Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Título *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Digite o título da tarefa"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição detalhada"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tarefa">Tarefa</SelectItem>
                        <SelectItem value="trabalho">Trabalho</SelectItem>
                        <SelectItem value="prova">Prova</SelectItem>
                        <SelectItem value="projeto">Projeto</SelectItem>
                        <SelectItem value="leitura">Leitura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Disciplina</label>
                    <Input
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Ex: Matemática"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Dificuldade</label>
                    <Select value={formData.difficulty} onValueChange={(value: any) => setFormData({ ...formData, difficulty: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fácil">Fácil</SelectItem>
                        <SelectItem value="médio">Médio</SelectItem>
                        <SelectItem value="difícil">Difícil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Prioridade</label>
                    <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="média">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Data de Entrega</label>
                  <Input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="min-h-11 mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Minhas Anotações</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Adicione contexto que a IA deve considerar ao completar a tarefa (fontes, requisitos, exemplos...)"
                    rows={3}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Essas anotações vão junto ao contexto quando a IA for completar a tarefa.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto min-h-11">Cancelar</Button>
                  <Button onClick={handleSubmit} disabled={createTaskMutation.isPending || updateTaskMutation.isPending} className="w-full sm:w-auto min-h-11">
                    {editingId ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {sortedTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground break-words">
              {allTasks.length === 0
                ? toddleConnected
                  ? "Nenhuma tarefa sincronizada do Toddle ainda. Verifique suas atribuições lá."
                  : "Nenhuma tarefa criada ainda. Crie uma para começar!"
                : searchLower
                  ? `Nenhuma tarefa encontrada para "${search}". Ajuste a busca ou o filtro.`
                  : filter === "pendentes"
                    ? "Tudo em dia! Nenhuma tarefa pendente."
                    : "Nenhuma tarefa concluída ainda."}
            </p>
          </Card>
        ) : (
          sortedTasks.map((task) => {
            const pri = normalize(task.priority);
            const dif = normalize(task.difficulty);
            const isDone = normalize(task.status) === "concluida";
            const isOverdue =
              !isDone &&
              task.dueDate &&
              new Date(task.dueDate).getTime() < Date.now();
            const dueSoon =
              !isDone &&
              !isOverdue &&
              task.dueDate &&
              new Date(task.dueDate).getTime() < Date.now() + 24 * 60 * 60 * 1000;
            const priClass = priorityColors[pri as keyof typeof priorityColors] ?? "bg-muted text-muted-foreground";
            const difClass = difficultyColors[dif as keyof typeof difficultyColors] ?? "bg-muted text-muted-foreground";
            return (
              <Card
                key={task.id}
                id={`task-${task.id}`}
                className={`p-4 hover:shadow-md transition-shadow ${isDone ? "opacity-70" : ""} ${
                  highlightId === task.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
                  <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 -ml-2"
                      onClick={() => handleToggleComplete(task)}
                      disabled={updateTaskMutation.isPending}
                      aria-label={isDone ? "Reabrir tarefa" : "Marcar como concluída"}
                      title={isDone ? "Reabrir tarefa" : "Marcar como concluída"}
                    >
                      {isDone ? (
                        <CircleCheck className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className={`font-semibold text-base sm:text-lg break-words ${isDone ? "line-through" : ""}`}>{task.title}</h3>
                        {task.priority && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${priClass}`}>
                            {task.priority}
                          </span>
                        )}
                        {task.difficulty && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${difClass}`}>
                            {task.difficulty}
                          </span>
                        )}
                        {task.completedContent && (
                          <button
                            className="px-2 py-1 rounded text-xs font-medium bg-purple-500/10 text-purple-500 flex items-center gap-1 hover:bg-purple-500/20 transition-colors"
                            title="Ver conteúdo gerado pela IA"
                            onClick={() =>
                              setAiResult({
                                taskId: task.id,
                                taskTitle: task.title,
                                content: task.completedContent!,
                              })
                            }
                          >
                            <Sparkles className="w-3 h-3" />
                            IA
                          </button>
                        )}
                      </div>
                      {task.description && <p className="text-sm text-muted-foreground mb-2 break-words">{task.description}</p>}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        {task.subject && (
                          <span className="flex items-center gap-1">
                            <BookMarked className="w-4 h-4" />
                            {task.subject}
                          </span>
                        )}
                        {task.dueDate && (
                          <span
                            className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : dueSoon ? "text-amber-500 font-medium" : ""}`}
                          >
                            <Clock className="w-4 h-4" />
                            {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                            {isOverdue && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-red-500/10">
                                Atrasada
                              </span>
                            )}
                            {dueSoon && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-amber-500/10">
                                Hoje / Amanhã
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-start flex-wrap">
                    {!isDone && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          aria-label="Perguntar à IA sobre esta tarefa"
                          title="Perguntar à IA sobre esta tarefa"
                          onClick={() => handleAskAiAboutTask(task)}
                          disabled={createConvMutation.isPending}
                        >
                          <MessageSquare className="w-4 h-4 text-cyan-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          aria-label="Completar com IA"
                          title="Completar com IA no meu estilo"
                          onClick={() => handleCompleteWithAI(task)}
                          disabled={completeTaskMutation.isPending}
                        >
                          <Sparkles className="w-4 h-4 text-purple-500" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label="Duplicar tarefa"
                      title="Duplicar tarefa"
                      onClick={() => handleDuplicateTask(task)}
                      disabled={createTaskMutation.isPending}
                    >
                      <CopyPlus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label="Editar tarefa"
                      onClick={() => {
                        setEditingId(task.id);
                        setFormData({
                          title: task.title,
                          description: task.description || "",
                          // datetime-local input espera formato LOCAL "YYYY-MM-DDTHH:mm".
                          // toISOString() dá UTC — em pt-BR fica 3h atrasado. Usa
                          // getTimezoneOffset pra ajustar antes do slice.
                          dueDate: task.dueDate
                            ? (() => {
                                const d = new Date(task.dueDate);
                                const off = d.getTimezoneOffset() * 60000;
                                return new Date(d.getTime() - off).toISOString().slice(0, 16);
                              })()
                            : "",
                          difficulty: task.difficulty as any,
                          priority: task.priority as any,
                          type: task.type as any,
                          subject: task.subject || "",
                          notes: task.notes || "",
                        });
                        setIsOpen(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label="Deletar tarefa"
                      onClick={() => setDeleteConfirm({ id: task.id, title: task.title })}
                      disabled={deleteTaskMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={aiResult !== null} onOpenChange={(open) => !open && setAiResult(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">
              Sugestão da IA para "{aiResult?.taskTitle}"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Gerado imitando seu estilo (baseado nas Memórias). Revise antes de entregar.
            </p>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words border rounded-lg p-4 bg-muted/30">
              <Streamdown>{aiResult?.content ?? ""}</Streamdown>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  if (!aiResult) return;
                  try {
                    await navigator.clipboard.writeText(aiResult.content);
                    toast.success("Copiado!");
                  } catch {
                    toast.error("Não foi possível copiar");
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar texto
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={handleSendCompletedEmail}
                disabled={sendCompletedEmailMutation.isPending}
              >
                <Mail className="w-4 h-4 mr-2" />
                {sendCompletedEmailMutation.isPending ? "Enviando..." : "Enviar por email"}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  if (!aiResult) return;
                  try {
                    const res = await completeTaskMutation.mutateAsync({ taskId: aiResult.taskId });
                    setAiResult({
                      taskId: aiResult.taskId,
                      taskTitle: aiResult.taskTitle,
                      content: res.content,
                    });
                    await refetch();
                    toast.success("Nova versão gerada");
                  } catch (error: any) {
                    toast.error(error?.message || "Erro ao regenerar");
                  }
                }}
                disabled={completeTaskMutation.isPending}
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${completeTaskMutation.isPending ? "animate-spin" : ""}`} />
                {completeTaskMutation.isPending ? "Regenerando..." : "Regenerar"}
              </Button>
              <Button className="min-h-11" onClick={() => setAiResult(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              "{deleteConfirm?.title}" será removida. Você terá alguns segundos para desfazer logo após.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTaskMutation.isPending}
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTaskMutation.isPending ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
