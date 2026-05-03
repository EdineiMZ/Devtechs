# MEGA-PROMPT TEMPLATE — SZDevs One-Shot Cinematic Landing Page (Video Scroll-Scrub)

> Este é o prompt completo e definitivo para gerar a landing page da **SZDevs**. Preencha os `{{PLACEHOLDERS}}` restantes marcados como `[PERSONALIZAR]` e cole o documento inteiro em seu modelo gerador (Lovable, v0, Cursor, Claude) como UM ÚNICO PROMPT. Não divida. O modelo deve produzir um app Vite funcional em uma única geração.

---

## 0. BRIEF (leia primeiro, não pule)

Você está construindo um site de marketing premium, single-page, para uma **agência de desenvolvimento fullstack e arquitetura de software**, a **SZDevs**. A inspiração visual é: Vercel's homepage + Linear.app + Stripe's landing — mas com identidade própria, brutal e técnica. A interação principal é um **vídeo scrubado via canvas de frames** no hero. O restante da página é editorial, técnica, com estética de terminal-meets-luxury.

**Stack alvo — inegociável:**
- Vite + React 18 + TypeScript
- Tailwind CSS v4 (com diretiva `@theme`)
- shadcn/ui (button, accordion)
- Framer Motion (`motion/react`) para animações de texto e elementos
- lucide-react para ícones
- `@fontsource/*` para fontes self-hosted

**Idioma da UI do site:** `pt-BR`

**Intenção de design (releia antes de cada seção que construir):**
- Técnico, premium, editorial. Pense: documentação de luxo meets revista de design digital.
- Estética de **terminal escuro com toques dourados/cobre** — não cyberpunk genérico, mas refinado e intencional.
- Sem AI-slop genérico: sem emojis decorativos, sem gradientes violeta padrão, sem sombras stock, sem `text-center` em tudo, sem lorem placeholder esquecido.
- Mobile-first, mas otimizado para narrativa desktop (1440px é o canvas primário).
- Tema escuro por padrão. Superfícies claras são carvão/grafite, não cinza puro.

**O que é sucesso:** `npm run dev` inicia na primeira tentativa, todas as 9 seções renderizam, o frame-sequence do hero faz scrub suave com scroll, os marquees loopam, o FAQ accordion abre, sem erros no console, LCP < 2.5s em conexão de 10 Mbps.

---

## 1. TABELA DE PLACEHOLDERS

Todos os valores abaixo estão pré-definidos para a SZDevs. Entradas marcadas com `[PERSONALIZAR]` devem ser ajustadas antes de submeter.

| Placeholder | Valor Definido |
|---|---|
| `{{LANG}}` | `pt-BR` |
| `{{BRAND_NAME}}` | `SZDevs` |
| `{{BRAND_TAGLINE}}` | `Código que escala. Produto que converte.` |
| `{{LOGO_PATH}}` | `/logo.svg` |
| `{{NAV_ITEMS}}` | `[{"label":"Serviços","href":"#servicos"},{"label":"Processo","href":"#processo"},{"label":"Cases","href":"#cases"},{"label":"FAQ","href":"#faq"},{"label":"Contato","href":"#cta"}]` |
| `{{CTA_LABEL}}` | `Iniciar projeto` |
| `{{CTA_HREF}}` | `#cta` |
| `{{FRAMES_PATH}}` | `/frames` |
| `{{FRAME_COUNT}}` | `240` |
| `{{FRAME_EXT}}` | `webp` |
| `{{FPS}}` | `30` |
| `{{HERO_HEADLINE}}` | `Software que move negócios.` |
| `{{HERO_SUB}}` | `Da arquitetura ao deploy. A SZDevs constrói sistemas backend, APIs e produtos digitais que resistem à escala real.` |
| `{{HERO_CTA_PRIMARY}}` | `Iniciar projeto` |
| `{{HERO_CTA_SECONDARY}}` | `Ver como funciona` |
| `{{PARTNERS}}` | `["PostgreSQL","Node.js","Next.js","Docker","AWS","TypeScript"]` |
| `{{SERVICES}}` | Ver Seção 13 |
| `{{REASONS}}` | Ver Seção 14 |
| `{{PROCESS_STEPS}}` | Ver Seção 15 |
| `{{STATS}}` | Ver Seção 16 |
| `{{STATS_BG_VIDEO}}` | `[PERSONALIZAR — URL HLS/MP4 de vídeo ambiente técnico, ex: telas de código, servidores]` |
| `{{TESTIMONIALS}}` | Ver Seção 17 |
| `{{FAQ_ITEMS}}` | Ver Seção 18 |
| `{{CTA_BG_VIDEO}}` | `[PERSONALIZAR — URL HLS/MP4 de vídeo ambiente, ex: tela de terminal, compilação]` |
| `{{CTA_HEADLINE}}` | `Pronto para construir algo real?` |
| `{{CTA_SUB}}` | `Uma conversa. Um escopo. Um produto que funciona de verdade.` |
| `{{FOOTER_LINKS}}` | `[{"label":"Política de Privacidade","href":"/privacidade"},{"label":"Termos de Uso","href":"/termos"},{"label":"GitHub","href":"https://github.com/SZDevs"},{"label":"LinkedIn","href":"https://linkedin.com/company/SZDevs"}]` |
| `{{COPYRIGHT}}` | `© 2026 SZDevs. Todos os direitos reservados.` |
| `{{COLOR_INK}}` | `220 14% 8%` |
| `{{COLOR_CARBON}}` | `220 10% 13%` |
| `{{COLOR_COPPER}}` | `28 72% 58%` |
| `{{COLOR_EMBER}}` | `16 68% 40%` |
| `{{COLOR_ACID}}` | `160 100% 48%` |
| `{{FONT_DISPLAY}}` | `Space Grotesk` |
| `{{FONT_MONO}}` | `JetBrains Mono` |
| `{{FONT_BODY}}` | `DM Sans` |

