/** Client-side input checks for resident details (the database validates again). */

/** 10–15 digits, optional leading +, spaces allowed. */
export const PHONE_RE = /^\+?[0-9 ]{10,15}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Last 4 characters of an ID document. */
export const ID_LAST4_RE = /^[0-9A-Za-z]{4}$/;
