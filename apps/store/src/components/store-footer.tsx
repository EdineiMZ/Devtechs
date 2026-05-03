export function StoreFooter() {
  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SZDevs. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Termos de Uso
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Privacidade
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Suporte
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
