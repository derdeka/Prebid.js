/**
 * Check if GDPR purpose 1 consent was given.
 *
 * @param gdprConsent GDPR consent data
 * @returns {boolean} true if the gdprConsent is null-y; or GDPR does not apply; or if purpose 1 consent was given.
 */
export function hasPurpose1Consent(gdprConsent?: { gdprApplies?: boolean; vendorData?: any } | null): boolean {
  if (gdprConsent?.gdprApplies) {
    return gdprConsent?.vendorData?.purpose?.consents?.[1] === true;
  }
  return true;
}
