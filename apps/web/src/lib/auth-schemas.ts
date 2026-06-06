import { z } from 'zod';

/**
 * Shared zod schemas for the authentication pages.
 *
 * Mirrors the rules enforced by the auth-service's class-validator
 * DTOs (services/auth-service/src/modules/auth/dto/*) so the frontend
 * validates exactly the same way the backend does. When backend rules
 * change, update these schemas at the same time.
 */

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .trim()
    .toLowerCase()
    .email('Informe um email válido')
    .max(254),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .max(128, 'A senha deve ter no máximo 128 caracteres'),
  /**
   * TOTP code — only required when the credentials endpoint returns
   * `requires2FA: true`. The client surfaces the field conditionally
   * so a user without 2FA never has to fill it in.
   *
   * `react-hook-form` keeps `defaultValues.code = ''`, so the schema
   * must accept the empty string. Validate the regex only when the
   * caller actually filled it in.
   */
  code: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\D/g, '').slice(0, 6) || undefined)
    .refine((value) => !value || /^\d{6}$/.test(value), {
      message: 'O código deve ter 6 dígitos',
    }),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
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
      .max(254),
    password: z
      .string({ required_error: 'Senha é obrigatória' })
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .max(128, 'A senha deve ter no máximo 128 caracteres')
      .regex(/(?=.*[a-z])/, 'A senha deve conter uma letra minúscula')
      .regex(/(?=.*[A-Z])/, 'A senha deve conter uma letra maiúscula')
      .regex(/(?=.*\d)/, 'A senha deve conter um número'),
    confirmPassword: z.string({ required_error: 'Confirmação de senha é obrigatória' }),
    /**
     * LGPD art. 7º, I — o titular deve manifestar consentimento
     * de forma livre, informada e inequívoca antes do tratamento.
     * A simples exibição de texto não é suficiente; exige-se
     * clique afirmativo (checkbox marcado).
     */
    termsAccepted: z.literal(true, {
      errorMap: () => ({
        message: 'Você deve aceitar os termos de uso e a política de privacidade',
      }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
