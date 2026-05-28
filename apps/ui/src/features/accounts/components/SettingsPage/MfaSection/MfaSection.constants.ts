/**
 * UI-only constants. The challenge / step / code lengths live on the
 * API side and aren't exposed in the OpenAPI schema; we mirror only
 * the validation-shaped values the form needs.
 */
export const MFA_TOTP_CODE_LENGTH = 6;

/**
 * Width of the QR canvas in CSS pixels. Phones scan reliably from
 * ~160px; we render larger so it's also legible across a meeting room.
 */
export const MFA_QR_SIZE_PX = 224;
