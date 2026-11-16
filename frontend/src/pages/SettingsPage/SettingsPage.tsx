import { MainTitle } from "../../components/texts/MainTitle";
import { TwoFactorSettings } from "../../components/user/TwoFactorSettings";

export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <MainTitle title="Settings" />
      <TwoFactorSettings />
    </div>
  );
}
