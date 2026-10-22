(function () {
  "use strict";
  var KEY = "bx_admin_token";
  var $ = function (s) { return document.querySelector(s); };
  var gate = $("#gate"), dash = $("#dash"), msg = $("#gate-msg"), dmsg = $("#dash-msg");

  function say(el, state, text) {
    el.dataset.state = state; el.textContent = text;
  }
  function token() { try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch (e) {} }

  function tile(label, value, sub) {
    return '<div class="card stat"><b>' + value + '</b><span>' + label + '</span>' +
           (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  }
  function rows(tbody, items) {
    if (!items || !items.length) { tbody.innerHTML = '<tr><td colspan="2" style="color:var(--muted)">No data yet today.</td></tr>'; return; }
    tbody.innerHTML = items.map(function (i) {
      var label = i.key === undefined ? i.label : i.key;
      var n = i.count === undefined ? i.value : i.count;
      return '<tr><td>' + String(label).replace(/[<>&]/g, "") + '</td><td class="num">' + n + '</td></tr>';
    }).join("");
  }

  function render(d) {
    $("#tiles").innerHTML =
      tile("Views today", d.today.views, d.today.date) +
      tile("Visitors today", d.today.uniques, "deduplicated, cookie-less") +
      tile("Views · 7 days", d.totals.views7d, "includes today") +
      tile("Views · 30 days", d.totals.views30d, "retention is 90 days");

    var series = d.series || [];
    var max = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.views; })));
    $("#chart").innerHTML = series.map(function (s) {
      var pct = Math.round((s.views / max) * 100);
      return '<div data-zero="' + (s.views ? 0 : 1) + '" style="height:' + Math.max(2, pct) + '%" ' +
             'title="' + s.date + ' — ' + s.views + ' views"></div>';
    }).join("");
    if (series.length) {
      $("#axis-start").textContent = series[0].date;
      $("#axis-mid").textContent = series[Math.floor(series.length / 2)].date;
      $("#axis-end").textContent = series[series.length - 1].date;
    }
    $("#range-note").textContent = "— peak " + max + "/day";

    rows($("#pages"), d.topPagesToday);
    rows($("#devices"), Object.keys(d.today.devices || {}).map(function (k) {
      return { label: k, value: d.today.devices[k] };
    }).sort(function (a, b) { return b.value - a.value; }));
    rows($("#geo"), (d.today.countries || []).map(function (c) {
      return { label: c.key === "XX" ? "unknown" : c.key, value: c.count };
    }));
  }

  function load(t) {
    if (!t) { gate.classList.remove("hide"); dash.classList.add("hide"); return; }
    msg.dataset.state = "info"; msg.textContent = "Checking…";
    fetch("/api/stats", { headers: { Authorization: "Bearer " + t } })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, body: d }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body.ok) {
          setToken(t);
          gate.classList.add("hide"); dash.classList.remove("hide");
          render(res.body);
          return;
        }
        /* A bad token and a missing store are different problems, so they get
           different messages rather than one generic failure. */
        if (res.status === 401) {
          setToken("");
          gate.classList.remove("hide"); dash.classList.add("hide");
          say(msg, "err", "That token was not accepted. Check ADMIN_TOKEN in the project's environment variables.");
          return;
        }
        gate.classList.remove("hide"); dash.classList.add("hide");
        say(msg, res.body && res.body.kind === "store_missing" ? "info" : "err",
            (res.body && res.body.error) || "Could not load the dashboard.");
      })
      .catch(function () {
        gate.classList.remove("hide"); dash.classList.add("hide");
        say(msg, "err", "Could not reach /api/stats. Is the dev server running?");
      });
  }

  $("#gate-form").addEventListener("submit", function (e) {
    e.preventDefault();
    load($("#tok").value.trim());
  });
  $("#forget").addEventListener("click", function () {
    setToken(""); $("#tok").value = ""; say(msg, "info", "Token cleared from this tab.");
  });
  $("#signout").addEventListener("click", function () {
    setToken(""); $("#tok").value = ""; dash.classList.add("hide"); gate.classList.remove("hide");
    say(msg, "info", "Signed out. The token is no longer in this tab.");
  });
  $("#refresh").addEventListener("click", function () { load(token()); });

  load(token());
})();
