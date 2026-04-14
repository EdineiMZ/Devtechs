import { z } from 'zod';

/**
 * Shared validation schema for the contact form. Imported by both the
 * client form (via `zodResolver`) and the `/api/contato` route handler,
 * so any rule change applies to both sides at once and the client
 * can't drift from the server contract.
 */

export const CONTACT_SUBJECTS = [
  'orcamento',
  'suporte',
  'parceria',
  'duvida',
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

/** Human-readable labels shown in the UI and in outgoing email subjects. */
export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  orcamento: 'Orçamento',
  suporte: 'Suporte',
  parceria: 'Parceria',
  duvida: 'Dúvida Geral',
};

/**
 * Brazilian phone format accepted by the schema.
 * `(XX) XXXX-XXXX` for 10-digit numbers, `(XX) XXXXX-XXXX` for 11-digit
 * (mobile). The client-side mask enforces this shape as the user types.
 */
const BR_PHONE_REGEX = /^\(\d{2}\) \d{4,5}-\d{4}$/;

export const contactSchema = z.object({
  nome: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),

  email: z
    .string({ required_error: 'Email é obrigatório' })
    .trim()
    .toLowerCase()
    .email('Informe um email válido')
    .max(254, 'Email deve ter no máximo 254 caracteres'),

  /**
   * Optional phone. We accept an empty string (the initial state of
   * any text input) as well as `undefined`, then only run the regex
   * check on non-empty values. Keeping the schema as a plain
   * `string().optional()` — rather than a `preprocess` that
   * normalizes to `undefined` — preserves the input type as plain
   * string so `zodResolver` forwards it to react-hook-form without
   * any `unknown` upcasts.
   */
  telefone: z
    .string()
    .optional()
    .refine(
      (value) => !value || BR_PHONE_REGEX.test(value),
      'Telefone inválido — use o formato (XX) XXXXX-XXXX',
    ),

  assunto: z.enum(CONTACT_SUBJECTS, {
    errorMap: () => ({ message: 'Selecione um assunto' }),
  }),

  mensagem: z
    .string({ required_error: 'Mensagem é obrigatória' })
    .trim()
    .min(20, 'Mensagem deve ter pelo menos 20 caracteres')
    .max(2000, 'Mensagem deve ter no máximo 2000 caracteres'),

  /**
   * The literal-true variant is the tightest expression of "must be
   * checked" in zod. Unchecked checkboxes submit as `false` which
   * fails the literal check with our custom message.
   */
  aceiteTermos: z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar os termos para continuar' }),
  }),
});

export type ContactFormData = z.infer<typeof contactSchema>;
