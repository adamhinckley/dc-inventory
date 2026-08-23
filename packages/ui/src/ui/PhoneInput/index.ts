'use client'

/**
 * International phone input — a country/dial-code selector fused to a national
 * number field on one bordered surface, with the value round-tripping through
 * React Hook Form as an E.164 string. Formats as-you-type via
 * `libphonenumber-js`; flags are self-hosted vector art (`CountryFlag`).
 *
 * @when Collecting a phone number where international numbers are valid — the
 *   onboarding PII form, contact details. Inside a `<Form>`, use
 *   `Form.PhoneInput` (`kind: 'phone'`) for the RHF-bound variant.
 * @avoid A national-only field with a fixed, implicit country — use
 *   `TextInput type="tel"`.
 * @variants density (comfortable | compact)
 */
export { PhoneInput, type PhoneInputProps } from './PhoneInput'
