import { LoginForm } from "../../components/authentification/LoginForm";
import { RegisterForm } from "../../components/authentification/RegisterForm";
import { MainTitle } from "../../components/texts/MainTitle";

export function AuthPage() {
  return (
    <div className="flex-1 flex flex-col">
      <MainTitle title="Authentification"/>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
            <div className="flex w-full flex-col gap-5">
                <LoginForm />
                <div className="divider">OR</div>
                <RegisterForm />
            </div>
        </div>
      </div>
    </div>
  );
}
