import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, RefreshCw, CircleCheck, Circle } from "lucide-react";
import { toast } from "sonner";

export default function Schedule() {
  const { data: schedule, isLoading, refetch } = trpc.schedule.get.useQuery();
  const generateMutation = trpc.schedule.generate.useMutation();
  const setDayDoneMutation = trpc.schedule.setDayDone.useMutation();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
      await refetch();
      toast.success("Cronograma gerado com sucesso!");
    } catch (error: any) {
      // Propaga a mensagem do TRPCError (ex: precondição sem tarefas)
      toast.error(error?.message || "Erro ao gerar cronograma");
    }
  };

  const handleToggleDay = async (index: number, done: boolean) => {
    try {
      await setDayDoneMutation.mutateAsync({ index, done });
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar o dia");
    }
  };

  const scheduleItems: any[] =
    schedule && Array.isArray(schedule.schedule) ? (schedule.schedule as any[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold">Cronograma de Estudos</h1>
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="gap-2 min-h-11"
        >
          <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          {generateMutation.isPending
            ? "Gerando..."
            : scheduleItems.length > 0
              ? "Regenerar Cronograma"
              : "Gerar Cronograma"}
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6 sm:p-8 text-center">
          <p className="text-muted-foreground">Carregando cronograma...</p>
        </Card>
      ) : scheduleItems.length > 0 ? (
        <div className="grid gap-4">
          {scheduleItems.map((day: any, idx: number) => {
            const done = !!day.done;
            return (
              <Card key={idx} className={`p-4 transition-opacity ${done ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-4">
                  <Calendar className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {day.date && (
                      <h3 className={`font-semibold break-words ${done ? "line-through" : ""}`}>
                        {day.date}
                      </h3>
                    )}
                    {day.subject && (
                      <p className="text-sm text-muted-foreground mb-2 break-words">{day.subject}</p>
                    )}
                    <div className="space-y-1">
                      {Array.isArray(day.tasks) &&
                        day.tasks.map((task: string, tidx: number) => (
                          <p key={tidx} className={`text-sm break-words ${done ? "line-through text-muted-foreground" : ""}`}>
                            • {task}
                          </p>
                        ))}
                    </div>
                    {day.duration && (
                      <p className="text-xs text-muted-foreground mt-2 break-words">
                        Duração: {day.duration}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={done ? "secondary" : "outline"}
                    size="sm"
                    className="gap-2 min-h-11 flex-shrink-0"
                    onClick={() => handleToggleDay(idx, !done)}
                    disabled={setDayDoneMutation.isPending}
                    aria-label={done ? "Marcar dia como não concluído" : "Marcar dia como concluído"}
                  >
                    {done ? <CircleCheck className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    <span className="hidden sm:inline">{done ? "Concluído" : "Concluir"}</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-6 sm:p-8 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground mb-4 break-words">
            Nenhum cronograma gerado ainda. Crie tarefas primeiro para receber um plano.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="min-h-11"
          >
            {generateMutation.isPending ? "Gerando..." : "Gerar Meu Primeiro Cronograma"}
          </Button>
        </Card>
      )}
    </div>
  );
}
