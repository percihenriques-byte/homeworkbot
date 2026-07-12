import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Chat from "./pages/Chat";
import StudyTools from "./pages/StudyTools";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import Memories from "./pages/Memories";
import { useAuth } from "./_core/hooks/useAuth";

// Create stable route components to prevent remounting on parent re-renders
const TasksRoute = () => (
  <DashboardLayout>
    <Tasks />
  </DashboardLayout>
);

const ChatRoute = () => (
  <DashboardLayout>
    <Chat />
  </DashboardLayout>
);

const StudyToolsRoute = () => (
  <DashboardLayout>
    <StudyTools />
  </DashboardLayout>
);

const ScheduleRoute = () => (
  <DashboardLayout>
    <Schedule />
  </DashboardLayout>
);

const MemoriesRoute = () => (
  <DashboardLayout>
    <Memories />
  </DashboardLayout>
);

const SettingsRoute = () => (
  <DashboardLayout>
    <Settings />
  </DashboardLayout>
);

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
      {isAuthenticated && (
        <>
          <Route path="/tarefas" component={TasksRoute} />
          <Route path="/chat" component={ChatRoute} />
          <Route path="/ferramentas" component={StudyToolsRoute} />
          <Route path="/cronograma" component={ScheduleRoute} />
          <Route path="/memorias" component={MemoriesRoute} />
          <Route path="/configuracoes" component={SettingsRoute} />
        </>
      )}
      <Route path="/404" component={NotFound} />
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
