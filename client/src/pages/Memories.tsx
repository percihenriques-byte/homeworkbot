import { useRef, useState } from "react";
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
import { Plus, Trash2, Brain, Pencil, ImagePlus, X, Loader2 } from "lucide-react";

type MemoryFormData = {
  title: string;
  category: string;
  content: string;
  source: string;
  imageUrls: string[];
};

const emptyForm: MemoryFormData = { title: "", category: "", content: "", source: "", imageUrls: [] };

// Converte Uint8Array em base64 sem estourar o limite de argumentos do
// spread. Reutilizamos o mesmo padrão usado no Chat.tsx.
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export default function Memories() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<MemoryFormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: memories, isLoading, refetch } = trpc.memories.list.useQuery();
  const createMutation = trpc.memories.create.useMutation();
  const updateMutation = trpc.memories.update.useMutation();
  const deleteMutation = trpc.memories.delete.useMutation();
  const uploadMutation = trpc.upload.file.useMutation();

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
      imageUrls: Array.isArray(memory.imageUrls) ? memory.imageUrls.map(String) : [],
    });
    setIsOpen(true);
  };

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Cap total pra respeitar o limite do backend (20 imagens por memória).
    const remaining = 20 - formData.imageUrls.length;
    if (remaining <= 0) {
      toast.error("Máximo 20 imagens por memória.");
      return;
    }
    const arr = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of arr) {
        if (!file.type.startsWith("image/")) {
          toast.error(`"${file.name}" não é imagem — pulei.`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`"${file.name}" excede 10MB — pulei.`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const base64 = uint8ToBase64(new Uint8Array(buffer));
        const res = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
        });
        uploaded.push(res.url);
      }
      if (uploaded.length > 0) {
        setFormData((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ...uploaded] }));
        toast.success(`${uploaded.length} imagem(ns) anexada(s)`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }
    try {
      const basePayload = {
        title: formData.title,
        category: formData.category || undefined,
        content: formData.content,
        source: formData.source || undefined,
      };
      if (isEditing) {
        // Sempre manda imageUrls no update — se o usuário removeu todas,
        // precisa persistir array vazio (undefined faria drizzle manter
        // as antigas).
        await updateMutation.mutateAsync({
          id: editingId!,
          ...basePayload,
          imageUrls: formData.imageUrls,
        });
      } else {
        await createMutation.mutateAsync({
          ...basePayload,
          imageUrls: formData.imageUrls.length > 0 ? formData.imageUrls : undefined,
        });
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
                    imageUrls: Array.isArray(removed.imageUrls) ? removed.imageUrls.map(String) : undefined,
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
              placeholder="Ex: Redação Independência (feita à mão)"
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
                placeholder="Ex: ChatGPT, Claude, Foto da minha prova"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="bg-input border-input min-h-11"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Conteúdo *</label>
            <Textarea
              placeholder="Cole a conversa completa, texto de referência, ou descreva a atividade..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="bg-input border-input min-h-40 sm:min-h-64"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {formData.content.length.toLocaleString("pt-BR")} caracteres
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
              <ImagePlus className="w-4 h-4" />
              Fotos de atividades <span className="text-muted-foreground">(opcional, até 20)</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2 break-words">
              Envie fotos de atividades que você já respondeu — à mão ou digitadas.
              A IA olha as imagens junto com o texto pra imitar sua letra, formato
              e jeito de responder.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddImages(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {formData.imageUrls.map((url, idx) => (
                <div
                  key={url + idx}
                  className="relative w-20 h-20 rounded-md border border-border overflow-hidden bg-muted group"
                >
                  <img
                    src={url}
                    alt={`Anexo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    aria-label={`Remover imagem ${idx + 1}`}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {formData.imageUrls.length < 20 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-20 h-20 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Adicionar imagens"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
            {formData.imageUrls.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {formData.imageUrls.length} de 20 imagens.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto min-h-11">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || uploading}
              className="w-full sm:w-auto min-h-11"
            >
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
            <p className="text-sm text-muted-foreground break-words">Textos e imagens pra IA aprender seu jeito</p>
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
            const images: string[] = Array.isArray(memory.imageUrls)
              ? memory.imageUrls.map(String)
              : [];
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
                      {images.length > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ImagePlus className="w-3 h-3" />
                          {images.length}
                        </Badge>
                      )}
                    </div>
                    {memory.category && (
                      <p className="text-sm text-muted-foreground mb-2 break-words">
                        Categoria: {memory.category}
                      </p>
                    )}
                    <p className="text-sm text-foreground/80 line-clamp-2 break-words">{preview}</p>
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {images.slice(0, 4).map((url, i) => (
                          <a
                            key={url + i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-14 h-14 rounded border border-border overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                            aria-label={`Ver imagem ${i + 1}`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                        {images.length > 4 && (
                          <div className="w-14 h-14 rounded border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            +{images.length - 4}
                          </div>
                        )}
                      </div>
                    )}
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
              Cole conversas de outras IAs OU envie fotos de atividades que você já fez —
              a IA aprende seu jeito.
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
          <li>• Cole conversas de ChatGPT, Claude, Gemini ou redações que você gostou</li>
          <li>• <strong>Envie fotos de atividades já respondidas</strong> (à mão ou digitadas) — a IA imita seu jeito</li>
          <li>• A IA usa texto + imagens juntos pra completar tarefas no seu estilo</li>
          <li>• Quanto mais memórias, mais personalizada será sua IA</li>
        </ul>
      </Card>
    </div>
  );
}
