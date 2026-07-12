import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Clock, Zap, AlertCircle, RefreshCw, BookMarked, Check, CircleCheck, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function Tasks() {
  const { data: tasks, isLoading, refetch } = trpc.tasks.list.useQuery();
  const { data: integrationSettings } = trpc.integrationSettings.get.useQuery();
  const createTaskMutation = trpc.tasks.create.useMutation();
  const updateTaskMutation = trpc.tasks.update.useMutation();
  const deleteTaskMutation = trpc.tasks.delete.useMutation();
  const [toddleConnected, setToddleConnected] = useState(false);

  useEffect(() => {
    if (integrationSettings?.toddleEmail) {
      setToddleConnected(true);
    } else {
      setToddleConnected(false);
    }
  }, [integrationSettings]);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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

  const handleDelete = async (id: number) => {
    try {
      await deleteTaskMutation.mutateAsync({ id });
      toast.success("Tarefa deletada!");
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
  const sortedTasks = [...(tasks || [])].sort((a, b) => {
    const aRank = priorityRank[normalize(a.priority)] ?? 3;
    const bRank = priorityRank[normalize(b.priority)] ?? 3;
    return aRank - bRank;
  });

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
            disabled
            title="Sincronização automática será implementada em breve"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar
          </Button>
        </Card>
      )}

      {sortedTasks.length > 0 && (() => {
        const done = sortedTasks.filter(t => normalize(t.status) === "concluida").length;
        const total = sortedTasks.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <p className="text-sm font-medium">
                Progresso: {done} de {total} concluída{total === 1 ? "" : "s"}
              </p>
              <span className="text-sm text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} />
          </Card>
        );
      })()}

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
            <p className="text-muted-foreground">
              {toddleConnected 
                ? "Nenhuma tarefa sincronizada do Toddle ainda. Verifique suas atribuições lá."
                : "Nenhuma tarefa criada ainda. Crie uma para começar!"}
            </p>
          </Card>
        ) : (
          sortedTasks.map((task) => {
            const pri = normalize(task.priority);
            const dif = normalize(task.difficulty);
            const isDone = normalize(task.status) === "concluida";
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
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(task.dueDate).toLocaleDateString("pt-BR")}
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
                      onClick={() => handleDelete(task.id)}
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
    </div>
  );
}
