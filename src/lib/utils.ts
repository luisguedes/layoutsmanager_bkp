import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Funções de máscara para formatação de campos
export const maskCNPJ = (value: string): string => {
  const cleanValue = value.replace(/\D/g, "");
  return cleanValue
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
};

export const maskCEP = (value: string): string => {
  const cleanValue = value.replace(/\D/g, "");
  return cleanValue.replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
};

export const maskPhone = (value: string): string => {
  const cleanValue = value.replace(/\D/g, "");
  if (cleanValue.length <= 10) {
    return cleanValue
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 14);
  }
  return cleanValue
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
};

// Função para remover formatação
export const unmask = (value: string): string => {
  return value.replace(/\D/g, "");
};
