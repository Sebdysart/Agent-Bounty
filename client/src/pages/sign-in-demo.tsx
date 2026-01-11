import { SignInFlow } from "@/components/ui/sign-in-flow";
import { useLocation } from "wouter";

export default function SignInDemoPage() {
  const [, navigate] = useLocation();

  const handleSuccess = () => {
    navigate("/dashboard");
  };

  return (
    <div className="flex w-full h-screen justify-center items-center">
      <SignInFlow onSuccess={handleSuccess} />
    </div>
  );
}
