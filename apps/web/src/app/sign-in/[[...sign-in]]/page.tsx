import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignIn appearance={{ elements: { formButtonPrimary: "bg-blue-600 hover:bg-blue-700" } }} />
    </div>
  );
}
