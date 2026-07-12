import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Schedule() {
  const { data: schedule } = trpc.schedule.get.useQuery();
  const generateMutation = trpc.schedule.generate.useMutation();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync();
      toast.success("Cronograma gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar cronograma");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cronograma de Estudos</h1>
        <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Gerar Cronograma
        </Button>
      </div>

      {schedule && schedule.schedule && Array.isArray(schedule.schedule) && schedule.schedule.length > 0 ? (
        <div className="grid gap-4">
          {schedule.schedule.map((day: any, idx: number) => (
            <Card key={idx} className="p-4">
              <div className="flex items-start gap-4">
                <Calendar className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold">{day.date}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{day.subject}</p>
                  <div className="space-y-1">
                    {day.tasks && day.tasks.map((task: string, tidx: number) => (
                      <p key={tidx} className="text-sm">• {task}</p>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Duração: {day.duration}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Nenhum cronograma gerado ainda.</p>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            Gerar Meu Primeiro Cronograma
          </Button>
        </Card>
      )}
    </div>
  );
}
