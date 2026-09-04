import { company } from "../lib/company";

export function ConnectWithUs() {
  return (
    <address className="not-italic text-ink">
      <p className="font-medium">{company.name}</p>
      <p className="mt-2 text-ink-muted">{company.street}</p>
      <p className="text-ink-muted">{company.cityLine}</p>
      <p className="mt-4">
        <a className="text-accent hover:text-accent-hover" href={`mailto:${company.email}`}>
          {company.email}
        </a>
      </p>
      <p className="mt-2 text-ink-muted">
        Phone{" "}
        <a className="text-ink hover:text-accent" href={`tel:${company.phoneTel}`}>
          {company.phoneDisplay}
        </a>
      </p>
      <p className="mt-1 text-ink-muted">Fax {company.faxDisplay}</p>
    </address>
  );
}
