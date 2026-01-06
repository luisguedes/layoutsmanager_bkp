import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/Layout";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { SetupGuard } from "./components/SetupGuard";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Modelos from "./pages/Modelos";
import Tipos from "./pages/Tipos";
import Campos from "./pages/Campos";
import Layouts from "./pages/Layouts";
import Historico from "./pages/Historico";
import Configuracoes from "./pages/Configuracoes";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SetupGuard>
            <AuthProvider>
              <Routes>
                <Route path="/setup" element={<Setup />} />
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/clientes" element={<Clientes />} />
                          <Route path="/modelos" element={<Modelos />} />
                          <Route path="/tipos" element={<Tipos />} />
                          <Route path="/campos" element={<Campos />} />
                          <Route path="/layouts" element={<Layouts />} />
                          <Route path="/historico" element={<Historico />} />
                          <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
                          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </SetupGuard>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
