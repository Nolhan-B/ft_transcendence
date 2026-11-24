import { MainTitle } from "../../components/texts/MainTitle";
import { CardSkinSettings } from "../../components/user/CardSkinSettings";
import { ChangePasswordSettings } from "../../components/user/ChangePasswordsSettings";
import { TableColorSettings } from "../../components/user/TableColorSettings";
import { DeleteAccountSettings } from "../../components/user/DeleteAccountSettings";
import { TwoFactorSettings } from "../../components/user/TwoFactorSettings";

export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <MainTitle title="Settings" />
      <TableColorSettings />
      <CardSkinSettings />
      <ChangePasswordSettings />
      <TwoFactorSettings />
      <DeleteAccountSettings />
    </div>
  );
}
