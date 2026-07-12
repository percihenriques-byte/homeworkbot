import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Clock, Zap, AlertCircle } from "lucide-react";
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

  const sortedTasks = (tasks || []).sort((a, b) => {
    const priorityOrder = { alta: 0, média: 1, baixa: 2 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 3;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 3;
    return aPriority - bPriority;
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
        <Card className="bg-green-500/10 border-green-500/20 p-4 flex items-start gap-3">
          <Zap className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-900">Conectado ao Toddle</p>
            <p className="text-sm text-green-800">Sincronização automática ativa - suas tarefas do Toddle aparecem aqui.</p>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Minhas Tarefas</h1>
        {!toddleConnected && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
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
                  <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
                  <Button onClick={handleSubmit} disabled={createTaskMutation.isPending || updateTaskMutation.isPending} className="w-full sm:w-auto">
                    {editingId ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
          sortedTasks.map((task) => (
            <Card key={task.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{task.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${difficultyColors[task.difficulty as keyof typeof difficultyColors]}`}>
                      {task.difficulty}
                    </span>
                  </div>
                  {task.description && <p className="text-sm text-muted-foreground mb-2">{task.description}</p>}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {task.subject && <span>📚 {task.subject}</span>}
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
                {!toddleConnected && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
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
                      size="sm"
                      onClick={() => handleDelete(task.id)}
                      disabled={deleteTaskMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
