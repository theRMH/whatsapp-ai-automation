import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col gap-6 w-full max-w-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Admin sign in</h1>
          <p className="text-sm text-neutral-500">
            Access is restricted to authorized administrators.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
