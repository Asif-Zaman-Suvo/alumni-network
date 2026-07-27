import Link from "next/link";
import { GraduationCapIcon } from "lucide-react";
import { clientEnv } from "@/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-10 inline-flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCapIcon className="size-5" />
            </span>
            <span className="text-sm font-semibold leading-tight">
              {clientEnv.NEXT_PUBLIC_SCHOOL_NAME}
              <span className="block text-xs font-normal text-muted-foreground">
                Alumni Network
              </span>
            </span>
          </Link>
          {children}
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.22),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-end gap-6 p-12 text-primary-foreground">
          <blockquote className="max-w-md text-2xl font-medium leading-snug">
            Every profile here belongs to someone whose SSC roll and registration were
            checked by hand.
          </blockquote>
          <p className="max-w-md text-sm text-primary-foreground/80">
            That is slower than an open sign-up form, and it is the reason the directory is
            worth searching.
          </p>
        </div>
      </aside>
    </div>
  );
}
