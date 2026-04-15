import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

interface InvoiceForPdf {
  number: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  issuedAt: Date;
  dueDate: Date;
  notes: string | null;
  client: { name: string; email: string };
  creator: { name: string; email: string } | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

/**
 * Renders an invoice to a PDF buffer using Puppeteer (headless
 * Chromium). A single long-lived browser process is reused across
 * requests to avoid the ~1s per-request startup cost — Puppeteer
 * recommends this pattern for server-side rendering.
 *
 * The template is a minimal inline HTML document so the service
 * has zero external asset dependencies; fonts fall back to the
 * system stack bundled with Chromium.
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private browser: Browser | null = null;

  async render(invoice: InvoiceForPdf): Promise<Buffer> {
    const html = this.buildHtml(invoice);
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      return pdf;
    } finally {
      await page.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    this.logger.log('Launching Puppeteer for PDF rendering');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    return this.browser;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private buildHtml(invoice: InvoiceForPdf): string {
    const currency = (n: number): string =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(n);

    const rows = invoice.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.description)}</td>
            <td class="num">${item.quantity}</td>
            <td class="num">${currency(item.unitPrice)}</td>
            <td class="num">${currency(item.total)}</td>
          </tr>
        `,
      )
      .join('');

    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Nota Fiscal ${escapeHtml(invoice.number)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        color: #222;
        margin: 0;
      }
      header {
        border-bottom: 2px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
      }
      h1 { margin: 0; font-size: 22px; color: #0f172a; }
      .meta { text-align: right; font-size: 11px; color: #475569; }
      .section { margin-bottom: 20px; }
      .section h2 {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #64748b;
        margin: 0 0 6px 0;
      }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
      th { background: #f8fafc; font-size: 10px; text-transform: uppercase; color: #475569; }
      .num { text-align: right; }
      .totals { width: 260px; margin-left: auto; margin-top: 12px; }
      .totals td { border-bottom: none; }
      .totals .grand td { border-top: 2px solid #0f172a; font-weight: bold; font-size: 14px; }
      .notes { font-size: 11px; color: #475569; white-space: pre-wrap; }
      .status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; background: #e2e8f0; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>DevTechs</h1>
        <div>Nota Fiscal de Serviço</div>
      </div>
      <div class="meta">
        <div><strong>Número:</strong> ${escapeHtml(invoice.number)}</div>
        <div><strong>Emissão:</strong> ${invoice.issuedAt.toLocaleDateString('pt-BR')}</div>
        <div><strong>Vencimento:</strong> ${invoice.dueDate.toLocaleDateString('pt-BR')}</div>
        <div class="status">${escapeHtml(invoice.status)}</div>
      </div>
    </header>

    <div class="section">
      <h2>Cliente</h2>
      <div>${escapeHtml(invoice.client.name)}</div>
      <div>${escapeHtml(invoice.client.email)}</div>
    </div>

    <div class="section">
      <h2>Itens</h2>
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th class="num">Qtd.</th>
            <th class="num">Unitário</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <table class="totals">
      <tr><td>Subtotal</td><td class="num">${currency(invoice.subtotal)}</td></tr>
      <tr><td>Impostos</td><td class="num">${currency(invoice.tax)}</td></tr>
      <tr class="grand"><td>Total</td><td class="num">${currency(invoice.total)}</td></tr>
    </table>

    ${
      invoice.notes
        ? `<div class="section"><h2>Observações</h2><div class="notes">${escapeHtml(invoice.notes)}</div></div>`
        : ''
    }
  </body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
