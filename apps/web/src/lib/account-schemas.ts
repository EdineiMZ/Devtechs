/**
 * Zod schemas backing the /perfil/configuracoes forms. Keeping them
 * out of the components makes them easy to unit-test in isolation
 * and also reusable from the API routes if we ever decide to mirror
 * the validation server-side.
 */

import { z } from 'zod';

/**
 * Mirrors the backend `RegisterDto.password` rules so the user can't
 * set a "weaker" password than the original.
 */
export const passwordRules = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres')
  .regex(/[a-z]/, 'A senha deve conter ao menos uma letra minúscula')
  .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiúscula')
  .regex(/\d/, 'A senha deve conter ao menos um dígito');

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
  // Preprocess "" → undefined so the optional URL stays optional in
  // the DTO without "" failing the URL check.
  avatarUrl: z.preprocess(
    (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
    z
      .string()
      .url('Informe uma URL http(s) válida')
      // Zod's `url()` accepts any RFC-3986 URI including `javascript:`,
      // `data:`, `file:`, etc. — narrow to http/https to match the
      // backend's `@IsUrl({ protocols: ['http', 'https'], require_protocol: true })`.
      .regex(/^https?:\/\//i, 'A URL deve começar com http:// ou https://')
      .max(500, 'A URL deve ter no máximo 500 caracteres')
      .optional(),
  ),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Informe sua senha atual'),
    newPassword: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'A confirmação não corresponde à nova senha',
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  });

export type PasswordFormValues = z.infer<typeof passwordSchema>;

export const enable2FASchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Informe o código de 6 dígitos'),
});

export type Enable2FAFormValues = z.infer<typeof enable2FASchema>;

export const disable2FASchema = z.object({
  currentPassword: z.string().min(1, 'Informe sua senha atual'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Informe o código de 6 dígitos'),
});

export type Disable2FAFormValues = z.infer<typeof disable2FASchema>;
