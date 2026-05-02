import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'report.html');
const pdfPath  = path.join(__dirname, 'report.pdf');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: existsSync(chromePath) ? chromePath : undefined,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  displayHeaderFooter: false,
});

await browser.close();
console.log('PDF gerado em:', pdfPath);
