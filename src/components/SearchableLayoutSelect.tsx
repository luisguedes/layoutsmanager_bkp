import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Layout {
  id: string;
  nome: string;
  clientes: {
    nome: string;
  };
}

interface SearchableLayoutSelectProps {
  layouts: Layout[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function SearchableLayoutSelect({
  layouts,
  value,
  onValueChange,
  placeholder = "Selecione um layout",
}: SearchableLayoutSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedLayout = layouts.find((layout) => layout.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedLayout
            ? `${selectedLayout.clientes.nome} - ${selectedLayout.nome}`
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput placeholder="Buscar layout..." />
          </div>
          <CommandList>
            <CommandEmpty>Nenhum layout encontrado.</CommandEmpty>
            <CommandGroup>
              {layouts.map((layout) => (
                <CommandItem
                  key={layout.id}
                  value={`${layout.clientes.nome} ${layout.nome}`}
                  onSelect={() => {
                    onValueChange(layout.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === layout.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{layout.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {layout.clientes.nome}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
