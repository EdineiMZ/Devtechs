'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import {
  createApiKey,
  type ApiKey,
  type CreateApiKeyInput,
} from '@/lib/api-keys-api';

async function getToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) throw new Error('Sessão inválida');
  return session.accessToken;
}

export interface CreateApiKeyResult {
  ok: boolean;
  message: string;
  key?: string;
  apiKey?: ApiKey;
}

export async function actionCreateApiKey(
  input: CreateApiKeyInput,
): Promise<CreateApiKeyResult> {
  try {
    const token = await getToken();
    const res = await createApiKey(input, token);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] }).message;
      return {
        ok: false,
        message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao criar chave de API'),
      };
    }
    revalidatePath('/admin/integracoes');
    const data = res.data as { key: string; apiKey: ApiKey };
    return {
      ok: true,
      message: 'Chave de API criada com sucesso',
      key: data.key,
      apiKey: data.apiKey,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}
