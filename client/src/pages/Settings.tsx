import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, MessageSquare, Settings as SettingsIcon, BookOpen, Send, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("integracao");
  const { theme, toggleTheme } = useTheme();
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
    emailSenderName: "",
    whatsappPhoneNumber: "",
    toddleEmail: "",
    toddlePassword: "",
    toddleProvider: "Lex Brasil",
    gmailUser: "",
    gmailAppPassword: "",
  });

  const [showToddlePw, setShowToddlePw] = useState(false);
  const [showGmailPw, setShowGmailPw] = useState(false);

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
        emailSenderName: integrationSettings.emailSenderName || "",
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
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar preferências");
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
    } catch (error: any) {
      toast.error(error?.message || "Erro ao configurar integrações");
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
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <SettingsIcon className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">Configurações</h1>
          <p className="text-sm text-muted-foreground break-words">Personalize sua experiência e integrações</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="integracao">Integrações</TabsTrigger>
          <TabsTrigger value="ai">Estilo IA</TabsTrigger>
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
        </TabsList>

        {/* INTEGRAÇÕES TAB */}
        <TabsContent value="integracao" className="space-y-4">
          <Card className="bg-card/50 border-border p-6">
            <h2 className="font-semibold text-foreground mb-6">Configuração Rápida</h2>

            <div className="space-y-6">
              {/* Email */}
              <div className="border-b border-border pb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-foreground">Email para Receber Tarefas</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Seu Email</label>
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
                    className="bg-input border-input text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você receberá as tarefas completadas neste email
                  </p>
                </div>
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium text-foreground">Nome do Remetente (opcional)</label>
                  <Input
                    value={integrationData.emailSenderName}
                    onChange={(e) =>
                      setIntegrationData({
                        ...integrationData,
                        emailSenderName: e.target.value,
                      })
                    }
                    placeholder="Como você quer aparecer nos emails"
                    className="bg-input border-input text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se preencher, os emails saem como "Nome &lt;email&gt;". Vazio usa o padrão da conta.
                  </p>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="border-b border-border pb-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold text-foreground">WhatsApp para Lembretes</h3>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Seu Número WhatsApp</label>
                  <Input
                    value={integrationData.whatsappPhoneNumber}
                    onChange={(e) =>
                      setIntegrationData({
                        ...integrationData,
                        whatsappPhoneNumber: e.target.value,
                      })
                    }
                    placeholder="+55 11 99999-9999"
                    className="bg-input border-input text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você receberá lembretes de tarefas por WhatsApp
                  </p>
                </div>
              </div>

              {/* Toddle */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-foreground">Toddle/Nordcraft</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Tipo de Toddle</label>
                    <Select value={integrationData.toddleProvider} onValueChange={(value) =>
                      setIntegrationData({
                        ...integrationData,
                        toddleProvider: value,
                      })
                    }>
                      <SelectTrigger className="bg-input border-input text-foreground mt-1">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-input border-input">
                        <SelectItem value="Lex Brasil">Lex Brasil</SelectItem>
                        <SelectItem value="Toddle Direct">Toddle Direct</SelectItem>
                        <SelectItem value="Google">Google</SelectItem>
                        <SelectItem value="Microsoft">Microsoft</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Usuário do Toddle</label>
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
                      className="bg-input border-input text-foreground mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Senha do Toddle</label>
                    <div className="relative mt-1">
                      <Input
                        type={showToddlePw ? "text" : "password"}
                        value={integrationData.toddlePassword}
                        onChange={(e) =>
                          setIntegrationData({
                            ...integrationData,
                            toddlePassword: e.target.value,
                          })
                        }
                        placeholder="Sua senha"
                        className="bg-input border-input text-foreground pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowToddlePw((v) => !v)}
                        aria-label={showToddlePw ? "Esconder senha" : "Mostrar senha"}
                      >
                        {showToddlePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use seu nome de usuário ou email do Toddle. Suas credenciais são criptografadas e usadas apenas para sincronizar com Toddle.
                  </p>
                                </div>
              </div>
            </div>

            {/* Gmail Section */}
            <div className="bg-muted rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-foreground">Gmail (Seu Próprio)</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Email do Gmail</label>
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
                    className="bg-input border-input text-foreground mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Senha de App do Google</label>
                  <div className="relative mt-1">
                    <Input
                      type={showGmailPw ? "text" : "password"}
                      value={integrationData.gmailAppPassword}
                      onChange={(e) =>
                        setIntegrationData({
                          ...integrationData,
                          gmailAppPassword: e.target.value,
                        })
                      }
                      placeholder="Sua senha de app"
                      className="bg-input border-input text-foreground pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowGmailPw((v) => !v)}
                      aria-label={showGmailPw ? "Esconder senha" : "Mostrar senha"}
                    >
                      {showGmailPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
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
          <Card className="bg-card/50 border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Estilo Preferido da IA</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Descreva seu estilo de aprendizado
                </label>
                <Textarea
                  value={prefsData.aiStyle}
                  onChange={(e) => setPrefsData({ ...prefsData, aiStyle: e.target.value })}
                  placeholder="Ex: Prefiro explicações concisas com exemplos práticos. Gosto de analogias do mundo real."
                  rows={4}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
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

        {/* APARÊNCIA TAB */}
        <TabsContent value="aparencia" className="space-y-4">
          <Card className="bg-card/50 border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Tema</h2>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground break-words">
                O tema padrão é escuro (cyberpunk/neon). Escolha claro se preferir menos contraste.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => theme === "dark" && toggleTheme?.()}
                  className="w-full sm:w-auto min-h-12 gap-2"
                >
                  <Sun className="w-4 h-4" />
                  Claro
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => theme === "light" && toggleTheme?.()}
                  className="w-full sm:w-auto min-h-12 gap-2"
                >
                  <Moon className="w-4 h-4" />
                  Escuro
                </Button>
              </div>
              <p className="text-xs text-muted-foreground break-words">
                A preferência fica salva neste navegador — em outros dispositivos você pode escolher tema diferente.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
