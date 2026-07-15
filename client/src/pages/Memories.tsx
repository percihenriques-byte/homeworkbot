import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatDate } from "@shared/formatDate";
import { Plus, Trash2, Brain, Pencil } from "lucide-react";

type MemoryFormData = {
  title: string;
  category: string;
  content: string;
  source: string;
};

const emptyForm: MemoryFormData = { title: "", category: "", content: "", source: "" };

export default function Memories() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<MemoryFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);

  const { data: memories, isLoading, refetch } = trpc.memories.list.useQuery();
  const createMutation = trpc.memories.create.useMutation();
  const updateMutation = trpc.memories.update.useMutation();
  const deleteMutation = trpc.memories.delete.useMutation();

  const isEditing = editingId !== null;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (memory: any) => {
    setEditingId(memory.id);
    setFormData({
      title: String(memory.title ?? ""),
      category: String(memory.category ?? ""),
      content: String(memory.content ?? ""),
      source: String(memory.source ?? ""),
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: editingId!, ...formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setFormData(emptyForm);
      setEditingId(null);
      setIsOpen(false);
      await refetch();
      toast.success(isEditing ? "Memória atualizada!" : "Memória adicionada com sucesso!");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar memória");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    // Captura a memória completa ANTES de deletar, pra conseguir recriar
    // caso o usuário clique em "Desfazer".
    const removed = (memories as any[] | undefined)?.find((m) => m.id === deleteConfirm.id);
    try {
      await deleteMutation.mutateAsync({ id: deleteConfirm.id });
      setDeleteConfirm(null);
      await refetch();
      toast.success("Memória removida", {
        action: removed
          ? {
              label: "Desfazer",
              onClick: async () => {
                try {
                  await createMutation.mutateAsync({
                    title: String(removed.title ?? ""),
                    category: removed.category ? String(removed.category) : undefined,
                    content: String(removed.content ?? ""),
                    source: removed.source ? String(removed.source) : undefined,
                  });
                  await refetch();
                  toast.success("Memória restaurada");
                } catch (err: any) {
                  toast.error(err?.message || "Não foi possível restaurar");
                }
              },
            }
          : undefined,
      });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao remover memória");
    }
  };

  const newButton = (
    <Button className="gap-2 min-h-11" onClick={openCreate}>
      <Plus className="w-4 h-4" />
      {memories && memories.length > 0 ? "Nova Memória" : "Adicionar Primeira Memória"}
    </Button>
  );

  const dialog = (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setFormData(emptyForm);
        setEditingId(null);
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Memória" : "Adicionar Nova Memória"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Título *</label>
            <Input
              placeholder="Ex: Conversa ChatGPT - Matemática"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-input border-input min-h-11"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Categoria</label>
              <Input
                placeholder="Ex: Meu estilo de escrita"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="bg-input border-input min-h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Fonte</label>
              <Input
                placeholder="Ex: ChatGPT, Claude, Gemini"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="bg-input border-input min-h-11"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Conteúdo *</label>
            <Textarea
              placeholder="Cole a conversa completa ou texto de referência aqui..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="bg-input border-input min-h-40 sm:min-h-64"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {formData.content.length.toLocaleString("pt-BR")} caracteres
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto min-h-11">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto min-h-11">
              {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar Memória"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-6 h-6 text-purple-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">Memórias</h1>
            <p className="text-sm text-muted-foreground break-words">Importe conversas para personalizar sua IA</p>
          </div>
        </div>
        {memories && memories.length > 0 && newButton}
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card className="bg-card/50 border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Carregando memórias...</p>
          </Card>
        ) : memories && memories.length > 0 ? (
          memories.map((memory: any) => {
            const rawContent = String(memory.content ?? "");
            const preview =
              rawContent.length > 150
                ? rawContent.substring(0, 150).trim() + "…"
                : rawContent;
            return (
              <Card
                key={memory.id}
                className="bg-card/50 border-border hover:border-primary/50 transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-foreground break-words">{memory.title}</h3>
                      {memory.source && (
                        <Badge variant="secondary" className="text-xs">
                          {memory.source}
                        </Badge>
                      )}
                    </div>
                    {memory.category && (
                      <p className="text-sm text-muted-foreground mb-2 break-words">
                        Categoria: {memory.category}
                      </p>
                    )}
                    <p className="text-sm text-foreground/80 line-clamp-2 break-words">{preview}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Criada em {formatDate(memory.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-1 self-end sm:self-start">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(memory)}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-11 w-11"
                      aria-label="Editar memória"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm({ id: memory.id, title: memory.title })}
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-11 w-11"
                      aria-label="Remover memória"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="bg-card/50 border-border p-6 sm:p-8 text-center">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">Nenhuma memória adicionada ainda</p>
            <p className="text-sm text-muted-foreground mb-6 break-words">
              Importe conversas de outros AIs (ChatGPT, Claude, Gemini) para personalizar sua IA
            </p>
            {newButton}
          </Card>
        )}
      </div>

      {dialog}

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta memória?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              "{deleteConfirm?.title}" será removida permanentemente. Sua IA vai perder essa referência de estilo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removendo..." : "Sim, remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-blue-500/10 border-blue-500/30 p-4">
        <h3 className="font-semibold text-blue-300 mb-2">Como usar Memórias</h3>
        <ul className="text-sm text-blue-200 space-y-1 break-words">
          <li>• Copie conversas completas de ChatGPT, Claude, Gemini ou outros AIs</li>
          <li>• Cole aqui para que sua IA aprenda seu estilo de comunicação</li>
          <li>• Adicione exemplos de redações, respostas ou conversas que você gostou</li>
          <li>• Quanto mais memórias, mais personalizada será sua IA</li>
        </ul>
      </Card>
    </div>
  );
}