> **Nota sobre a paleta:** `INK` é o fundo profundo (quase preto azulado). `CARBON` é o fundo de cards. `COPPER` é o dourado/cobre primário do CTA. `EMBER` é o cobre escuro para hover/acento. `ACID` é o verde-terminal para detalhes técnicos (badges, cursor blinks, inline highlights). Este sistema de cores evita completamente qualquer gradiente violeta padrão.

---

## 2. PRÉ-ETAPA — PIPELINE VÍDEO → FRAMES WEBP

O hero usa uma sequência de frames scrubada por scroll, não uma tag `<video>`. O usuário fornece UM vídeo curto (5-15s idealmente) que é extraído em frames estáticos que o canvas troca por posição de scroll. Este é o padrão que a Apple usa nas páginas de marketing do MacBook e AirPods Pro.

**Instruções que o modelo gerador DEVE incluir no README do projeto:**

```bash
# 1. Coloque o vídeo fonte em /input/source.mp4 na raiz do projeto.
mkdir -p input public/frames

# 2. Extraia os frames com ffmpeg (requer ffmpeg instalado localmente).
# Recomendação para SZDevs: use um vídeo de código sendo digitado,
# um terminal compilando, ou uma visualização abstrata de rede/dados.
ffmpeg -i input/source.mp4 \
  -vf "fps=30,scale='min(1920,iw)':'-2':flags=lanczos" \
  -q:v 3 \
  public/frames/frame_%04d.jpg

# 3. Converta para WebP (redução de ~40% no tamanho, mesma qualidade visual).
for f in public/frames/*.jpg; do
  cwebp -q 82 "$f" -o "${f%.jpg}.webp" && rm "$f"
done

# 4. Conte os frames e ajuste FRAME_COUNT em src/lib/constants.ts.
ls public/frames | wc -l
```

**Sugestões de vídeo para a SZDevs:**
- Terminal com código TypeScript/SQL sendo compilado em tempo real
- Visualização abstrata de requests/responses em uma API REST
- Tela de monitoramento com métricas (CPU, latência, throughput) em movimento
- Abstração 3D de nós de rede conectados (estilo dark + partículas)

**Regras para o modelo:**
- NÃO hardcode uma contagem específica de frames. Leia do constante `FRAME_COUNT` no topo de `src/lib/constants.ts`.
- Nomes de arquivo DEVEM ter zero-padding de 4 dígitos (`frame_0001.webp` … `frame_NNNN.webp`).
- `/input` fica no `.gitignore`. `/public/frames` vai para o build.
- Se o tamanho total dos frames exceder 20 MB, avise no README (limite Vercel hobby = 25 MB).

---

## 3. BOOTSTRAP DO PROJETO

Execute estes comandos em ordem. Cada comando é exato.

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss@next @tailwindcss/vite @tailwindcss/postcss autoprefixer
npm install motion lucide-react
npm install @fontsource/space-grotesk @fontsource/dm-sans @fontsource/jetbrains-mono

# shadcn/ui
npx shadcn@latest init -d
npx shadcn@latest add button accordion badge
```

**vite.config.ts:** importe o plugin `@tailwindcss/vite` e registre. Adicione alias `@` apontando para `src/`.

**tsconfig.json:** adicione `"paths": { "@/*": ["./src/*"] }` e `"baseUrl": "."`.

Estrutura de arquivos que o modelo DEVE criar:

```
src/
  App.tsx
  main.tsx
  index.css
  components/
    ScrubSequence.tsx      # canvas frame renderer
    Navbar.tsx
    Hero.tsx
    TechStack.tsx          # marquee de tecnologias (substitui Partners)
    ServicesBento.tsx      # grid editorial de serviços
    WhySZDevs.tsx        # 4 razões / diferenciais
    Process.tsx            # processo de trabalho passo a passo
    Stats.tsx              # métricas com vídeo de fundo
    Testimonials.tsx       # depoimentos de clientes
    Faq.tsx
    CtaFooter.tsx
    BlurText.tsx           # animação de headline palavra por palavra
    TerminalBadge.tsx      # componente reutilizável de badge estilo terminal
    ui/
      button.tsx
      accordion.tsx
      badge.tsx
  lib/
    utils.ts
    constants.ts           # FRAME_COUNT, FRAMES_PATH — fonte única da verdade
public/
  frames/                  # frame_0001.webp ... frame_NNNN.webp
  logo.svg
