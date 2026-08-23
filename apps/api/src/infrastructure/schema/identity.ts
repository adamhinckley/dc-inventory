/**
 * Identity tables live in `@dc-inventory/identity`. Re-export for any leftover
 * local imports; the Kit barrel should import the package `./schema` entry.
 */
export {
  actorType,
  identity,
  opsUserKind,
  opsUsers,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "@dc-inventory/identity/schema";
