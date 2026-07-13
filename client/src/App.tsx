import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Chat from "./pages/Chat";
import StudyTools from "./pages/StudyTools";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import Memories from "./pages/Memories";
import { useAuth } from "./_core/hooks/useAuth";

// Rotas estaveis (evita remounting em cada re-render do Router).
// Cada uma envelopada em ErrorBoundary compact — se uma pagina quebrar,
// mostra fallback em vez de derrubar o app inteiro.
const wrap = (Page: React.ComponentType) => () => (
  <DashboardLayout>
    <ErrorBoundary compact>
      <Page />
    </ErrorBoundary>
  </DashboardLayout>
);

const DashboardRoute = wrap(Dashboard);
const TasksRoute = wrap(Tasks);
const ChatRoute = wrap(Chat);
const StudyToolsRoute = wrap(StudyTools);
const ScheduleRoute = wrap(Schedule);
const MemoriesRoute = wrap(Memories);
const SettingsRoute = wrap(Settings);

const PROTECTED_ROUTES: Array<{ path: string; component: React.ComponentType }> = [
  { path: "/painel", component: DashboardRoute },
  { path: "/tarefas", component: TasksRoute },
  { path: "/chat", component: ChatRoute },
  { path: "/ferramentas", component: StudyToolsRoute },
  { path: "/cronograma", component: ScheduleRoute },
  { path: "/memorias", component: MemoriesRoute },
  { path: "/configuracoes", component: SettingsRoute },
];

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      {PROTECTED_ROUTES.map(({ path, component: Component }) => (
        <Route key={path} path={path}>
          {isAuthenticated ? <Component /> : <Redirect to="/" />}
        </Route>
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
