/**
 * App configuration. Pure TypeScript — no React, DOM, or Vite imports —
 * so it ports to React Native (or any other runtime) unchanged.
 */

import type { Facility } from './types';

/**
 * Destination for "Suggest a correction" emails.
 *
 * All About Tennis: set your support address here (e.g.
 * "corrections@allabouttennis.example") to enable the "Suggest a
 * correction" button on facility detail pages. Leave as `null` to hide
 * the button entirely.
 */
export const FEEDBACK_EMAIL: string | null = null;

/**
 * Build a fully URL-encoded `mailto:` link for reporting a data problem
 * with a facility. The body is a short template the sender can edit.
 */
export function buildCorrectionMailto(
  email: string,
  facility: Facility,
  regionLabel: string
): string {
  const subject = `Court correction: ${facility.name} (${facility.id})`;
  const body = [
    `Facility: ${facility.name}`,
    `ID: ${facility.id}`,
    `Region: ${regionLabel}`,
    '',
    'What needs correcting? (mark all that apply)',
    '[ ] Wrong location',
    '[ ] Wrong number of courts',
    '[ ] Lights',
    '[ ] Surface',
    '[ ] Permanently closed',
    '[ ] Other',
    '',
    'Details:',
    '',
  ].join('\n');
  // The address is a trusted config constant; leave it readable (some mail
  // clients mishandle a %-encoded "@"). Subject/body are fully encoded, so
  // newlines become %0A and facility names can't break the URL.
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
