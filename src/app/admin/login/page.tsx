import { Card, CardBody } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold text-text-primary">Admin sign in</h1>
          <p className="text-sm text-text-secondary">Access is restricted to authorized administrators.</p>
        </div>
        <Card>
          <CardBody>
            <LoginForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
