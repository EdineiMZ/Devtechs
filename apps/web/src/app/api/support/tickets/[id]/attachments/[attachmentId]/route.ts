import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';

const SUPPORT_SERVICE_URL =
  process.env.SUPPORT_SERVICE_URL ??
  process.env.NEXT_PUBLIC_SUPPORT_URL ??
  process.env.NEXT_PUBLIC_SUPPORT_SERVICE_URL ??
  'http://127.0.0.1:4008';

/**
 * Proxy de download de anexos de chamados.
 * O support-service exige Authorization — o browser não pode enviar o
 * header em um <a href>, por isso passamos pela sessão server-side aqui.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const { id, attachmentId } = await params;

  const upstream = `${SUPPORT_SERVICE_URL}/tickets/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`;

  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'support-service indisponível' }, { status: 503 });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return NextResponse.json({ message: body || 'Erro ao obter arquivo' }, { status: res.status });
  }

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const disposition = res.headers.get('content-disposition') ?? '';

  const blob = await res.arrayBuffer();

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      ...(disposition ? { 'Content-Disposition': disposition } : {}),
      'Cache-Control': 'private, no-store',
    },
  });
}
