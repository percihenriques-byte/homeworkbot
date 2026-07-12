import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, MessageSquare, Settings as SettingsIcon, BookOpen, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("integracao");
  const { data: prefs } = trpc.preferences.get.useQuery();
  const { data: integrationSettings } = trpc.integrationSettings.get.useQuery();
  const updatePrefsMutation = trpc.preferences.update.useMutation();
  const updateIntegrationMutation = trpc.integrationSettings.update.useMutation();

  const [prefsData, setPrefsData] = useState({
    smtpEmail: "",
    smtpPassword: "",
    smtpHost: "",
    smtpPort: 587,
    whatsappNumber: "",
    whatsappApiKey: "",
    aiStyle: "",
  });

  const [integrationData, setIntegrationData] = useState({
    emailSenderEmail: "",
    whatsappPhoneNumber: "",
    toddleEmail: "",
    toddlePassword: "",
    toddleProvider: "Lex Brasil",
    gmailUser: "",
    gmailAppPassword: "",
  });

  const sendTestEmailMutation = trpc.email.sendTest.useMutation();

  useEffect(() => {
    if (prefs) {
      setPrefsData({
        smtpEmail: prefs.smtpEmail || "",
        smtpPassword: prefs.smtpPassword || "",
        smtpHost: prefs.smtpHost || "",
        smtpPort: prefs.smtpPort || 587,
        whatsappNumber: prefs.whatsappNumber || "",
        whatsappApiKey: prefs.whatsappApiKey || "",
        aiStyle: prefs.aiStyle || "",
      });
    }
  }, [prefs]);

  useEffect(() => {
    if (integrationSettings) {
      setIntegrationData({
        emailSenderEmail: integrationSettings.emailSenderEmail || "",
        whatsappPhoneNumber: integrationSettings.whatsappPhoneNumber || "",
        toddleEmail: integrationSettings.toddleEmail || "",
        toddlePassword: integrationSettings.toddlePassword || "",
        toddleProvider: integrationSettings.toddleProvider || "Lex Brasil",
        gmailUser: integrationSettings.gmailUser || "",
        gmailAppPassword: integrationSettings.gmailAppPassword || "",
      });
    }
  }, [integrationSettings]);

  const handleSavePrefs = async () => {
    try {
      await updatePrefsMutation.mutateAsync(prefsData);
      toast.success("Preferências salvas!");
    } catch (error) {
      toast.error("Erro ao salvar preferências");
    }
  };

  const validateIntegration = (): string | null => {
    if (
      !integrationData.emailSenderEmail &&
      !integrationData.whatsappPhoneNumber &&
      !integrationData.toddleEmail &&
      !integrationData.gmailUser
    ) {
      return "Adicione pelo menos um email, telefone, conta Toddle ou Gmail";
    }
    if (
      (integrationData.gmailUser && !integrationData.gmailAppPassword) ||
      (!integrationData.gmailUser && integrationData.gmailAppPassword)
    ) {
      return "Configure tanto o Email do Gmail quanto a Senha de App";
    }
    return null;
  };

  const handleSaveIntegration = async () => {
    const err = validateIntegration();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      await updateIntegrationMutation.mutateAsync(integrationData);
      toast.success("Integrações configuradas!");
    } catch (error) {
      toast.error("Erro ao configurar integrações");
    }
  };

  const handleSendTestEmail = async () => {
    if (!integrationData.emailSenderEmail) {
      toast.error("Preencha o campo Email primeiro");
      return;
    }
    if (!integrationData.gmailUser || !integrationData.gmailAppPassword) {
      toast.error("Configure Gmail + Senha de App antes de enviar o teste");
      return;
    }
    try {
      // Salva primeiro pra que o servidor use as credenciais que estao na tela,
      // nao as antigas do banco. Antes, digitar email/senha nova e clicar em
      // "Testar" sem salvar disparava com dados velhos e o teste falhava sem
      // mensagem clara.
      await updateIntegrationMutation.mutateAsync(integrationData);
      await sendTestEmailMutation.mutateAsync({ toEmail: integrationData.emailSenderEmail });
      toast.success("Email de teste enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      toast.error("Erro ao enviar email de teste: " + (error?.message || "Tente novamente"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
          <SettingsIcon className="w-6 h-6 text-slate-300" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white break-words">Configurações</h1>
          <p className="text-sm text-slate-400 break-words">Personalize sua experiência e integrações</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="integracao">Integrações</TabsTrigger>
          <TabsTrigger value="ai">Estilo IA</TabsTrigger>
        </TabsList>

        {/* INTEGRAÇÕES TAB */}
        <TabsContent value="integracao" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <h2 className="font-semibold text-white mb-6">Configuração Rápida</h2>

            <div className="space-y-6">
              {/* Email */}
              <div className="border-b border-slate-700 pb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Email para Receber Tarefas</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Seu Email</label>
                  <Input
                    type="email"
                    value={integrationData.emailSenderEmail}
                    onChange={(e) =>
                      setIntegrationData({
                        ...integrationData,
                        emailSenderEmail: e.target.value,
                      })
                    }
                    placeholder="seu@email.com"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-400">
                    Você receberá as tarefas completadas neste email
                  </p>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="border-b border-slate-700 pb-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold text-white">WhatsApp para Lembretes</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Seu Número WhatsApp</label>
                  <Input
                    value={integrationData.whatsappPhoneNumber}
                    onChange={(e) =>
                      setIntegrationData({
                        ...integrationData,
                        whatsappPhoneNumber: e.target.value,
                      })
                    }
                    placeholder="+55 11 99999-9999"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-400">
                    Você receberá lembretes de tarefas por WhatsApp
                  </p>
                </div>
              </div>

              {/* Toddle */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-white">Toddle/Nordcraft</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-white">Tipo de Toddle</label>
                    <Select value={integrationData.toddleProvider} onValueChange={(value) =>
                      setIntegrationData({
                        ...integrationData,
                        toddleProvider: value,
                      })
                    }>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="Lex Brasil">Lex Brasil</SelectItem>
                        <SelectItem value="Toddle Direct">Toddle Direct</SelectItem>
                        <SelectItem value="Google">Google</SelectItem>
                        <SelectItem value="Microsoft">Microsoft</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white">Usuário do Toddle</label>
                    <Input
                      type="text"
                      value={integrationData.toddleEmail}
                      onChange={(e) =>
                        setIntegrationData({
                          ...integrationData,
                          toddleEmail: e.target.value,
                        })
                      }
                      placeholder="seu_usuario_ou_email@toddle.com"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white">Senha do Toddle</label>
                    <Input
                      type="password"
                      value={integrationData.toddlePassword}
                      onChange={(e) =>
                        setIntegrationData({
                          ...integrationData,
                          toddlePassword: e.target.value,
                        })
                      }
                      placeholder="Sua senha"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Use seu nome de usuário ou email do Toddle. Suas credenciais são criptografadas e usadas apenas para sincronizar com Toddle.
                  </p>
                                </div>
              </div>
            </div>

            {/* Gmail Section */}
            <div className="bg-slate-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Gmail (Seu Próprio)</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-white">Email do Gmail</label>
                  <Input
                    type="email"
                    value={integrationData.gmailUser}
                    onChange={(e) =>
                      setIntegrationData({
                        ...integrationData,
                        gmailUser: e.target.value,
                      })
                    }
                    placeholder="seu_email@gmail.com"
                    className="bg-slate-600 border-slate-500 text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-white">Senha de App do Google</label>
                  <Input
                    type="password"
                    value={integrationData.gmailAppPassword}
                    onChange={(e) =>
                      setIntegrationData({
                        ...integrationData,
                        gmailAppPassword: e.target.value,
                      })
                    }
                    placeholder="Sua senha de app"
                    className="bg-slate-600 border-slate-500 text-white mt-1"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Gere sua senha de app em <strong>myaccount.google.com → Segurança → Senhas de app</strong>. Suas credenciais são criptografadas e usadas apenas para enviar emails.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-6">
              <Button
                onClick={handleSaveIntegration}
                disabled={updateIntegrationMutation.isPending || sendTestEmailMutation.isPending}
                size="lg"
                className="w-full sm:w-auto min-h-12"
              >
                {updateIntegrationMutation.isPending ? "Salvando..." : "Salvar Integrações"}
              </Button>
              <Button
                onClick={handleSendTestEmail}
                disabled={sendTestEmailMutation.isPending || updateIntegrationMutation.isPending}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto min-h-12 gap-2"
              >
                <Send className="w-4 h-4" />
                {sendTestEmailMutation.isPending || updateIntegrationMutation.isPending
                  ? "Enviando..."
                  : "Enviar Email de Teste"}
              </Button>
            </div>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/30 p-4">
            <h3 className="font-semibold text-blue-300 mb-2">Sem configuração técnica</h3>
            <p className="text-sm text-blue-200 break-words">
              Nada de SMTP host/port, tokens ou API keys expostos. Você só precisa
              informar seu Gmail (com Senha de App), seu WhatsApp e as credenciais do
              Toddle — o resto é automático.
            </p>
          </Card>
        </TabsContent>

        {/* AI STYLE TAB */}
        <TabsContent value="ai" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <h2 className="font-semibold text-white mb-4">Estilo Preferido da IA</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white mb-2 block">
                  Descreva seu estilo de aprendizado
                </label>
                <Textarea
                  value={prefsData.aiStyle}
                  onChange={(e) => setPrefsData({ ...prefsData, aiStyle: e.target.value })}
                  placeholder="Ex: Prefiro explicações concisas com exemplos práticos. Gosto de analogias do mundo real."
                  rows={4}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <p className="text-xs text-slate-400">
                A IA usará essas informações para adaptar suas respostas ao seu estilo de aprendizado.
              </p>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Button
              onClick={handleSavePrefs}
              disabled={updatePrefsMutation.isPending}
              size="lg"
              className="w-full sm:w-auto min-h-12"
            >
              {updatePrefsMutation.isPending ? "Salvando..." : "Salvar Preferências"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
