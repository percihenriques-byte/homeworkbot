import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, BookOpen, HelpCircle } from "lucide-react";
import { toast } from "sonner";

type Tool = "flashcards" | "quiz" | "guide";

const toolCopy: Record<Tool, { title: string; description: string; button: string; subjectPlaceholder: string }> = {
  flashcards: {
    title: "Flashcards",
    description: "Gere flashcards automaticamente a partir de seu conteúdo.",
    button: "Gerar Flashcards",
    subjectPlaceholder: "Ex: Matemática",
  },
  quiz: {
    title: "Quiz",
    description: "Crie quizzes para testar seu conhecimento.",
    button: "Gerar Quiz",
    subjectPlaceholder: "Ex: História",
  },
  guide: {
    title: "Guia",
    description: "Gere guias de estudo estruturados.",
    button: "Gerar Guia",
    subjectPlaceholder: "Ex: Português",
  },
};

export default function StudyTools() {
  const generateFlashcardsMutation = trpc.studyTools.generateFlashcards.useMutation();
  const generateQuizMutation = trpc.studyTools.generateQuiz.useMutation();
  const generateGuideMutation = trpc.studyTools.generateStudyGuide.useMutation();

  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tool>("flashcards");

  const isPending =
    generateFlashcardsMutation.isPending ||
    generateQuizMutation.isPending ||
    generateGuideMutation.isPending;

  const closeAndReset = () => {
    setIsOpen(false);
    setContent("");
    setSubject("");
  };

  const handleGenerate = async (tool: Tool) => {
    if (!content.trim()) {
      toast.error(`Adicione conteúdo para gerar ${tool === "flashcards" ? "flashcards" : tool === "quiz" ? "o quiz" : "o guia"}`);
      return;
    }
    try {
      if (tool === "flashcards") {
        await generateFlashcardsMutation.mutateAsync({ content, subject });
        toast.success("Flashcards gerados com sucesso!");
      } else if (tool === "quiz") {
        await generateQuizMutation.mutateAsync({ content, subject, questionCount: 5 });
        toast.success("Quiz gerado com sucesso!");
      } else {
        await generateGuideMutation.mutateAsync({ content, subject });
        toast.success("Guia de estudo gerado com sucesso!");
      }
      closeAndReset();
    } catch {
      toast.error("Erro ao gerar conteúdo. Tente novamente.");
    }
  };

  const openWith = (tool: Tool) => {
    setActiveTab(tool);
    setIsOpen(true);
  };

  const renderTabContent = (tool: Tool) => {
    const copy = toolCopy[tool];
    return (
      <TabsContent value={tool} className="space-y-4">
        <p className="text-sm text-muted-foreground">{copy.description}</p>
        <div>
          <label className="text-sm font-medium">Disciplina</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={copy.subjectPlaceholder}
            className="min-h-11 mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Conteúdo *</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole o conteúdo aqui..."
            rows={6}
            className="mt-1"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto min-h-11">
            Cancelar
          </Button>
          <Button
            onClick={() => handleGenerate(tool)}
            disabled={isPending}
            className="w-full sm:w-auto min-h-11"
          >
            {isPending ? "Gerando..." : copy.button}
          </Button>
        </div>
      </TabsContent>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold">Ferramentas de Estudo</h1>
        <Button className="gap-2 min-h-11" onClick={() => setIsOpen(true)}>
          <Wand2 className="w-4 h-4" />
          Gerar com IA
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Ferramentas de Estudo</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tool)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
              <TabsTrigger value="quiz">Quiz</TabsTrigger>
              <TabsTrigger value="guide">Guia</TabsTrigger>
            </TabsList>
            {renderTabContent("flashcards")}
            {renderTabContent("quiz")}
            {renderTabContent("guide")}
          </Tabs>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <ToolCard
          icon={BookOpen}
          title="Flashcards"
          description="Crie e revise flashcards para memorizar conceitos"
          onClick={() => openWith("flashcards")}
        />
        <ToolCard
          icon={HelpCircle}
          title="Quizzes"
          description="Teste seu conhecimento com quizzes interativos"
          onClick={() => openWith("quiz")}
        />
        <ToolCard
          icon={Wand2}
          title="Guias de Estudo"
          description="Gere guias estruturados para seus estudos"
          onClick={() => openWith("guide")}
        />
      </div>
    </div>
  );
}

type ToolCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
};

function ToolCard({ icon: Icon, title, description, onClick }: ToolCardProps) {
  return (
    <Card
      className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer min-h-40"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Icon className="w-12 h-12 mx-auto mb-3 text-primary" />
      <h3 className="font-semibold mb-2 break-words">{title}</h3>
      <p className="text-sm text-muted-foreground break-words">{description}</p>
    </Card>
  );
}
