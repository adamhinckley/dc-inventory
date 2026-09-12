/** Thrown when the invite email cannot be sent; identity UoW rolls back the registration. */
export class InviteDeliveryError extends Error {
  override readonly name = "InviteDeliveryError";

  constructor() {
    super("staff invite email delivery failed");
  }
}
