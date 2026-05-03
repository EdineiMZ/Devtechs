'use server';

import { auth } from '@/auth';
import { deleteEmployee } from '@/lib/rh-api';

export interface DismissResult {
  ok: boolean;
  message: string;
}

export async function actionDismissEmployee(
  employeeId: string,
): Promise<DismissResult> {
  const session = await auth();
  if (!session?.accessToken) {
    return { ok: false, message: 'Sessão expirada. Faça login novamente.' };
  }
  if (!session.user.permissions.includes('rh:employees:edit')) {
    return { ok: false, message: 'Sem permissão para demitir funcionários.' };
  }

  const res = await deleteEmployee(employeeId, session.accessToken);
  if (!res.ok) {
    const msg =
      (res.data as { message?: string })?.message ??
      `Erro ${res.status} ao demitir funcionário.`;
    return { ok: false, message: typeof msg === 'string' ? msg : String(msg) };
  }

  return { ok: true, message: 'Funcionário desligado com sucesso.' };
}
