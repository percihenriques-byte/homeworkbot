import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Schedule() {
  const { data: schedule, refetch } = trpc.schedule.get.useQuery();
  const generateMutation = trpc.schedule.generate.useMutation();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
      await refetch();
      toast.success("Cronograma gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar cronograma");
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
          {generateMutation.isPending ? "Gerando..." : "Gerar Cronograma"}
        </Button>
      </div>

      {scheduleItems.length > 0 ? (
        <div className="grid gap-4">
          {scheduleItems.map((day: any, idx: number) => (
            <Card key={idx} className="p-4">
              <div className="flex items-start gap-4">
                <Calendar className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {day.date && <h3 className="font-semibold break-words">{day.date}</h3>}
                  {day.subject && (
                    <p className="text-sm text-muted-foreground mb-2 break-words">{day.subject}</p>
                  )}
                  <div className="space-y-1">
                    {Array.isArray(day.tasks) &&
                      day.tasks.map((task: string, tidx: number) => (
                        <p key={tidx} className="text-sm break-words">
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
              </div>
            </Card>
          ))}
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
