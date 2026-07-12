import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Trash2, Brain } from "lucide-react";

export default function Memories() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
    source: "",
  });

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
      setFormData({ title: "", category: "", content: "", source: "" });
      setIsOpen(false);
      refetch();
      toast.success("Memória adicionada com sucesso!");
    } catch (error) {
      toast.error("Erro ao adicionar memória");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      refetch();
      toast.success("Memória removida");
    } catch (error) {
      toast.error("Erro ao remover memória");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Memórias</h1>
            <p className="text-sm text-slate-400">Importe conversas para personalizar sua IA</p>
          </div>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Memória
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
                  className="bg-slate-800 border-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">Categoria</label>
                  <Input
                    placeholder="Ex: Meu estilo de escrita"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">Fonte</label>
                  <Input
                    placeholder="Ex: ChatGPT, Claude, Gemini"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="bg-slate-800 border-slate-700"
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
                  {formData.content.length} caracteres
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full sm:w-auto">
                  {createMutation.isPending ? "Salvando..." : "Salvar Memória"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {memories && memories.length > 0 ? (
          memories.map((memory: any) => (
            <Card
              key={memory.id}
              className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-white truncate">{memory.title}</h3>
                    {memory.source && (
                      <Badge variant="secondary" className="text-xs">
                        {memory.source}
                      </Badge>
                    )}
                  </div>
                  {memory.category && (
                    <p className="text-sm text-slate-400 mb-2">Categoria: {memory.category}</p>
                  )}
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {memory.content.substring(0, 150)}...
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Criada em {new Date(memory.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(memory.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
            <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
            <p className="text-slate-400 mb-4">Nenhuma memória adicionada ainda</p>
            <p className="text-sm text-slate-500 mb-6">
              Importe conversas de outros AIs (ChatGPT, Claude, Gemini) para personalizar sua IA
            </p>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Primeira Memória
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
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">Categoria</label>
                      <Input
                        placeholder="Ex: Meu estilo de escrita"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white mb-2 block">Fonte</label>
                      <Input
                        placeholder="Ex: ChatGPT, Claude, Gemini"
                        value={formData.source}
                        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                        className="bg-slate-800 border-slate-700"
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
                      {formData.content.length} caracteres
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full sm:w-auto">
                      {createMutation.isPending ? "Salvando..." : "Salvar Memória"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </Card>
        )}
      </div>

      <Card className="bg-blue-500/10 border-blue-500/30 p-4">
        <h3 className="font-semibold text-blue-300 mb-2">💡 Como usar Memórias</h3>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• Copie conversas completas de ChatGPT, Claude, Gemini ou outros AIs</li>
          <li>• Cole aqui para que sua IA pessoal aprenda seu estilo de comunicação</li>
          <li>• Adicione exemplos de redações, respostas ou conversas que você gostou</li>
          <li>• Quanto mais memórias, mais personalizada será sua IA!</li>
        </ul>
      </Card>
    </div>
  );
}
