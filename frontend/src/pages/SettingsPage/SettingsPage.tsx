import { MainTitle } from "../../components/texts/MainTitle";
import { ChangePasswordSettings } from "../../components/user/ChangePasswordsSettings";
import { DeleteAccountSettings } from "../../components/user/DeleteAccountSettings";
import { TwoFactorSettings } from "../../components/user/TwoFactorSettings";

export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <MainTitle title="Settings" />
      <ChangePasswordSettings />
      <TwoFactorSettings />
      <DeleteAccountSettings />
    </div>
  );
}