```

---

## 4. DESIGN TOKENS (index.css)

Adicione no topo de `src/index.css`, ACIMA do import do Tailwind:

```css
@import "@fontsource/space-grotesk/300.css";
@import "@fontsource/space-grotesk/400.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/600.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/dm-sans/300.css";
@import "@fontsource/dm-sans/400.css";
@import "@fontsource/dm-sans/500.css";
@import "@fontsource/dm-sans/600.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/500.css";

@import "tailwindcss";

:root {
  /* Paleta bruta (triplas HSL — sem wrapper hsl() para suportar alpha no Tailwind) */
  --ink:    220 14% 8%;
  --carbon: 220 10% 13%;
  --copper: 28 72% 58%;
  --ember:  16 68% 40%;
  --acid:   160 100% 48%;
  --ash:    220 8% 60%;

  /* Tokens semânticos */
  --background:           var(--ink);
  --foreground:           40 20% 94%;
  --card:                 var(--carbon);
  --card-foreground:      40 20% 94%;
  --popover:              var(--carbon);
  --popover-foreground:   40 20% 94%;
  --primary:              var(--copper);
  --primary-foreground:   220 14% 8%;
  --secondary:            var(--ember);
  --secondary-foreground: 40 20% 94%;
  --muted:                220 10% 18%;
  --muted-foreground:     var(--ash);
  --accent:               var(--acid);
  --accent-foreground:    220 14% 8%;
  --destructive:          0 72% 51%;
  --destructive-foreground: 40 20% 94%;
  --border:               220 14% 94% / 0.08;
  --input:                220 14% 94% / 0.08;
  --ring:                 var(--copper);
  --radius:               0.5rem;

  /* Roles tipográficos */
  --font-display: "Space Grotesk", "Helvetica Neue", system-ui, sans-serif;
  --font-body:    "DM Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;

  /* Layout */
  --gutter: clamp(20px, 4.2vw, 64px);
  --max:    1440px;
}

html, body, #root {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
html { scroll-behavior: smooth; }
body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

.font-display { font-family: var(--font-display); }
.font-body    { font-family: var(--font-body); }
.font-mono    { font-family: var(--font-mono); }

