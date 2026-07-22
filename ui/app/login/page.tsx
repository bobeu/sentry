import { LoginForm } from "@/components/LoginForm";
import Image from "next/image";

export default function LoginPage() {
  return (
    <main className="relative isolate min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-6 py-14 bg-bg-light">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(0,82,255,0.06),transparent_60%)]" />

      <div className="surface-card p-8 sm:p-10 w-full max-w-md space-y-7 shadow-lg border border-primary/10 relative">
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-primary" />

        <div className="text-center space-y-3 pt-2">
          <div className="flex justify-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl shadow-sm">
              <Image src="/logo.png" alt="Sentry" fill className="object-contain" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-text-dark tracking-tight">
              Sign in to Sentry
            </h1>
            <p className="mt-1.5 text-xs text-muted leading-relaxed font-medium">
              Connect your Celo wallet and enter your email. Email identifies your
              employment account; your wallet funds and withdraws from the prepaid
              Sentry wallet.
            </p>
          </div>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
