import { z } from "zod";

// Authentication validation schemas
export const signInSchema = z.object({
  email: z.string().email("E-mail inválido").max(255, "E-mail muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const signUpSchema = z.object({
  email: z.string().email("E-mail inválido").max(255, "E-mail muito longo"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(72, "Senha muito longa")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Client validation schemas
export const cnpjSchema = z.string()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val.length === 14, "CNPJ deve ter 14 dígitos");

export const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(255, "Nome muito longo"),
  cnpj: cnpjSchema,
  razao_social: z.string().max(255, "Razão social muito longa").optional(),
  nome_fantasia: z.string().max(255, "Nome fantasia muito longo").optional(),
  endereco: z.string().max(500, "Endereço muito longo").optional(),
  cidade: z.string().max(100, "Cidade muito longa").optional(),
  uf: z.string().length(2, "UF deve ter 2 caracteres").toUpperCase().optional().or(z.literal("")),
  cep: z.string().max(9, "CEP inválido").optional(),
  telefone: z.string().max(20, "Telefone muito longo").optional(),
  email: z.string().email("E-mail inválido").max(255, "E-mail muito longo").optional().or(z.literal("")),
  situacao: z.string().max(100).optional(),
  atividade_principal: z.string().max(500).optional(),
  observacoes: z.string().max(2000, "Observações muito longas").optional(),
});

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ClienteFormData = z.infer<typeof clienteSchema>;