/* Cursor blink para elementos tipo terminal */
.cursor-blink::after {
  content: "█";
  color: hsl(var(--acid));
  animation: blink 1.1s step-end infinite;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
```

---

## 5. UTILITIES LIQUID-GLASS + TERMINAL

Adicione dentro de `index.css` sob `@layer components`. São o backbone visual de todos os cards e CTAs.

```css
@layer components {
  /* Glass padrão — cards de serviço, depoimentos */
  .liquid-glass {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border: none;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
  }
  .liquid-glass::before {
    content: '';
    position: absolute; inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(160deg,
      rgba(255,255,255,0.12) 0%,
      rgba(255,255,255,0.04) 30%,
      rgba(255,255,255,0) 60%,
      rgba(255,255,255,0.08) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  /* Glass forte — hero overlays, CTA cards */
  .liquid-glass-strong {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: none;
    box-shadow:
      4px 4px 8px rgba(0, 0, 0, 0.25),
      inset 0 1px 1px rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }
  .liquid-glass-strong::before {
    content: '';
    position: absolute; inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(160deg,
      rgba(255,255,255,0.18) 0%,
      rgba(255,255,255,0.06) 30%,
      rgba(255,255,255,0) 60%,
      rgba(255,255,255,0.10) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  /* Card estilo terminal — para blocos de código, badges técnicas */
  .terminal-card {
    background: hsl(220 14% 6%);
    border: 1px solid hsl(160 100% 48% / 0.15);
    box-shadow:
      0 0 0 1px hsl(160 100% 48% / 0.05),
      0 0 24px hsl(160 100% 48% / 0.04);
    font-family: var(--font-mono);
  }

  /* Highlight inline tipo código */
  .code-pill {
    background: hsl(160 100% 48% / 0.08);
    color: hsl(var(--acid));
    border: 1px solid hsl(160 100% 48% / 0.2);
    font-family: var(--font-mono);
    font-size: 0.78em;
    padding: 0.1em 0.5em;
    border-radius: 4px;
  }

  .gradient-fade-t {
    background: linear-gradient(to top, transparent 0%, hsl(var(--background)) 100%);
  }
  .gradient-fade-b {
    background: linear-gradient(to bottom, transparent 0%, hsl(var(--background)) 100%);
  }

  /* Ruído de textura sutil */
  .noise::after {
    content: "";
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    opacity: .4; mix-blend-mode: overlay; pointer-events: none;
  }

  /* Linha de scan estilo CRT — opcional no hero */
  .scanline::after {
    content: "";
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.03) 2px,
      rgba(0,0,0,0.03) 4px
    );
    pointer-events: none;
  }

  /* Borda com glow cobre */
  .copper-glow {
    box-shadow:
      0 0 0 1px hsl(28 72% 58% / 0.25),
      0 0 32px hsl(28 72% 58% / 0.08);
  }
}
```

---

## 6. TAILWIND v4 CONFIG (dentro de index.css)

Tailwind v4 usa a at-rule `@theme` DENTRO do CSS. Coloque este bloco após `@import "tailwindcss";`.

```css
@theme {
  --color-background:         hsl(var(--background));
  --color-foreground:         hsl(var(--foreground));
  --color-card:               hsl(var(--card));
  --color-card-foreground:    hsl(var(--card-foreground));
  --color-popover:            hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary:            hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary:          hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted:              hsl(var(--muted));
  --color-muted-foreground:   hsl(var(--muted-foreground));
  --color-accent:             hsl(var(--accent));
  --color-accent-foreground:  hsl(var(--accent-foreground));
  --color-destructive:        hsl(var(--destructive));
  --color-border:             hsl(var(--border));
  --color-input:              hsl(var(--input));
  --color-ring:               hsl(var(--ring));
  --color-copper:             hsl(var(--copper));
  --color-ember:              hsl(var(--ember));
  --color-acid:               hsl(var(--acid));
  --color-ash:                hsl(var(--ash));
  --color-carbon:             hsl(var(--carbon));

  --font-display: "Space Grotesk", sans-serif;
  --font-body:    "DM Sans", sans-serif;
  --font-mono:    "JetBrains Mono", monospace;

  --radius-sm:  calc(var(--radius) - 2px);
  --radius-md:  var(--radius);
  --radius-lg:  calc(var(--radius) + 4px);
  --radius-xl:  calc(var(--radius) + 10px);
  --radius-2xl: calc(var(--radius) + 18px);

  --animate-marquee:      marquee 32s linear infinite;
  --animate-marquee-rev:  marquee-rev 38s linear infinite;
  --animate-fade-up:      fade-up 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  --animate-glow-pulse:   glow-pulse 3s ease-in-out infinite;
}

@keyframes marquee     { from { transform: translateX(0) }    to { transform: translateX(-50%) } }
@keyframes marquee-rev { from { transform: translateX(-50%) } to { transform: translateX(0) } }
@keyframes fade-up {
  from { opacity: 0; transform: translate3d(0, 28px, 0); filter: blur(8px); }
  to   { opacity: 1; transform: translate3d(0,  0,   0); filter: blur(0); }
}
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 20px hsl(160 100% 48% / 0.15); }
  50%       { box-shadow: 0 0 40px hsl(160 100% 48% / 0.30); }
}
```

---

## 7. VARIANTES DE BOTÃO (shadcn)

Abra `src/components/ui/button.tsx` (gerado pelo `npx shadcn add button`). Adicione estas quatro variantes no bloco `buttonVariants` cva `variants.variant`:

```ts
// CTA principal — cobre sólido, arredondado
hero: "bg-primary text-primary-foreground rounded-md px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-primary/85 transition-all duration-200 copper-glow",

// CTA secundário — glass
heroGlass: "liquid-glass-strong text-foreground rounded-md px-6 py-3 text-sm font-normal tracking-wide hover:bg-white/5 transition-all duration-200",

// Outline técnico — borda verde-ácido
terminal: "border border-accent/30 text-accent rounded-md px-6 py-3 text-sm font-mono tracking-wider hover:bg-accent/5 hover:border-accent/60 transition-all duration-200",

// Ghost plano
ghost: "text-muted-foreground rounded-md px-4 py-2 text-sm hover:text-foreground hover:bg-white/5 transition-colors",
```

Uso: `<Button variant="hero">Iniciar projeto</Button>` / `<Button variant="terminal">Ver código</Button>`

---

## 8. SCRUB SEQUENCE COMPONENT — src/components/ScrubSequence.tsx

Este é o componente central. Reproduza verbatim. Renderiza o vídeo hero como sequência de frames indexada pelo scroll.

```tsx
import { useEffect, useRef } from "react";

export type ScrubSequenceProps = {
  framesPath: string;
  frameCount: number;
  ext?: "jpg" | "webp";
  className?: string;
  scrollTargetRef: React.RefObject<HTMLElement>;
};

const pad4 = (n: number) => String(n).padStart(4, "0");

export function ScrubSequence({
  framesPath,
  frameCount,
  ext = "webp",
  className,
  scrollTargetRef,
}: ScrubSequenceProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const imagesRef   = useRef<HTMLImageElement[]>([]);
  const rafRef      = useRef<number | null>(null);
  const visible     = useRef(true);
  const prefersReduced = useRef(
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    const urls = Array.from(
      { length: frameCount },
      (_, i) => `${framesPath}/frame_${pad4(i + 1)}.${ext}`
    );
    const first = new Image();
    first.src = urls[0];
    // @ts-ignore
    first.fetchPriority = "high";
    imgs[0] = first;
    urls.slice(1).forEach((src, i) => {
      const img = new Image(); img.src = src; imgs[i + 1] = img;
    });
    imagesRef.current = imgs;
  }, [framesPath, frameCount, ext]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = "100%";
      canvas.style.height = "100%";
      drawFrame(currentIndex());
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollTargetRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { visible.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollTargetRef]);

  useEffect(() => {
    const tick = () => {
      if (visible.current && !prefersReduced.current) drawFrame(currentIndex());
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prefersReduced.current) {
      const mid = Math.floor(frameCount / 2);
      const img = imagesRef.current[mid];
      if (img?.complete) drawImage(img);
      else img?.addEventListener("load", () => drawImage(img), { once: true });
    }
  }, [frameCount]);

  const currentIndex = () => {
    const el = scrollTargetRef.current;
    if (!el) return 0;
    const rect  = el.getBoundingClientRect();
    const total = el.offsetHeight - window.innerHeight;
    const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    return Math.min(frameCount - 1, Math.floor(progress * (frameCount - 1)));
  };

  const drawFrame = (idx: number) => {
    const img = imagesRef.current[idx];
    if (img && img.complete && img.naturalWidth > 0) drawImage(img);
  };

  const drawImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: cw, height: ch } = canvas;
    const { naturalWidth: iw, naturalHeight: ih } = img;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ transform: "translateZ(0)", willChange: "contents" }}
    />
  );
}
```

**Regras de estrutura do Hero para o modelo:**
- O Hero envolve seu conteúdo dentro de `<section ref={scrollTargetRef} className="relative h-[280vh]">`. Os 280vh dão distância de scroll suficiente para tocar toda a sequência.
- O canvas fica `position: fixed; inset: 0; z-index: 0;` dentro de um `<div className="sticky top-0 h-screen">`.
- Conteúdo acima do canvas (headline, CTAs, badge) tem `z-index: 10` e `position: sticky`.
- NUNCA use `<video>` no hero. NUNCA use `position: absolute` no canvas.
- Adicione um overlay gradiente `from-background/60 to-transparent` sobre o canvas para garantir legibilidade do texto.

---

## 9. BLURTEXT COMPONENT — src/components/BlurText.tsx

Animação de stagger por palavra para headlines. Toda seção usa este componente.

```tsx
import { motion, useInView } from "motion/react";
import { useRef } from "react";

