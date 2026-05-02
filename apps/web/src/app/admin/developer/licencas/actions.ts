'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import {
  bindClient,
  createProduct,
  createToken,
  revokeToken,
  updateProduct,
  type BindClientInput,
  type CreateProductInput,
  type CreateTokenInput,
  type UpdateProductInput,
} from '@/lib/license-api';
import { cancelInvoice, createInvoice, type CreateInvoiceInput } from '@/lib/finance-api';

async function getToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) throw new Error('Sessão inválida');
  return session.accessToken;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function actionCreateProduct(
  input: CreateProductInput,
): Promise<{ ok: boolean; message: string; id?: string }> {
  try {
    const token = await getToken();
    const res = await createProduct(input, token);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] }).message;
      return { ok: false, message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao criar produto') };
    }
    revalidatePath('/admin/developer/licencas');
    const data = res.data as { id: string };
    return { ok: true, message: 'Produto criado com sucesso', id: data.id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}

export async function actionUpdateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await getToken();
    const res = await updateProduct(id, input, token);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] }).message;
      return { ok: false, message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao atualizar produto') };
    }
    revalidatePath('/admin/developer/licencas');
    return { ok: true, message: 'Produto atualizado com sucesso' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}

// ---------------------------------------------------------------------------
// Client bindings
// ---------------------------------------------------------------------------

export async function actionBindClient(
  clientId: string,
  input: BindClientInput,
): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await getToken();
    const res = await bindClient(clientId, input, token);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] }).message;
      return { ok: false, message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao vincular cliente') };
    }
    revalidatePath('/admin/developer/licencas');
    return { ok: true, message: 'Cliente vinculado ao produto' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}

// ---------------------------------------------------------------------------
// Token generation (optionally with invoice)
// ---------------------------------------------------------------------------

export interface GenerateTokenPayload {
  token: CreateTokenInput;
  invoice?: CreateInvoiceInput;
}

export interface GenerateTokenResult {
  ok: boolean;
  message: string;
  key?: string;
  hash?: string;
  expiresAt?: string | null;
  maxUses?: number | null;
  invoiceId?: string;
  invoiceError?: string;
}

export async function actionGenerateToken(
  payload: GenerateTokenPayload,
): Promise<GenerateTokenResult> {
  try {
    const token = await getToken();

    // 1. Generate activation key
    const tokenRes = await createToken(payload.token, token);
    if (!tokenRes.ok) {
      const msg = (tokenRes.data as { message?: string | string[] }).message;
      return {
        ok: false,
        message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao gerar token'),
      };
    }
    const generated = tokenRes.data as { key: string; hash: string; expiresAt: string | null; maxUses: number | null };

    // 2. Optionally create invoice
    let invoiceId: string | undefined;
    let invoiceError: string | undefined;
    if (payload.invoice) {
      const invoiceRes = await createInvoice(payload.invoice, token);
      if (invoiceRes.ok) {
        const inv = invoiceRes.data as { id: string };
        invoiceId = inv.id;
      } else {
        const msg = (invoiceRes.data as { message?: string | string[] }).message;
        invoiceError = Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao criar fatura');
      }
    }

    revalidatePath('/admin/developer/licencas');
    return {
      ok: true,
      message: 'Token gerado com sucesso',
      key: generated.key,
      hash: generated.hash,
      expiresAt: generated.expiresAt,
      maxUses: generated.maxUses,
      invoiceId,
      invoiceError,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}

// ---------------------------------------------------------------------------
// Token revocation (optionally cancels invoice)
// ---------------------------------------------------------------------------

export interface RevokeTokenPayload {
  tokenId: string;
  reason?: string;
  invoiceId?: string;
  invoiceCancelReason?: string;
}

export interface RevokeTokenResult {
  ok: boolean;
  message: string;
  invoiceError?: string;
}

export async function actionRevokeToken(
  payload: RevokeTokenPayload,
): Promise<RevokeTokenResult> {
  try {
    const token = await getToken();

    // 1. Revoke the activation token
    const revokeRes = await revokeToken(payload.tokenId, { reason: payload.reason }, token);
    if (!revokeRes.ok) {
      const msg = (revokeRes.data as { message?: string | string[] }).message;
      return {
        ok: false,
        message: Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao revogar token'),
      };
    }

    // 2. Optionally cancel the linked invoice
    let invoiceError: string | undefined;
    if (payload.invoiceId) {
      const cancelRes = await cancelInvoice(
        payload.invoiceId,
        payload.invoiceCancelReason ?? `Licença cancelada: ${payload.reason ?? 'sem motivo informado'}`,
        token,
      );
      if (!cancelRes.ok) {
        const msg = (cancelRes.data as { message?: string | string[] }).message;
        invoiceError = Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao cancelar fatura');
      }
    }

    return {
      ok: true,
      message: 'Token revogado com sucesso',
      invoiceError,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro inesperado' };
  }
}
