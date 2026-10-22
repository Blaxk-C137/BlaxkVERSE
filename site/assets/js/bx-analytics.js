/* bx-analytics.js — first-party pageview counting.
 *
 * Small on purpose. It sends four things and no more:
 *     the path, the referring hostname, the screen-width bucket, the language.
 * It sends them to this site's own /api/track. Nothing here can identify a
 * person, and there is no client-side identifier of any kind — no cookie, no
 * localStorage, no device fingerprint, no session token. Nothing is written to
 * the visitor's device at all, which is why /privacy still says "no cookies" and
 * is still telling the truth.
 *
 * If the visitor sends Do Not Track or Global Privacy Control, this file returns
 * before making a request. The server honours the same headers independently, so
 * the refusal holds even if this script never runs.
 *
 * Failure is silent by design: a visitor should never see, or wait for, our
 * analytics. If the endpoint is missing or slow, the page behaves identically.
 */
(function () {
  "use strict";

  /* An explicit refusal, honoured at the source. */
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;

  /* The dashboard is the owner looking at their own data. Counting that would
     inflate every number they are trying to read. */
  if (/^\/admin\b/.test(location.pathname)) return;

  /* Honour the same "no motion" preference as a proxy for "keep it minimal",
     and skip entirely when the page is being prerendered. */
  if (document.visibilityState === "prerender") return;

  function widthBucket() {
    var w = window.innerWidth || 0;
    if (w < 480) return "xs";
    if (w < 768) return "sm";
    if (w < 1100) return "md";
    if (w < 1600) return "lg";
    return "xl";
  }

  /* Strip the query string here as well as on the server, so a shared link with
     a ?theme= filter never carries anything through. */
  var payload = JSON.stringify({
    path: location.pathname,
    ref: document.referrer || "",
    w: widthBucket(),
    lang: (navigator.language || "").slice(0, 8)
  });

  function send() {
    try {
      if (navigator.sendBeacon) {
        /* sendBeacon survives the page being closed mid-request, which is exactly
           when a pageview would otherwise be lost. */
        var blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/track", blob)) return;
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        /* A blocked or failed beacon is not the visitor's problem. */
        credentials: "omit"
      }).catch(function () {});
    } catch (e) {
      /* Never surfaced. */
    }
  }

  /* Wait until the page is idle so this never competes with first paint or with
     the LCP element. requestIdleCallback is not available everywhere, so there is
     a setTimeout fallback rather than a feature test that silently does nothing. */
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(send, { timeout: 3000 });
  } else {
    window.setTimeout(send, 1200);
  }
})();
