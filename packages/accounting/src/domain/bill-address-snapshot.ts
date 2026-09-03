export type BillAddressSnapshot = {
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly region: string;
  readonly postal: string;
  readonly country: string;
};
