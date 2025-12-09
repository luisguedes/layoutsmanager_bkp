import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Printer, Layout, Tag } from "lucide-react";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();

export default function Dashboard() {
  const { session } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      if (!session) return null;

      const response = await fetch(`${API_URL}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar estatísticas');
      }

      return response.json();
    },
    enabled: !!session,
  });

  const cards = [
    { title: "Clientes", value: stats?.clientes || 0, icon: Users, color: "text-primary" },
    { title: "Modelos", value: stats?.modelos || 0, icon: FileText, color: "text-secondary" },
    { title: "Tipos de Impressão", value: stats?.tipos || 0, icon: Printer, color: "text-accent" },
    { title: "Campos", value: stats?.campos || 0, icon: Tag, color: "text-chart-3" },
    { title: "Layouts", value: stats?.layouts || 0, icon: Layout, color: "text-chart-4" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Visão geral do sistema de gerenciamento de layouts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Layout Manager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Sistema completo para gerenciamento de layouts de impressão. Aqui você pode:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Cadastrar e gerenciar clientes, modelos, tipos de impressão e campos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Criar layouts personalizados combinando cliente + modelo + tipo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Clonar layouts entre clientes para reaproveitar configurações</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Comparar layouts lado a lado para identificar diferenças</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Buscar clientes que já utilizam campos específicos</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
