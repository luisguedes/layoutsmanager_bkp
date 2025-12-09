import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/config";

const API_URL = getApiUrl();
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Historico() {
  const { session } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { hasPermission } = usePermissions();
  
  const canView = isAdmin || hasPermission('historico', 'view');
  
  const [filterTable, setFilterTable] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit_logs", filterTable, filterAction],
    queryFn: async () => {
      let url = `${API_URL}/historico?`;
      if (filterTable !== "all") url += `table=${filterTable}&`;
      if (filterAction !== "all") url += `action=${filterAction}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      
      if (!response.ok) throw new Error('Erro ao buscar histórico');
      return response.json();
    },
    enabled: canView && !!session,
  });

  const getUserDisplay = (log: any) => {
    if (!log.changed_by) return "Sistema";
    return log.user_profile_nome || log.changed_by.substring(0, 8) + "...";
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT":
        return "bg-green-500";
      case "UPDATE":
        return "bg-blue-500";
      case "DELETE":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case "INSERT":
        return "Criação";
      case "UPDATE":
        return "Atualização";
      case "DELETE":
        return "Exclusão";
      default:
        return action;
    }
  };

  const getTableDisplayName = (tableName: string) => {
    const names: Record<string, string> = {
      clientes: "Clientes",
      layouts: "Layouts",
      campos: "Campos",
      modelos: "Modelos",
      tipos_impressao: "Tipos de Impressão",
      layout_campos: "Campos do Layout",
    };
    return names[tableName] || tableName;
  };

  const formatChanges = (oldData: any, newData: any) => {
    if (!oldData && !newData) return null;

    if (!oldData) {
      return (
        <div className="space-y-2">
          <p className="font-semibold text-green-600">Registro criado com os seguintes dados:</p>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(newData, null, 2)}
          </pre>
        </div>
      );
    }

    if (!newData) {
      return (
        <div className="space-y-2">
          <p className="font-semibold text-red-600">Registro excluído:</p>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(oldData, null, 2)}
          </pre>
        </div>
      );
    }

    const changes: any[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    allKeys.forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes.push({
          field: key,
          old: oldData[key],
          new: newData[key],
        });
      }
    });

    if (changes.length === 0) {
      return <p className="text-muted-foreground">Nenhuma alteração detectada</p>;
    }

    return (
      <div className="space-y-2">
        <p className="font-semibold text-blue-600">Campos alterados:</p>
        {changes.map((change, idx) => (
          <Card key={idx}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{change.field}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Anterior:</p>
                  <p className="font-mono bg-muted p-1 rounded">
                    {change.old === null ? "null" : String(change.old)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Novo:</p>
                  <p className="font-mono bg-muted p-1 rounded">
                    {change.new === null ? "null" : String(change.new)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Histórico de Auditoria
          </h1>
          <p className="text-muted-foreground mt-2">
            Visualize todas as alterações realizadas no sistema
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Select value={filterTable} onValueChange={setFilterTable}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tabelas</SelectItem>
              <SelectItem value="clientes">Clientes</SelectItem>
              <SelectItem value="layouts">Layouts</SelectItem>
              <SelectItem value="campos">Campos</SelectItem>
              <SelectItem value="modelos">Modelos</SelectItem>
              <SelectItem value="tipos_impressao">Tipos de Impressão</SelectItem>
              <SelectItem value="layout_campos">Campos do Layout</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="INSERT">Criação</SelectItem>
              <SelectItem value="UPDATE">Atualização</SelectItem>
              <SelectItem value="DELETE">Exclusão</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Tabela</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum registro de auditoria encontrado
                </TableCell>
              </TableRow>
            ) : (
              auditLogs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(log.changed_at), "dd/MM/yyyy HH:mm:ss", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>{getTableDisplayName(log.table_name)}</TableCell>
                  <TableCell>
                    <Badge className={getActionColor(log.action)}>
                      {getActionText(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {getUserDisplay(log)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            Detalhes da {getActionText(log.action)} -{" "}
                            {getTableDisplayName(log.table_name)}
                          </DialogTitle>
                          <DialogDescription>
                            Visualize as mudanças realizadas no registro
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Data/Hora</p>
                              <p className="font-medium">
                                {format(
                                  new Date(log.changed_at),
                                  "dd/MM/yyyy 'às' HH:mm:ss",
                                  { locale: ptBR }
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Usuário</p>
                              <p className="font-medium font-mono">{getUserDisplay(log)}</p>
                            </div>
                          </div>
                          <div>
                            {formatChanges(log.old_data, log.new_data)}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
