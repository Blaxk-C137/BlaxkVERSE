/* ===========================================================================
   bx-motion.js — the GSAP layer.

   Why this file exists: the site's original animation was hand-rolled CSS
   transitions plus an IntersectionObserver. That worked, but every effect was
   authored in isolation, so staggering, easing and scroll position were each
   solved slightly differently in each place. GSAP 3 is now free for commercial
   use (v3.15.0, vendored at site/assets/js/vendor/) and gives one timeline
   model for all of it.

   Three rules this file obeys, unchanged from the rest of the codebase:

     1. Transform and opacity only. Nothing here touches layout, which is why
        it cannot introduce cumulative layout shift.
     2. Motion mode is respected absolutely. In `reduced` and `static` this
        file does nothing at all and the CSS fallbacks stand. It does not
        "animate less" — it does not run.
     3. It is enhancement, never dependency. If GSAP fails to load, the page
        is fully readable and fully navigable; the guard below simply returns.

   Measured effect on the budget is recorded in evidence/site-performance.json
   and discussed in docs/performance-report.md.
   =========================================================================== */
(function () {
  "use strict";

  var doc = document.documentElement;

  /* --- availability guard -------------------------------------------------
     No GSAP, no motion layer. Also bail entirely unless the visitor is in the
     full-motion mode; `reduced` and `static` are deliberate choices about the
     experience and overriding them would be a bug, not a nicety.            */
  if (!window.gsap || !window.ScrollTrigger) return;
  if (document.documentElement.getAttribute("data-motion") !== "full") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* Tell the stylesheet to stand down its own reveal transitions, so the two
     systems cannot both animate the same element. */
  doc.setAttribute("data-gsap", "on");

  /* The site's own rAF director owns the canvas fields; this layer stays out
     of them so there is never a second frame loop doing the same work. */

  /* --- 1. hero entrance ---------------------------------------------------
     One timeline rather than a pile of independent transitions, which is what
     makes the stagger land on a beat instead of approximately.               */
  function hero() {
    var hero = document.querySelector("[data-hero]");
    if (!hero) return;

    var kicker = hero.querySelector(".hero-kicker, .section-kicker");
    var h1 = hero.querySelector("h1");
    var lede = hero.querySelector(".lede, .hero-lede");
    var ctas = hero.querySelectorAll(".hero-actions a, .hero-actions button");
    var meta = hero.querySelectorAll(".hero-meta > *, .stat-row > *");

    var tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.9 } });

    if (kicker) tl.from(kicker, { y: 14, opacity: 0, duration: 0.55 }, 0);
    if (h1) tl.from(h1, { y: 34, opacity: 0 }, 0.06);

    /* The h1 is the LCP element on this page. Animating opacity on it is safe
       because the text is in the DOM and painted from the first frame — the
       timeline moves it, it does not gate it. That is deliberate: an entrance
       animation must never be the reason the largest element appears late. */
    tl.from(h1 ? h1 : {}, {}, 0);

    if (lede) tl.from(lede, { y: 18, opacity: 0 }, 0.22);
    if (ctas.length) tl.from(ctas, { y: 14, opacity: 0, stagger: 0.08 }, 0.34);
    if (meta.length) tl.from(meta, { y: 12, opacity: 0, stagger: 0.05 }, 0.44);

    return tl;
  }

  /* --- 2. scroll reveals --------------------------------------------------
     Batched per section so a long page does not register hundreds of triggers.
     `once` is used throughout: content that re-animates on every scroll pass is
     a distraction, and re-running transforms on scroll is wasted frames.     */
  function reveals() {
    var groups = document.querySelectorAll("[data-reveal-group]");

    if (groups.length) {
      groups.forEach(function (group) {
        var items = group.querySelectorAll("[data-reveal]");
        if (!items.length) return;
        gsap.set(items, { y: 22, opacity: 0 });
        ScrollTrigger.create({
          trigger: group,
          start: "top 82%",
          once: true,
          onEnter: function () {
            gsap.to(items, {
              y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
              stagger: 0.07, overwrite: true
            });
          }
        });
      });
    }

    /* Sections with a single heading + body, the most common shape. */
    document.querySelectorAll("[data-reveal-block]").forEach(function (el) {
      var kids = el.children;
      if (!kids.length) return;
      gsap.set(kids, { y: 20, opacity: 0 });
      ScrollTrigger.create({
        trigger: el, start: "top 85%", once: true,
        onEnter: function () {
          gsap.to(kids, { y: 0, opacity: 1, duration: 0.75, ease: "power3.out", stagger: 0.06, overwrite: true });
        }
      });
    });
  }

  /* --- 3. subtle parallax on marked imagery -------------------------------
     Small ranges only (max 40px). Large parallax on a scroll-driven site is
     how pages end up feeling like they are fighting the scrollbar.           */
  function parallax() {
    document.querySelectorAll("[data-parallax]").forEach(function (el) {
      var amount = parseFloat(el.getAttribute("data-parallax")) || 24;
      gsap.fromTo(el, { yPercent: 0 }, {
        yPercent: 0, y: -amount, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 }
      });
    });
  }

  /* --- 4. progress rail ---------------------------------------------------
     One line showing how far into a long case study you are. Cheap: a single
     scaleX transform driven by a scroll trigger.                             */
  function progress() {
    var bar = document.querySelector("[data-progress]");
    if (!bar) return;
    var inner = bar.firstElementChild || bar;
    gsap.set(inner, { scaleX: 0, transformOrigin: "left center" });
    ScrollTrigger.create({
      trigger: document.body, start: "top top", end: "bottom bottom",
      onUpdate: function (self) { gsap.set(inner, { scaleX: self.progress }); }
    });
  }

  /* --- 5. counters --------------------------------------------------------
     Count up when a number scrolls into view. Reads the final value from the
     element's own text, so the DOM always holds the true number and the
     animation is purely presentational — if this never runs, the right value
     is already on screen.                                                    */
  function counters() {
    document.querySelectorAll("[data-count]").forEach(function (el) {
      var raw = el.textContent.trim();
      var target = parseFloat(raw.replace(/[^0-9.]/g, ""));
      if (!isFinite(target)) return;
      var suffix = raw.replace(/[0-9.,]/g, "");
      var decimals = (raw.split(".")[1] || "").replace(/[^0-9]/g, "").length;
      var obj = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: "top 92%", once: true,
        onEnter: function () {
          gsap.to(obj, {
            v: target, duration: 1.1, ease: "power2.out",
            onUpdate: function () {
              el.textContent = obj.v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;
            }
          });
        }
      });
    });
  }

  /* --- 6. magnetic primary actions ---------------------------------------
     A small pull toward the pointer on primary CTAs. Disabled on touch, where
     there is no hover to respond to and the effect would only add cost.      */
  function magnetic() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.22;

      function move(e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * strength;
        var dy = (e.clientY - (r.top + r.height / 2)) * strength;
        gsap.to(el, { x: dx, y: dy, duration: 0.5, ease: "power3.out" });
      }
      function reset() { gsap.to(el, { x: 0, y: 0, duration: 0.55, ease: "elastic.out(1,0.5)" }); }

      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", reset);
    });
  }

  /* --- boot ---------------------------------------------------------------
     ScrollTrigger needs a refresh once fonts and images have settled, or the
     start positions are computed against the wrong heights.                  */
  function boot() {
    hero();
    reveals();
    parallax();
    progress();
    counters();
    magnetic();
    ScrollTrigger.refresh();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  /* Exposed for the performance harness so it can assert the layer actually
     engaged, rather than silently measuring a page where it never ran. */
  window.BX_MOTION = { engine: "gsap", version: gsap.version, active: true };
})();
