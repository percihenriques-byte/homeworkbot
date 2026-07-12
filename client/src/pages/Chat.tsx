import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function Chat() {
  const { data: conversations, refetch } = trpc.conversations.list.useQuery();
  const { data: memories } = trpc.memories.list.useQuery();
  const createConvMutation = trpc.conversations.create.useMutation();
  const deleteConvMutation = trpc.conversations.delete.useMutation();
  const sendMessageMutation = trpc.chat.message.useMutation();

  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedConv = conversations?.find(c => c.id === selectedConvId) as any;

  const handleCreateConversation = async () => {
    try {
      const result = await createConvMutation.mutateAsync({});
      if (result && 'id' in result) {
        setSelectedConvId(result.id as number);
      }
      refetch();
      setIsOpen(false);
      toast.success("Conversa criada!");
    } catch (error) {
      toast.error("Erro ao criar conversa");
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConvId) return;

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConvId,
        message: messageInput,
      });
      setMessageInput("");
      refetch();
    } catch (error) {
      toast.error("Erro ao enviar mensagem");
    }
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      await deleteConvMutation.mutateAsync({ id });
      if (selectedConvId === id) setSelectedConvId(null);
      refetch();
      toast.success("Conversa deletada!");
    } catch (error) {
      toast.error("Erro ao deletar conversa");
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] flex-col md:flex-row">
      <div className="w-full md:w-64 border-r border-border flex flex-col border-b md:border-b-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Conversas</h2>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conversa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Crie uma nova conversa com o assistente de IA.</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateConversation} disabled={createConvMutation.isPending}>
                    Criar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 p-4">
          {conversations?.map((conv) => (
            <div
              key={conv.id}
              className={`p-3 rounded cursor-pointer transition-colors flex items-center justify-between group ${
                selectedConvId === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              onClick={() => setSelectedConvId(conv.id)}
            >
              <span className="truncate flex-1">{conv.title || "Sem título"}</span>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConversation(conv.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 md:min-h-auto">
        {selectedConv ? (
          <>
            <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4">
              {selectedConv.messages && Array.isArray(selectedConv.messages) && (selectedConv.messages as any[]).map((msg: any, idx: number) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {typeof msg.content === "string" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p>{JSON.stringify(msg.content)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-2 md:p-4 flex gap-2 flex-col md:flex-row">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                disabled={sendMessageMutation.isPending}
                className="w-full md:flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending || !messageInput.trim()}
                className="w-full md:w-auto"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
