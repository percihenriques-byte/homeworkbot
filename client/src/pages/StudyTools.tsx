import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, BookOpen, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export default function StudyTools() {
  const generateFlashcardsMutation = trpc.studyTools.generateFlashcards.useMutation();
  const generateQuizMutation = trpc.studyTools.generateQuiz.useMutation();
  const generateGuideMutation = trpc.studyTools.generateStudyGuide.useMutation();

  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("flashcards");

  const handleGenerateFlashcards = async () => {
    if (!content.trim()) {
      toast.error("Adicione conteúdo para gerar flashcards");
      return;
    }
    try {
      await generateFlashcardsMutation.mutateAsync({ content, subject });
      toast.success("Flashcards gerados com sucesso!");
      setContent("");
      setSubject("");
      setIsOpen(false);
    } catch (error) {
      toast.error("Erro ao gerar flashcards");
    }
  };

  const handleGenerateQuiz = async () => {
    if (!content.trim()) {
      toast.error("Adicione conteúdo para gerar quiz");
      return;
    }
    try {
      await generateQuizMutation.mutateAsync({ content, subject, questionCount: 5 });
      toast.success("Quiz gerado com sucesso!");
      setContent("");
      setSubject("");
      setIsOpen(false);
    } catch (error) {
      toast.error("Erro ao gerar quiz");
    }
  };

  const handleGenerateGuide = async () => {
    if (!content.trim()) {
      toast.error("Adicione conteúdo para gerar guia");
      return;
    }
    try {
      await generateGuideMutation.mutateAsync({ content, subject });
      toast.success("Guia de estudo gerado com sucesso!");
      setContent("");
      setSubject("");
      setIsOpen(false);
    } catch (error) {
      toast.error("Erro ao gerar guia");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ferramentas de Estudo</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Wand2 className="w-4 h-4" />
              Gerar com IA
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Gerar Ferramentas de Estudo</DialogTitle>
            </DialogHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                <TabsTrigger value="quiz">Quiz</TabsTrigger>
                <TabsTrigger value="guide">Guia</TabsTrigger>
              </TabsList>

              <TabsContent value="flashcards" className="space-y-4">
                <p className="text-sm text-muted-foreground">Gere flashcards automaticamente a partir de seu conteúdo.</p>
                <div>
                  <label className="text-sm font-medium">Disciplina</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Matemática" />
                </div>
                <div>
                  <label className="text-sm font-medium">Conteúdo *</label>
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole o conteúdo aqui..." rows={6} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button onClick={handleGenerateFlashcards} disabled={generateFlashcardsMutation.isPending}>
                    Gerar Flashcards
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="quiz" className="space-y-4">
                <p className="text-sm text-muted-foreground">Crie quizzes para testar seu conhecimento.</p>
                <div>
                  <label className="text-sm font-medium">Disciplina</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: História" />
                </div>
                <div>
                  <label className="text-sm font-medium">Conteúdo *</label>
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole o conteúdo aqui..." rows={6} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button onClick={handleGenerateQuiz} disabled={generateQuizMutation.isPending}>
                    Gerar Quiz
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="guide" className="space-y-4">
                <p className="text-sm text-muted-foreground">Gere guias de estudo estruturados.</p>
                <div>
                  <label className="text-sm font-medium">Disciplina</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Português" />
                </div>
                <div>
                  <label className="text-sm font-medium">Conteúdo *</label>
                  <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Cole o conteúdo aqui..." rows={6} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                  <Button onClick={handleGenerateGuide} disabled={generateGuideMutation.isPending}>
                    Gerar Guia
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Flashcards</h3>
          <p className="text-sm text-muted-foreground">Crie e revise flashcards para memorizar conceitos</p>
        </Card>
        <Card className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer">
          <HelpCircle className="w-12 h-12 mx-auto mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Quizzes</h3>
          <p className="text-sm text-muted-foreground">Teste seu conhecimento com quizzes interativos</p>
        </Card>
        <Card className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer">
          <Wand2 className="w-12 h-12 mx-auto mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Guias de Estudo</h3>
          <p className="text-sm text-muted-foreground">Gere guias estruturados para seus estudos</p>
        </Card>
      </div>
    </div>
  );
}
