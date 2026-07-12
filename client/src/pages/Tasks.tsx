import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Trash2, Edit2, Clock, Zap, AlertCircle, RefreshCw, BookMarked, Check, CircleCheck, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function Tasks() {
  const { data: tasks, isLoading, refetch } = trpc.tasks.list.useQuery();
  const { data: integrationSettings } = trpc.integrationSettings.get.useQuery();
  const createTaskMutation = trpc.tasks.create.useMutation();
  const updateTaskMutation = trpc.tasks.update.useMutation();
  const deleteTaskMutation = trpc.tasks.delete.useMutation();
  const toddleSyncMutation = trpc.toddle.sync.useMutation();
  const [toddleConnected, setToddleConnected] = useState(false);

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
  const [filter, setFilter] = useState<"todas" | "pendentes" | "concluidas">("pendentes");
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
    try {
      await deleteTaskMutation.mutateAsync({ id: deleteConfirm.id });
      toast.success("Tarefa deletada!");
      setDeleteConfirm(null);
      refetch();
    } catch (error) {
      toast.error("Erro ao deletar tarefa");
    }
  };

  const handleToggleComplete = async (task: any) => {
    const currentStatus = normalize(task.status);
    const newStatus = currentStatus === "concluida" ? "pendente" : "concluída";
    try {
      await updateTaskMutation.mutateAsync({ id: task.id, status: newStatus as any });
      toast.success(newStatus === "concluída" ? "Tarefa concluída!" : "Tarefa reaberta");
      refetch();
    } catch {
      toast.error("Erro ao atualizar status");
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
    return <div className="p-8 text-center">Carregando tarefas...</div>;
  }

  // Ordena por prioridade. Usa `?? 3` (nao `|| 3`) pra que "alta"=0 nao vire 3.
  // Normaliza a string pra tirar acentos e caixa antes de comparar — evita
  // que uma variacao inesperada ("Média", "media") fure o mapa.
  const normalize = (v: unknown): string =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
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
        <Card className="bg-amber-500/10 border-amber-500/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900 mb-1">Conecte sua conta Toddle</p>
            <p className="text-sm text-amber-800">Configure suas credenciais do Toddle em Configurações para sincronizar automaticamente suas tarefas e atribuições.</p>
          </div>
        </Card>
      )}

      {toddleConnected && (
        <Card className="bg-green-500/10 border-green-500/20 p-4 flex items-start gap-3 flex-wrap">
          <Zap className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-green-900">Credenciais Toddle salvas</p>
            <p className="text-sm text-green-800 break-words">
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
            className="min-h-11 sm:flex-1"
          />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold">Minhas Tarefas</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                  />
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
              <Card key={task.id} className={`p-4 hover:shadow-md transition-shadow ${isDone ? "opacity-70" : ""}`}>
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
                  <div className="flex gap-2 self-end sm:self-start">
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
                          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "",
                          difficulty: task.difficulty as any,
                          priority: task.priority as any,
                          type: task.type as any,
                          subject: task.subject || "",
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

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              "{deleteConfirm?.title}" será removida permanentemente. Essa ação não pode ser desfeita.
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
