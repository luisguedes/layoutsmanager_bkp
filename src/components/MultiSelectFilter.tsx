import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MultiSelectFilterProps {
  label: string;
  options: Array<{ id: string; nome: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = "Selecione...",
}: MultiSelectFilterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((option) =>
      option.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const selectedOptions = useMemo(() => {
    return options.filter((option) => selectedIds.includes(option.id));
  }, [options, selectedIds]);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (id: string) => {
    onChange(selectedIds.filter((selectedId) => selectedId !== id));
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectAll = () => {
    onChange(filteredOptions.map((option) => option.id));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-left font-normal"
          >
            <span className="truncate">
              {selectedIds.length === 0
                ? placeholder
                : `${selectedIds.length} selecionado${selectedIds.length !== 1 ? 's' : ''}`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b space-y-2">
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="flex-1"
              >
                Selecionar todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="flex-1"
              >
                Limpar
              </Button>
            </div>
          </div>
          <ScrollArea className="h-64">
            <div className="p-2 space-y-1">
              {filteredOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item encontrado
                </p>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                    onClick={() => toggleOption(option.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(option.id)}
                      onCheckedChange={() => toggleOption(option.id)}
                    />
                    <span className="text-sm flex-1">{option.nome}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <Badge key={option.id} variant="secondary" className="gap-1">
              {option.nome}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeOption(option.id)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
