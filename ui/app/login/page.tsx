import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Sign in
      </h1>
      <p className="mt-3 max-w-xl text-[#9aa89a]">
        Email login for now — replaceable with wallet auth later. Hire Sentry after you
        connect or create a wallet.
      </p>
      <LoginForm />
    </main>
  );
}
