export type AccountMenuIdentity = {
  displayName: string;
  email: string;
};

export function accountMenuIdentity(
  session:
    | { displayName: string; email: string }
    | { email: string }
    | undefined,
): AccountMenuIdentity {
  if (session === undefined) {
    return { displayName: "Signed in", email: "" };
  }
  const email = session.email;
  const displayName =
    "displayName" in session && session.displayName.trim().length > 0
      ? session.displayName
      : email;
  return { displayName, email };
}
