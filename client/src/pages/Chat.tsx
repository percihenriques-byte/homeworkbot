import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Loader2, Paperclip, Pencil, Plus, Send, Trash2, X, Sparkles } from "lucide-react";
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

type Attachment = { name: string; url: string; type: "image" | "document" | "audio"; mimeType?: string };

export default function Chat() {
  const { data: conversations, isLoading: convsLoading, refetch } = trpc.conversations.list.useQuery();
  const createConvMutation = trpc.conversations.create.useMutation();
  const deleteConvMutation = trpc.conversations.delete.useMutation();
  const renameConvMutation = trpc.conversations.rename.useMutation();
  const sendMessageMutation = trpc.chat.message.useMutation();
  const uploadMutation = trpc.upload.file.useMutation();
  const utils = trpc.useUtils();

  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Textarea que cresce com o conteúdo (estilo Manus/Jarvis), até um teto.
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const selectedConv = conversations?.find(c => c.id === selectedConvId) as any;
  const messages: any[] = Array.isArray(selectedConv?.messages) ? selectedConv.messages : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedConvId, sendMessageMutation.isPending]);

  // Auto-seleciona conversa se veio de outra página (Tasks) via hint no
  // localStorage. Consome uma vez e limpa. Espera as conversas carregarem
  // pra garantir que o id existe.
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;
    try {
      const hintStr = localStorage.getItem("chat-preselect-id");
      if (!hintStr) return;
      const hintId = parseInt(hintStr, 10);
      localStorage.removeItem("chat-preselect-id");
      if (Number.isFinite(hintId) && conversations.some((c) => c.id === hintId)) {
        setSelectedConvId(hintId);
      }
    } catch {
      // storage indisponível — ignora
    }
  }, [conversations]);

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
      toast.success("Conversa criada!");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar conversa");
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
    // Volta o textarea pra 1 linha depois de enviar.
    if (messageInputRef.current) messageInputRef.current.style.height = "auto";
    try {
      const res = await sendMessageMutation.mutateAsync({
        conversationId: selectedConvId,
        message: outgoing || "(arquivo anexado)",
        fileUrls: outgoingAttachments.map((a) => ({ url: a.url, type: a.type, mimeType: a.mimeType })),
      });
      await refetch();
      // Se o agente executou ações (criou tarefa, gerou material, etc),
      // invalida as queries das outras telas pra refletirem na hora, e
      // avisa o usuário do que rolou.
      if (res?.actions && res.actions.length > 0) {
        utils.tasks.list.invalidate();
        utils.flashcards.list.invalidate();
        utils.quizzes.list.invalidate();
        utils.studyGuides.list.invalidate();
        utils.schedule.get.invalidate();
        toast.success(`Jarvis executou ${res.actions.length} ação(ões) 🎯`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar mensagem");
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

  const processFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of arr) {
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
          mimeType: file.type || undefined,
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
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!selectedConvId) {
      toast.error("Selecione uma conversa antes de anexar arquivos");
      return;
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!selectedConvId) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault(); // não cola o filename como texto
      await processFiles(files);
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
    } catch (error: any) {
      toast.error(error?.message || "Erro ao renomear");
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
    } catch (error: any) {
      toast.error(error?.message || "Erro ao deletar conversa");
    }
  };

  return (
    <div
      className={`flex gap-4 md:gap-6 h-[calc(100vh-140px)] md:h-[calc(100vh-200px)] flex-col md:flex-row relative ${isDragging ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""}`}
      onDragOver={(e) => {
        // Só ativa dropzone se ha conv selecionada — evita mostrar
        // overlay quando o usuario ainda nem escolheu conversa.
        if (!selectedConvId) return;
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        // Só cancela se saiu do container inteiro (não para um filho)
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 rounded-lg border-2 border-dashed border-primary pointer-events-none">
          <p className="font-semibold text-primary">Solte para anexar</p>
        </div>
      )}
      <div className="w-full md:w-64 md:border-r border-border flex flex-col border-b md:border-b-0 max-h-56 md:max-h-none">
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Conversas</h2>
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11"
            aria-label="Nova conversa"
            title="Nova conversa"
            onClick={handleCreateConversation}
            disabled={createConvMutation.isPending}
          >
            {createConvMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 p-3 md:p-4">
          {conversations?.map((conv) => {
            const isRenaming = renamingId === conv.id;
            return (
              <div
                key={conv.id}
                role={isRenaming ? undefined : "button"}
                tabIndex={isRenaming ? undefined : 0}
                aria-current={selectedConvId === conv.id ? "true" : undefined}
                className={`p-3 rounded transition-colors flex items-center justify-between group min-h-11 gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedConvId === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                } ${isRenaming ? "cursor-default" : "cursor-pointer"}`}
                onClick={() => !isRenaming && setSelectedConvId(conv.id)}
                onKeyDown={(e) => {
                  if (isRenaming) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedConvId(conv.id);
                  }
                }}
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
                    aria-label="Novo nome da conversa"
                    maxLength={255}
                  />
                ) : (
                  <span className="truncate flex-1 break-words flex items-center gap-1 min-w-0">
                    {conv.taskId && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-500 shrink-0"
                        title="Vinculada a uma tarefa"
                      >
                        Tarefa
                      </span>
                    )}
                    <span className="truncate">{conv.title || "Sem título"}</span>
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
          {convsLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Carregando conversas...
            </p>
          )}
          {!convsLoading && conversations && conversations.length === 0 && (
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
              {messages.length === 0 && !sendMessageMutation.isPending && (
                <div className="max-w-lg mx-auto mt-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto glow-primary">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Oi! Eu sou o Jarvis de Estudos ✨</h3>
                    <p className="text-sm text-muted-foreground break-words">
                      Não só tiro dúvidas — eu <strong>faço</strong>: crio tarefas, gero flashcards, quizzes,
                      guias e cronograma pra você. Peça em linguagem normal.
                    </p>
                  </div>
                  <div className="grid gap-2 text-left">
                    {[
                      "Crie uma tarefa de prova de matemática pra sexta e gere 8 flashcards do assunto",
                      "Gere um quiz de 5 perguntas sobre a Revolução Francesa",
                      "Monte um cronograma de estudos com as minhas tarefas pendentes",
                      "Faça um guia de estudo sobre fotossíntese",
                    ].map((ex) => (
                      <button
                        key={ex}
                        onClick={() => {
                          setMessageInput(ex);
                          messageInputRef.current?.focus();
                          autoResize(messageInputRef.current);
                        }}
                        className="w-full text-left text-sm p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted transition-colors break-words min-h-11"
                      >
                        💡 {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg: any, idx: number) => {
                const content = typeof msg.content === "string" ? msg.content : String(msg.content ?? "");
                const attachments: any[] = Array.isArray(msg.attachments) ? msg.attachments : [];
                return (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`px-4 py-2 rounded-lg break-words ${
                      msg.role === "user"
                        ? "max-w-[85%] md:max-w-md bg-primary text-primary-foreground"
                        : "max-w-[92%] md:max-w-2xl bg-muted text-foreground"
                    }`}>
                      {attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {attachments.map((att: any, aidx: number) => (
                            att.type === "image" ? (
                              <a
                                key={aidx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir imagem em nova aba"
                              >
                                <img
                                  src={att.url}
                                  alt="Anexo"
                                  className="rounded max-w-full max-h-64 object-contain hover:opacity-90 transition-opacity"
                                />
                              </a>
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
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-sm">Jarvis está planejando e executando...</span>
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
                <Textarea
                  ref={messageInputRef}
                  value={messageInput}
                  rows={1}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={(e) => {
                    // Enter envia; Shift+Enter quebra linha (estilo Manus).
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  onPaste={handlePaste}
                  placeholder={pendingAttachments.length > 0 ? "Descreva o anexo (opcional)..." : "Peça algo ao Jarvis... (ex: crie uma tarefa e gere flashcards)"}
                  disabled={sendMessageMutation.isPending}
                  className="w-full md:flex-1 min-h-11 max-h-40 resize-none"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={
                    sendMessageMutation.isPending ||
                    uploading ||
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
