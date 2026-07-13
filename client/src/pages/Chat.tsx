import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Image as ImageIcon, Loader2, Paperclip, Pencil, Plus, Send, Trash2, X } from "lucide-react";
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
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type Attachment = { name: string; url: string; type: "image" | "document" | "audio" };

export default function Chat() {
  const { data: conversations, refetch } = trpc.conversations.list.useQuery();
  const createConvMutation = trpc.conversations.create.useMutation();
  const deleteConvMutation = trpc.conversations.delete.useMutation();
  const renameConvMutation = trpc.conversations.rename.useMutation();
  const sendMessageMutation = trpc.chat.message.useMutation();
  const uploadMutation = trpc.upload.file.useMutation();

  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const selectedConv = conversations?.find(c => c.id === selectedConvId) as any;
  const messages: any[] = Array.isArray(selectedConv?.messages) ? selectedConv.messages : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedConvId, sendMessageMutation.isPending]);

  // Ao trocar de conversa (ou criar), foca no input. Em mobile o navegador
  // pode ignorar o focus() por politica de gesture — o rAF ajuda a dar
  // uma janela minima pra virtual keyboard nao roubar o foco.
  useEffect(() => {
    if (selectedConvId === null) return;
    const id = requestAnimationFrame(() => messageInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [selectedConvId]);

  const handleCreateConversation = async () => {
    try {
      const result = await createConvMutation.mutateAsync({});
      await refetch();
      if (result && typeof result === "object" && "id" in result && typeof result.id === "number") {
        setSelectedConvId(result.id);
      }
      setIsOpen(false);
      toast.success("Conversa criada!");
    } catch {
      toast.error("Erro ao criar conversa");
    }
  };

  const handleSendMessage = async () => {
    const hasText = messageInput.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || !selectedConvId || sendMessageMutation.isPending) return;
    const outgoing = messageInput;
    const outgoingAttachments = pendingAttachments;
    setMessageInput("");
    setPendingAttachments([]);
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConvId,
        message: outgoing || "(arquivo anexado)",
        fileUrls: outgoingAttachments.map((a) => ({ url: a.url, type: a.type })),
      });
      await refetch();
    } catch {
      toast.error("Erro ao enviar mensagem");
      setMessageInput(outgoing);
      setPendingAttachments(outgoingAttachments);
    }
  };

  const inferAttachmentType = (mime: string): Attachment["type"] => {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    return "document";
  };

  // Converte Uint8Array em base64 sem estourar o limite de argumentos
  // do .apply/spread. String.fromCharCode(...bigArray) trava em arquivos
  // grandes (> ~50k chars nos browsers).
  const uint8ToBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    const chunkSize = 0x8000; // 32KB por vez
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`"${file.name}" excede 10MB e foi ignorado`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const base64 = uint8ToBase64(new Uint8Array(buffer));
        const res = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          mimeType: file.type || "application/octet-stream",
        });
        uploaded.push({
          name: file.name,
          url: res.url,
          type: inferAttachmentType(file.type || ""),
        });
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
      if (uploaded.length > 0) {
        toast.success(`${uploaded.length} arquivo(s) anexado(s)`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const startRename = (conv: any) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title || "");
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const commitRename = async () => {
    if (renamingId === null) return;
    const newTitle = renameValue.trim();
    if (!newTitle) {
      cancelRename();
      return;
    }
    try {
      await renameConvMutation.mutateAsync({ id: renamingId, title: newTitle });
      await refetch();
      toast.success("Conversa renomeada");
    } catch {
      toast.error("Erro ao renomear");
    } finally {
      cancelRename();
    }
  };

  const handleDeleteConversation = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteConvMutation.mutateAsync({ id: deleteConfirm.id });
      if (selectedConvId === deleteConfirm.id) setSelectedConvId(null);
      setDeleteConfirm(null);
      await refetch();
      toast.success("Conversa deletada!");
    } catch {
      toast.error("Erro ao deletar conversa");
    }
  };

  return (
    <div className="flex gap-4 md:gap-6 h-[calc(100vh-140px)] md:h-[calc(100vh-200px)] flex-col md:flex-row">
      <div className="w-full md:w-64 md:border-r border-border flex flex-col border-b md:border-b-0 max-h-40 md:max-h-none">
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Conversas</h2>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Nova conversa">
                <Plus className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conversa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Crie uma nova conversa com o assistente de IA.</p>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button variant="outline" onClick={() => setIsOpen(false)} className="min-h-11">Cancelar</Button>
                  <Button onClick={handleCreateConversation} disabled={createConvMutation.isPending} className="min-h-11">
                    {createConvMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 p-3 md:p-4">
          {conversations?.map((conv) => {
            const isRenaming = renamingId === conv.id;
            return (
              <div
                key={conv.id}
                className={`p-3 rounded transition-colors flex items-center justify-between group min-h-11 gap-1 ${
                  selectedConvId === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                } ${isRenaming ? "cursor-default" : "cursor-pointer"}`}
                onClick={() => !isRenaming && setSelectedConvId(conv.id)}
              >
                {isRenaming ? (
                  <Input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 flex-1 min-w-0"
                  />
                ) : (
                  <span className="truncate flex-1 break-words">
                    {conv.title || "Sem título"}
                  </span>
                )}
                {!isRenaming && (
                  <div className="flex items-center gap-0 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Renomear conversa"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(conv);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Deletar conversa"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ id: conv.id, title: conv.title || "Sem título" });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {conversations && conversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma conversa ainda. Clique em + para criar.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {selectedConv ? (
          <>
            <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4">
              {messages.map((msg: any, idx: number) => {
                const content = typeof msg.content === "string" ? msg.content : String(msg.content ?? "");
                const attachments: any[] = Array.isArray(msg.attachments) ? msg.attachments : [];
                return (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] md:max-w-md px-4 py-2 rounded-lg break-words ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}>
                      {attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {attachments.map((att: any, aidx: number) => (
                            att.type === "image" ? (
                              <img
                                key={aidx}
                                src={att.url}
                                alt="Anexo"
                                className="rounded max-w-full max-h-64 object-contain"
                              />
                            ) : (
                              <a
                                key={aidx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 underline hover:opacity-80"
                              >
                                <Paperclip className="w-4 h-4" />
                                Ver arquivo
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{content}</Streamdown>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] md:max-w-md px-4 py-2 rounded-lg bg-muted text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-2 md:p-4 space-y-2">
              {pendingAttachments.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {pendingAttachments.map((a, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm max-w-full"
                    >
                      {a.type === "image" ? (
                        <ImageIcon className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <Paperclip className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span className="truncate max-w-[180px]">{a.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        aria-label="Remover anexo"
                        onClick={() => removePendingAttachment(idx)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-col md:flex-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFilePick}
                  accept="image/*,application/pdf,audio/*"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 md:self-auto self-end"
                  aria-label="Anexar arquivo"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sendMessageMutation.isPending}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </Button>
                <Input
                  ref={messageInputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={pendingAttachments.length > 0 ? "Descreva o anexo (opcional)..." : "Digite sua mensagem..."}
                  disabled={sendMessageMutation.isPending}
                  className="w-full md:flex-1 min-h-11"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={
                    sendMessageMutation.isPending ||
                    (!messageInput.trim() && pendingAttachments.length === 0)
                  }
                  className="w-full md:w-auto min-h-11"
                  aria-label="Enviar mensagem"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
            <div className="max-w-sm space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-semibold text-lg">Comece uma conversa</h2>
              <p className="text-sm text-muted-foreground break-words">
                {conversations && conversations.length === 0
                  ? "Ainda não há nenhuma conversa. Crie a primeira e pergunte qualquer coisa à IA."
                  : "Selecione uma conversa na barra lateral ou crie uma nova."}
              </p>
              <Button
                onClick={handleCreateConversation}
                disabled={createConvMutation.isPending}
                className="min-h-11 gap-2"
              >
                <Plus className="w-4 h-4" />
                {createConvMutation.isPending ? "Criando..." : "Nova conversa"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar esta conversa?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              "{deleteConfirm?.title}" será removida junto com todas as mensagens. Não é possível recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={deleteConvMutation.isPending}
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConvMutation.isPending ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
