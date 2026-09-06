
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Turnir from "./pages/Turnir";
import Subscriptions from "./pages/Subscriptions";
import OlimpiadPage from "./pages/OlimpiadPage";
import Result from "./pages/Result";
import Kubki from "./pages/Kubki";
import OrderStatus from "./pages/OrderStatus";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Cabinet from "./pages/Cabinet";
import Hall from "./pages/Hall";
import Game from "./pages/Game";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/turnir" element={<Turnir />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/olimpiad/:slug" element={<OlimpiadPage />} />
            <Route path="/result" element={<Result />} />
            <Route path="/kubki" element={<Kubki />} />
            <Route path="/order-status" element={<OrderStatus />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/cabinet" element={<Cabinet />} />
            <Route path="/hall/:tournamentId" element={<Hall />} />
            <Route path="/game/:gameId" element={<Game />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;