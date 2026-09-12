import { OrganizationCreateForm } from "../../../../components/organization-create-form";
import { OrganizationsManageGate } from "../../../../components/organizations-manage-gate";

export default function CreateOrganizationPage() {
  return (
    <OrganizationsManageGate>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-form-section">
        <header>
          <p className="page-kicker">Platform</p>
          <h1 className="page-title">Add Company</h1>
          <p className="page-description mt-2">
            Provision a new wholesale company and invite its first admin. DEFAULT / platform admins
            only.
          </p>
        </header>
        <OrganizationCreateForm />
      </div>
    </OrganizationsManageGate>
  );
}