type Props = {
  text: string;
  className?: string;
  delay?: number;
  startDelay?: number;
  as?: keyof JSX.IntrinsicElements;
};

export function BlurText({
  text,
  className = "",
  delay = 0.06,
  startDelay = 0,
  as: Tag = "h2",
}: Props) {
  const ref    = useRef<HTMLElement>(null);
  const inView = useInView(ref as any, { once: true, amount: 0.3 });
  const words  = text.split(" ");

  return (
    <Tag ref={ref as any} className={`inline ${className}`} aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
          transition={{
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
            delay: startDelay + i * delay,
          }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}
```

---

## 10. TERMINAL BADGE COMPONENT — src/components/TerminalBadge.tsx

Badge reutilizável que imita um indicador de terminal. Use em labels de seção, status de tech, e tags de stack.

```tsx
type Props = {
  children: React.ReactNode;
  variant?: "acid" | "copper" | "muted";
  dot?: boolean;
};

export function TerminalBadge({ children, variant = "acid", dot = true }: Props) {
  const styles = {
    acid:   "bg-acid/8 text-acid border-acid/20",
    copper: "bg-copper/8 text-copper border-copper/20",
    muted:  "bg-white/4 text-ash border-white/8",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded border ${styles[variant]}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === "acid" ? "bg-acid animate-pulse" :
          variant === "copper" ? "bg-copper" : "bg-ash"
        }`} />
      )}
      {children}
    </span>
  );
}
```

---

## 11. NAVBAR — src/components/Navbar.tsx

```
Comportamento:
- Fundo transparente no topo → liquid-glass-strong após 60px de scroll
- Logo à esquerda: logotipo SVG + texto "SZDevs" em font-display peso 600
- Itens de nav centralizados (hidden em mobile, visíveis em md+): Serviços | Processo | Cases | FAQ
- CTA à direita: <Button variant="hero" size="sm">Iniciar projeto</Button>
- Menu mobile: drawer lateral com os mesmos itens
- Transição de fundo: motion.nav com animate={{ backdropFilter, backgroundColor }} baseado em scrollY > 60

Estética:
- Altura: 64px
- Fonte dos itens: font-body, text-sm, text-muted-foreground, hover:text-foreground
- Logo: ícone de terminal ou chave (lucide: Terminal, Code2, Brackets) + "SZDevs" em letras
- Sem border-bottom — a separação vem do backdrop-blur ao fazer scroll
```

---

## 12. HERO — src/components/Hero.tsx

```
Estrutura (de baixo para cima em z-index):

1. Canvas (ScrubSequence) — z-0, fixed, ocupa 100vh
2. Overlay gradiente — z-1, radial from transparent center to background/70 nas bordas
3. Ruído/scanline — z-2, classe .noise.scanline
4. Conteúdo sticky — z-10, flex col, centralizado verticalmente

Conteúdo sticky (posição: canto inferior esquerdo, alinhado à gutter):
- TerminalBadge variant="acid": "// engenharia de produto"
- BlurText como <h1>: "Software que move negócios." — font-display, clamp(52px,7vw,96px), font-weight 600, leading-none, tracking-tight
- Parágrafo subtítulo: "Da arquitetura ao deploy. A SZDevs constrói sistemas backend, APIs e produtos digitais que resistem à escala real." — max-w-lg, text-muted-foreground
- Botões: <Button variant="hero">Iniciar projeto</Button> + <Button variant="heroGlass">Ver como funciona</Button>
- Indicador de scroll: seta animada descendo + texto "role para explorar" em font-mono text-xs text-ash

Indicador de progresso de scroll (direita da tela):
- Barra vertical fina (2px, height: 30vh) com fill cobre proporcional ao scroll dentro do hero
- Posição: fixed, right: gutter, top: 50%, translateY(-50%)

Nota de acessibilidade: o <h1> deve ter aria-label com o texto completo (não apenas as words animadas).
```

---

## 13. SERVICES BENTO — src/components/ServicesBento.tsx

```
Label de seção: TerminalBadge "// o que construímos"
Headline: BlurText "Serviços de engenharia"
Subtítulo: "Não somos uma agência de sites. Somos engenheiros que constroem o sistema que sustenta seu produto."

Layout do grid (bento — desktop):
- Coluna 1 (2/3): card grande com icon grande + title + body + lista de techs
- Coluna 2 (1/3): dois cards empilhados
- Segunda linha: três cards iguais

Os 6 serviços:
[
  {
    "icon": "ServerCog",
    "title": "Arquitetura de Backend",
    "body": "Design de APIs REST e GraphQL, modelagem de banco de dados PostgreSQL, microsserviços e monólitos modulares — construídos para durar.",
    "techs": ["Node.js", "PostgreSQL", "Docker", "Redis"]
  },
  {
    "icon": "Globe",
    "title": "Aplicações Next.js",
    "body": "Full-stack com Next.js App Router, SSR/ISR otimizado, integração com CMS headless e deploy na Vercel ou VPS próprio.",
    "techs": ["Next.js", "TypeScript", "Tailwind", "Prisma"]
  },
  {
    "icon": "ShieldCheck",
    "title": "Segurança & Pentest",
    "body": "Testes de invasão autorizados, análise de vulnerabilidades OWASP Top 10, relatórios executivos e remediação guiada.",
    "techs": ["Kali Linux", "Burp Suite", "OWASP", "CVE"]
  },
  {
    "icon": "Database",
    "title": "Modelagem & Performance de Dados",
    "body": "Otimização de queries, índices estratégicos, migrations seguras e auditoria de schema para PostgreSQL em produção.",
    "techs": ["PostgreSQL", "pgAnalyze", "explain analyze", "índices"]
  },
  {
    "icon": "Cloud",
    "title": "DevOps & Infraestrutura",
    "body": "CI/CD com GitHub Actions, containerização Docker, deploy em VPS e gerenciamento de ambientes com zero-downtime.",
    "techs": ["Docker", "Nginx", "GitHub Actions", "Ubuntu"]
  },
  {
    "icon": "LayoutDashboard",
    "title": "Produtos Digitais Completos",
    "body": "Do wireframe ao deploy: UX, frontend React, backend robusto e analytics integrado — entregue com documentação.",
    "techs": ["React", "Figma", "Node.js", "PostgreSQL"]
  }
]

Estética dos cards:
- classe liquid-glass, rounded-xl, padding p-6 a p-8
- ícone: 36px, cor copper
- título: font-display text-xl font-semibold
- body: text-muted-foreground text-sm leading-relaxed
- techs: lista horizontal de code-pill no rodapé do card
- card grande (Arquitetura): adicione um fragmento de código SQL ou Node.js estilizado no fundo do card (terminal-card, opacidade 0.4, decorativo)
```

---

## 14. WHY SZDevs — src/components/WhySZDevs.tsx

```
Label de seção: TerminalBadge variant="copper" "// por que a SZDevs"
Headline: BlurText "Engenharia sem verniz."
Subtítulo: "Sem jargão vazio. Sem estimativas fantasiosas. Apenas código bem escrito e entregue no prazo."

Layout: 2 colunas desktop, 1 mobile — 4 cards grandes com número de ordem estilizado

Os 4 diferenciais:
[
  {
    "n": "01",
    "icon": "Code2",
    "title": "Backend-first",
    "body": "Nossa especialidade é a fundação: banco de dados bem modelado, API coesa, lógica de negócio testável. O frontend é uma consequência natural disso."
  },
  {
    "n": "02",
    "icon": "GitBranch",
    "title": "Código auditável",
    "body": "Tudo com controle de versão, PR reviews, testes automatizados e documentação inline. Você recebe o repositório, não uma caixa preta."
  },
  {
    "n": "03",
    "icon": "Zap",
    "title": "Entrega iterativa",
    "body": "Ciclos curtos com demonstrações reais. Você vê progresso toda semana, não só na data de entrega final."
  },
  {
    "n": "04",
    "icon": "HeartHandshake",
    "title": "Comunicação direta",
    "body": "Um canal, uma pessoa de contato. Sem intermediários, sem reuniões desnecessárias, sem surpresas no escopo."
  }
]

Estética:
- Número de ordem: font-mono text-6xl text-white/4 absolute top-4 right-4 (decorativo, fundo)
- Ícone: 24px, cor acid
- Título: font-display text-lg font-semibold
- Cards: liquid-glass rounded-2xl com hover que levanta o card (translateY(-4px), copper-glow)
```

---

## 15. PROCESS — src/components/Process.tsx

```
Label de seção: TerminalBadge "// como trabalhamos"
Headline: BlurText "Do briefing ao deploy."
Subtítulo: "Um processo estruturado que elimina retrabalho e mantém você no controle."

Layout: linha do tempo horizontal (desktop) / vertical (mobile)
Linha conectora: stroke tracejada copper, animada com dashoffset no scroll

Os 4 passos:
[
  {
    "n": "01",
    "title": "Diagnóstico técnico",
    "body": "Revisamos seu stack atual, requisitos de negócio e restrições reais. Entregamos um documento de escopo com estimativa honesta — sem padrões inflados."
  },
  {
    "n": "02",
    "title": "Arquitetura & Prototipagem",
    "body": "Definimos o modelo de dados, endpoints da API e fluxo de autenticação antes de escrever uma linha de código de feature."
  },
  {
    "n": "03",
    "title": "Desenvolvimento iterativo",
    "body": "Sprints de 1-2 semanas com demos reais. Você testa em staging, aprova, e a feature vai para produção."
  },
  {
    "n": "04",
    "title": "Deploy & Handoff",
    "body": "Deploy com zero-downtime, documentação de API (OpenAPI/Swagger), README de operação e treinamento da sua equipe se necessário."
  }
]

Estética:
- Número: font-mono text-xs text-copper uppercase tracking-widest
- Título: font-display text-xl font-semibold
- Body: text-muted-foreground text-sm
- Conectores: SVG line com stroke-dasharray animado por IntersectionObserver
```

---

## 16. STATS — src/components/Stats.tsx

```
Vídeo de fundo: {{STATS_BG_VIDEO}} — autoplay, muted, loop, object-cover
Overlay: gradient radial de background/80 ao centro, mais escuro nas bordas

Os 4 stats:
[
  { "value": "40+",   "label": "projetos entregues" },
  { "value": "99.8%", "label": "uptime médio em produção" },
  { "value": "< 2s",  "label": "tempo médio de resposta de API" },
  { "value": "100%",  "label": "repositório entregue ao cliente" }
]

Estética:
- Valor: font-display text-6xl font-bold text-copper (counter animado com useEffect + requestAnimationFrame ao entrar em viewport)
- Label: font-mono text-xs text-ash uppercase tracking-widest
- Separadores: linha vertical 1px border/20 entre stats (hidden mobile)
- Fundo do vídeo com filter: grayscale(30%) brightness(0.4)
```

---

## 17. TESTIMONIALS — src/components/Testimonials.tsx

```
Label de seção: TerminalBadge "// o que dizem"
Headline: BlurText "Clientes que constroem com a gente."

Layout: dois marquees verticalmente sobrepostos (direções opostas)
- Linha 1: animação marquee normal
- Linha 2: animação marquee-rev

Máscaras: gradient-fade-t e gradient-fade-b nas extremidades horizontais

Os 6 depoimentos:
[
  {
    "quote": "A SZDevs foi a primeira agência que nos entregou uma API documentada de verdade. Conseguimos contratar um dev júnior e ele entendeu o sistema no primeiro dia.",
    "name": "Rafael Costa",
    "role": "CTO, Fintech Startup"
  },
  {
    "quote": "Esperava a entrega genérica de sempre. Recebi um relatório de pentest de 40 páginas com cada vulnerabilidade categorizada e priorizada. Impressionante.",
    "name": "Mariana Lopes",
    "role": "CEO, SaaS B2B"
  },
  {
    "quote": "O banco de dados estava um caos. Em duas semanas de consultoria, as queries caíram de 8s para 180ms. Sem mágica — só modelagem correta.",
    "name": "Diego Ferreira",
    "role": "Engenheiro Sênior, E-commerce"
  },
  {
    "quote": "O que me conquistou foi a honestidade no escopo. Quando pedimos algo inviável, explicaram o porquê e sugeriram uma alternativa melhor. Raro num fornecedor.",
    "name": "Camila Souza",
    "role": "Product Manager, Healthtech"
  },
  {
    "quote": "Migramos de NestJS para Next.js API Routes e o deploy passou a funcionar na primeira tentativa. Nunca tinha tido isso com outra agência.",
    "name": "Bruno Alves",
    "role": "Fundador, Plataforma EdTech"
  },
  {
    "quote": "Transparência total nos PRs, código limpo, comentários em português para o time. Exatamente o que precisávamos para crescer sem depender deles para sempre.",
    "name": "Juliana Martins",
    "role": "Diretora de TI, Construtora Digital"
  }
]

Estética dos cards:
- liquid-glass rounded-2xl p-6
- Quote: text-sm leading-relaxed text-foreground/90 — aspas decorativas copper antes do texto (::before com content: '"')
- Nome: font-display text-sm font-semibold
- Role: font-mono text-xs text-ash
```

---

## 18. FAQ — src/components/Faq.tsx

```
Label de seção: TerminalBadge "// perguntas frequentes"
Headline: BlurText "Direto ao ponto."

Usar shadcn Accordion (type="single" collapsible)

Os 7 FAQs:
[
  {
    "q": "Vocês aceitam projetos pequenos ou apenas grandes contratos?",
    "a": "Aceitamos desde consultoria pontual (otimização de queries, revisão de arquitetura) até desenvolvimento completo de produto. O critério não é tamanho — é clareza de escopo."
  },
  {
    "q": "Qual stack vocês dominam?",
    "a": "Nossa especialidade central é Node.js + PostgreSQL + Next.js para fullstack, com Docker e GitHub Actions para infraestrutura. Para frontend puro, trabalhamos com React/Next.js. Python para projetos de IA/dados sob consulta."
  },
  {
    "q": "Como funciona o contrato e pagamento?",
    "a": "Contrato por escopo fechado ou T&M (tempo e material) conforme o projeto. Pagamento em milestones — nunca pedimos 100% adiantado. Nota fiscal para PJ ou PF."
  },
  {
    "q": "Posso ver o código durante o desenvolvimento?",
    "a": "Sim. O repositório é seu desde o primeiro commit. Você tem acesso ao GitHub/GitLab durante todo o projeto, não só na entrega final."
  },
  {
    "q": "Fazem manutenção pós-entrega?",
    "a": "Oferecemos planos de suporte mensal que incluem monitoramento de erros, atualizações de dependências e banco de horas para features novas. Sem lock-in — você pode sair quando quiser."
  },
  {
    "q": "O pentest é um serviço separado?",
    "a": "Sim. Realizamos testes de invasão como serviço standalone (com contrato de autorização formal) ou como fase de segurança integrada ao desenvolvimento. Entregamos relatório executivo + técnico."
  },
  {
    "q": "Quanto tempo leva para iniciar um projeto?",
    "a": "Entre o primeiro contato e o início do desenvolvimento: geralmente 5-10 dias úteis (diagnóstico + escopo + contrato). Para consultorias pontuais, podemos começar em 48h."
  }
]

Estética:
- Accordion items: border-b border-border/30, sem border lateral
- Trigger: font-display text-base font-medium text-left
- Content: font-body text-sm text-muted-foreground leading-relaxed
- Ícone de expand: ChevronDown, rotação animada 180° quando aberto
- Nenhum bullet point dentro das respostas — texto corrido
```

---

## 19. CTA + FOOTER — src/components/CtaFooter.tsx

```
SEÇÃO CTA:
- Vídeo de fundo: {{CTA_BG_VIDEO}} (autoplay, muted, loop) com overlay background/75
- Conteúdo centralizado:
  - TerminalBadge variant="copper" "// próximo passo"
  - BlurText <h2>: "Pronto para construir algo real?"
  - Parágrafo: "Uma conversa. Um escopo. Um produto que funciona de verdade."
  - Dois botões: <Button variant="hero">Iniciar projeto</Button> e <Button variant="terminal">Ver nosso GitHub</Button>
  - Abaixo dos botões: linha em font-mono text-xs text-ash — "// resposta em até 24h úteis"

FOOTER:
- Fundo: hsl(var(--ink)) — mais escuro que o resto
- Layout 2 colunas:
  - Esquerda: Logo + tagline "Código que escala. Produto que converte." + copyright
  - Direita: links do footer em grade 2x2 (font-body text-sm text-muted-foreground hover:text-foreground)
- Separador: linha 1px border/10 acima do footer
- Rodapé: font-mono text-xs text-ash text-center — "built with precision in Brazil 🇧🇷"

Nota: o emoji da bandeira é a única exceção à regra de sem emojis — é contextual e intencional.
```

---

## 20. TECH STACK MARQUEE — src/components/TechStack.tsx

```
Substituindo a seção "Partners" genérica por um marquee técnico contextualizado.

Label acima: font-mono text-xs text-ash uppercase tracking-widest text-center — "stack que dominamos"

Duas linhas de marquee:
- Linha 1 (direção normal): Node.js · PostgreSQL · Next.js · TypeScript · Docker · Redis · Prisma · GitHub Actions · React · Tailwind CSS
- Linha 2 (direção reversa): REST APIs · GraphQL · Nginx · Ubuntu · Kali Linux · OpenAPI · Zod · JWT · Vitest · Playwright

Cada item do marquee:
- Pill com liquid-glass rounded-full px-4 py-1.5 text-sm font-mono text-muted-foreground
- Separador entre itens: · (ponto médio) na cor copper/40

Máscaras laterais: gradient horizontal de background para transparent (15% das bordas)
```

---

## 21. REGRAS FINAIS PARA O MODELO GERADOR

O modelo **NÃO pode:**
- Deixar qualquer `lorem ipsum` ou texto placeholder
- Usar gradientes violeta, azul royal ou rosa como cor primária
- Aplicar `text-center` globalmente — use alinhamento contextual (hero: esquerda baixo, seções: esquerda, CTA: centro)
- Esquecer os `aria-label` nas animações de texto
- Criar a estrutura Hero com `position: absolute` no canvas
- Usar `<video>` no hero

O modelo **DEVE:**
- Criar o arquivo `src/lib/constants.ts` com `FRAME_COUNT`, `FRAMES_PATH`, `FRAME_EXT` como exports nomeados
- Usar `clamp()` para todo tamanho de fonte de display (nunca unidades fixas no `<h1>`)
- Incluir `prefers-reduced-motion` no ScrubSequence (já implementado acima — não remova)
- Gerar o `README.md` com o pipeline de extração de frames documentado
- Adicionar `.gitignore` com `/input`, `/public/frames/*.webp`, `node_modules`, `dist`
- Garantir que `npm run dev` e `npm run build` rodem sem erros na primeira tentativa

---

*Este prompt foi construído especificamente para a **SZDevs** — agência de desenvolvimento fullstack & arquitetura de software. Todos os valores de placeholder já refletem a identidade, stack, serviços e tom de comunicação da marca.*
