import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Check, Clock, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@shared/formatDate";
import { Streamdown } from "streamdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// "Feitas pela IA" — lista as tarefas que a IA já resolveu (completedContent
// preenchido pelo autoComplete/pipeline do Toddle). Aqui você vê o que ela
// produziu, copia o texto, ou abre a tarefa pra editar/enviar.
export default function AiCompleted() {
  const utils = trpc.useUtils();
  const tasksQ = trpc.tasks.list.useQuery();
  const syncMut = trpc.toddle.sync.useMutation({
    onSuccess: (r: any) => {
      const imp = r?.imported ?? 0;
      const auto = r?.autoCompleted ?? 0;
      toast.success(
        `Sync feito: ${imp} nova(s) tarefa(s)` + (auto ? `, ${auto} feita(s) pela IA` : "")
      );
      utils.tasks.list.invalidate();
    },
    onError: (err) => toast.error(err?.message ?? "Não consegui sincronizar."),
  });

  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const aiTasks = useMemo(() => {
    const tasks = tasksQ.data ?? [];
    return tasks
      .filter((t: any) => typeof t.completedContent === "string" && t.completedContent.trim().length > 0)
      .sort((a: any, b: any) => {
        const av = new Date(a.updatedAt ?? a.completedAt ?? 0).getTime();
        const bv = new Date(b.updatedAt ?? b.completedAt ?? 0).getTime();
        return bv - av;
      });
  }, [tasksQ.data]);

  const openTask = aiTasks.find((t: any) => t.id === openTaskId) ?? null;

  const copy = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copiado.");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Não consegui copiar.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Feitas pela IA</h1>
            <p className="text-sm text-muted-foreground">
              Tarefas que o Jarvis resolveu automaticamente no seu estilo.
            </p>
          </div>
        </div>
        <Button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          variant="outline"
          className="gap-2"
        >
          {syncMut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Puxar agora
        </Button>
      </div>

      {tasksQ.isLoading ? (
        <div className="text-center text-muted-foreground py-10">Carregando...</div>
      ) : aiTasks.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-purple-500/60" />
          </div>
          <p className="text-base font-medium">Nada aqui ainda.</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Configure o link do calendário do Toddle em <strong>Configurações</strong> e ative
            <strong> "Fazer as tarefas por mim"</strong>. As tarefas novas vão aparecer aqui prontas,
            no seu estilo (a IA lê suas Memórias).
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {aiTasks.map((task: any) => {
            const preview = String(task.completedContent).slice(0, 200);
            const isLong = String(task.completedContent).length > 200;
            return (
              <Card key={task.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base truncate">{task.title}</h3>
                    {(task.subject || task.dueDate) && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                        {task.subject && <span>{task.subject}</span>}
                        {task.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(task.id, task.completedContent)}
                      className="gap-1"
                    >
                      {copiedId === task.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenTaskId(task.id)}
                      className="gap-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {preview}
                  {isLong && "…"}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={openTaskId !== null} onOpenChange={(o) => !o && setOpenTaskId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">{openTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
            {openTask?.completedContent ? (
              <Streamdown>{openTask.completedContent}</Streamdown>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            {openTask && (
              <Button
                variant="outline"
                onClick={() => copy(openTask.id, openTask.completedContent ?? "")}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copiar tudo
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
