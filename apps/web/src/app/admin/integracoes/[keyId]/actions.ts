'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { updateApiKey, revokeApiKey, type UpdateApiKeyInput } from '@/lib/api-keys-api';

async function getToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) throw new Error('Sessão inválida');
  return session.accessToken;
}

export async function actionUpdateApiKey(
  id: string,
  input: UpdateApiKeyInput,
): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await getToken();
    const res = await updateApiKey(id, input, token);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] }).message;
      return {
        ok: false,
        message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao atualizar chave'),
      };
    }
    revalidatePath(`/admin/integracoes/${id}`);
    revalidatePath('/admin/integracoes');
    return { ok: true, message: 'Chave atualizada com sucesso' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}

export async function actionRevokeApiKey(
  id: string,
  reason: string | undefined,
): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await getToken();
    const res = await revokeApiKey(id, reason, token);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] }).message;
      return {
        ok: false,
        message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao revogar chave'),
      };
    }
    revalidatePath(`/admin/integracoes/${id}`);
    revalidatePath('/admin/integracoes');
    return { ok: true, message: 'Chave revogada com sucesso' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}
