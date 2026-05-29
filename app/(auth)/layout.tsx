import Image from "next/image";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
        <aside className="hidden border-r bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="p-10">
            <div className="inline-flex rounded-md bg-white px-4 py-3">
              <Image
                src="/logo.png"
                alt="Soltegra"
                width={150}
                height={42}
                className="object-contain"
                priority
              />
            </div>
          </div>
          <div className="space-y-8 p-10">
            <div className="max-w-md space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Área privada
              </p>
              <h1 className="text-3xl font-bold leading-tight">
                Gestión clara de proyectos, documentos y comunicaciones.
              </h1>
              <p className="text-sm leading-6 text-white/75">
                Un acceso único para clientes y equipo interno de Soltegra.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-white/85">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <span>Acceso seguro con tu cuenta autorizada.</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                <span>Estado, archivos y mensajes en el mismo lugar.</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
