import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /**
   * Se true, exibe versão compacta adequada para envelopar uma página
   * dentro do DashboardLayout (sem min-h-screen, sem stack trace grande).
   * Antes o boundary era único no root e derrubava o app inteiro; agora
   * pode ser usado por rota.
   */
  compact?: boolean;
  /**
   * Callback opcional pra "voltar" (usado em rota — volta pra /painel
   * em vez de recarregar a página inteira).
   */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center w-full max-w-md text-center">
              <AlertTriangle
                size={40}
                className="text-destructive mb-4 flex-shrink-0"
              />
              <h2 className="text-lg font-semibold mb-2 break-words">
                Algo deu errado nesta página
              </h2>
              <p className="text-sm text-muted-foreground mb-4 break-words">
                {this.state.error?.message || "Erro inesperado. Tente novamente."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={this.reset}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg min-h-11",
                    "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                  )}
                >
                  <RotateCcw size={16} />
                  Tentar novamente
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg min-h-11",
                    "border border-border hover:bg-muted cursor-pointer"
                  )}
                >
                  Recarregar página
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4 break-words">Ocorreu um erro inesperado</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg min-h-11",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
