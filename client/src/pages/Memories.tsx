import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Brain } from "lucide-react";

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

  const { data: memories, refetch } = trpc.memories.list.useQuery();
  const createMutation = trpc.memories.create.useMutation();
  const deleteMutation = trpc.memories.delete.useMutation();

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }
    try {
      await createMutation.mutateAsync(formData);
      setFormData(emptyForm);
      setIsOpen(false);
      await refetch();
      toast.success("Memória adicionada com sucesso!");
    } catch {
      toast.error("Erro ao adicionar memória");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      await refetch();
      toast.success("Memória removida");
    } catch {
      toast.error("Erro ao remover memória");
    }
  };

  const dialog = (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setFormData(emptyForm);
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2 min-h-11">
          <Plus className="w-4 h-4" />
          {memories && memories.length > 0 ? "Nova Memória" : "Adicionar Primeira Memória"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Memória</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Título *</label>
            <Input
              placeholder="Ex: Conversa ChatGPT - Matemática"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-slate-800 border-slate-700 min-h-11"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Categoria</label>
              <Input
                placeholder="Ex: Meu estilo de escrita"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="bg-slate-800 border-slate-700 min-h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Fonte</label>
              <Input
                placeholder="Ex: ChatGPT, Claude, Gemini"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="bg-slate-800 border-slate-700 min-h-11"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-white mb-2 block">Conteúdo *</label>
            <Textarea
              placeholder="Cole a conversa completa ou texto de referência aqui..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="bg-slate-800 border-slate-700 min-h-40 sm:min-h-64"
            />
            <p className="text-xs text-slate-400 mt-2">
              {formData.content.length.toLocaleString("pt-BR")} caracteres
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto min-h-11">
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full sm:w-auto min-h-11">
              {createMutation.isPending ? "Salvando..." : "Salvar Memória"}
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
            <h1 className="text-2xl sm:text-3xl font-bold text-white break-words">Memórias</h1>
            <p className="text-sm text-slate-400 break-words">Importe conversas para personalizar sua IA</p>
          </div>
        </div>
        {memories && memories.length > 0 && dialog}
      </div>

      <div className="grid gap-4">
        {memories && memories.length > 0 ? (
          memories.map((memory: any) => {
            const preview =
              memory.content.length > 150
                ? memory.content.substring(0, 150).trim() + "…"
                : memory.content;
            return (
              <Card
                key={memory.id}
                className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-white break-words">{memory.title}</h3>
                      {memory.source && (
                        <Badge variant="secondary" className="text-xs">
                          {memory.source}
                        </Badge>
                      )}
                    </div>
                    {memory.category && (
                      <p className="text-sm text-slate-400 mb-2 break-words">
                        Categoria: {memory.category}
                      </p>
                    )}
                    <p className="text-sm text-slate-300 line-clamp-2 break-words">{preview}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Criada em {new Date(memory.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(memory.id)}
                    disabled={deleteMutation.isPending}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-11 w-11 self-end sm:self-start"
                    aria-label="Remover memória"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-6 sm:p-8 text-center">
            <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
            <p className="text-slate-400 mb-4">Nenhuma memória adicionada ainda</p>
            <p className="text-sm text-slate-500 mb-6 break-words">
              Importe conversas de outros AIs (ChatGPT, Claude, Gemini) para personalizar sua IA
            </p>
            {dialog}
          </Card>
        )}
      </div>

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
