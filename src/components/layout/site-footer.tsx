import { clientEnv } from "@/env";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} {clientEnv.NEXT_PUBLIC_SCHOOL_NAME} Alumni Network
        </p>
        <p>Alumni details are shared only with verified members.</p>
      </div>
    </footer>
  );
}
