/* =============================================================================
 *  BlaxkVERSE — contact form wiring (EmailJS)
 *
 *  Two templates are used:
 *    template_id             the notification you receive
 *    auto_reply_template_id  the acknowledgement the visitor receives
 *
 *  Paste your values from the EmailJS dashboard between the quotes:
    user_id: "uSM6o00Ye_UF2C3ST",
    service_id: "service_7focmrx",
    template_id: "template_k5djxhn",              // notification to you
    auto_reply_template_id: "template_ijcx1qz",   // acknowledgement to visitor
 *
 *  Leave auto_reply_template_id as the placeholder to send notifications only;
 *  the form skips the acknowledgement when it is not configured.
 *
 *  The public key is designed to live in browser code — that is how EmailJS
 *  works — but the abuse limits are NOT here, they are in your EmailJS
 *  dashboard. Set them the day you paste the key:
 *    - Account → Limits → monthly cap (the free tier is 200 emails/month, and
 *      each enquiry spends two when the acknowledgement is enabled)
 *    - Notification template → reCAPTCHA v3, and paste the site key into
 *      `recaptcha` below. The access token is single-use, so it is attached to
 *      the notification only; enabling reCAPTCHA on the auto-reply template as
 *      well may make the acknowledgement fail.
 *
 *  Template variables the form sends — both templates read the same payload:
 *    name, from_name        the visitor
 *    email, from_email      the visitor's address
 *    reply_to               same address — set the template's Reply To to it
 *    subject, title         what kind of work, from the select
 *    message                the enquiry, with any deadline appended
 *    time                   when it was submitted
 *    to_name, to_email      recipient block; set to_email to your inbox, or
 *                           leave it and the value below is used
 *
 *  Set the Auto-Reply template's To Email to {{email}} so it reaches the
 *  visitor, and its Reply-To to your own address.
 *
 *  endpoint: leave it alone and the browser posts straight to EmailJS.
 *  Point it at "/api/emailjs" only for local testing through the dev server's
 *  proxy (npm run dev) when you want to dodge CORS while iterating.
 *
 *  This file lives in site/ and survives `npm run build` — the build never
 *  deletes it, so paste your values here once and forget about it.
 * ========================================================================== */
window.BX_MAIL = {
    user_id: "uSM6o00Ye_UF2C3ST",
    service_id: "service_7focmrx",
    template_id: "template_k5djxhn",              // notification to you
    auto_reply_template_id: "template_ijcx1qz",   // acknowledgement to visitor
  to_name: "Blaxk",
  to_email: "",       // optional — only if the template uses {{to_email}}
  recaptcha: "",      // optional reCAPTCHA v3 site key, enabled on the template
  endpoint: "https://api.emailjs.com/api/v1.0/email/send"
};
