/** Six-field ship-to address snapshot (mirrors sales confirm freeze). */
export type ShipToAddressSnapshot = {
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
};
