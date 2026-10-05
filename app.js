(function () {
  "use strict";

  var STORE_KEY = "jurnalgenerator:v2";
  var DAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  var DAY_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  /* ---------- state ---------- */

  function defaults() {
    var s = {
      startDate: "2026-07-31",
      endDate: "2026-09-20",
      tab: "harian",
      mode: "both",
      salatOn: {},
      dailyOn: {},
      weeklyOn: {},
      weeklyWitness: {},
      weeklyFriendName: {},
      weeklyDay: {},
    };
    SALAT_GROUPS.forEach(function (g) { s.salatOn[g.key] = g.defaultOn; });
    DAILY_HABITS.forEach(function (h) { s.dailyOn[h.key] = h.defaultOn; });
    WEEKLY_HABITS.forEach(function (h) {
      s.weeklyOn[h.habitId] = h.defaultOn;
      s.weeklyWitness[h.habitId] = h.witnessType || "FRIEND";
      s.weeklyFriendName[h.habitId] = ""; // nama teman default kosong
      s.weeklyDay[h.habitId] = h.dayOffset;
    });
    return s;
  }

  function load() {
    var base = defaults();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return base;
      var saved = JSON.parse(raw);
      ["startDate", "endDate", "tab", "mode"].forEach(function (k) {
        if (typeof saved[k] === "string") base[k] = saved[k];
      });
      ["salatOn", "dailyOn", "weeklyOn", "weeklyWitness", "weeklyFriendName", "weeklyDay"].forEach(function (k) {
        if (saved[k] && typeof saved[k] === "object") {
          Object.keys(base[k]).forEach(function (id) {
            if (saved[k][id] !== undefined) base[k][id] = saved[k][id];
          });
        }
      });
    } catch (e) { /* abaikan, pakai default */ }
    return base;
  }

  var state = load();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ }
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function scriptInput() {
    return {
      startDate: state.startDate,
      endDate: state.endDate,
      salatOn: state.salatOn,
      dailyOn: state.dailyOn,
      weeklyOn: state.weeklyOn,
      weeklyWitness: state.weeklyWitness,
      weeklyFriendName: state.weeklyFriendName,
      weeklyDay: state.weeklyDay,
      mode: state.mode,
    };
  }

  function dateValid() {
    return !!state.startDate && !!state.endDate && state.startDate <= state.endDate;
  }

  /* ---------- potongan tampilan ---------- */

  function sw(kind, id, on, label) {
    return (
      '<button type="button" class="sw" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '"' +
      ' data-kind="' + kind + '" data-id="' + esc(id) + '"><span class="knob">' + CHECK + "</span></button>"
    );
  }

  function meta(on, point, label, extraOff) {
    if (on) return '<span class="pt">+' + point + "</span><span>" + esc(label) + "</span>";
    return '<span class="pt zero">0</span><span class="off-note">Tidak melaksanakan' + (extraOff ? " · " + esc(extraOff) : "") + "</span>";
  }

  function row(kind, id, name, on, point, label, extraOff) {
    return (
      '<div class="row"><div><p class="name">' + esc(name) + '</p><p class="meta">' + meta(on, point, label, extraOff) + "</p></div>" +
      sw(kind, id, on, name) + "</div>"
    );
  }

  function section(title, key, onCount, total, inner) {
    var pct = total ? Math.round((onCount / total) * 100) : 0;
    return (
      '<section class="card" data-section="' + key + '">' +
      '<div class="sec-head"><h2>' + esc(title) + '</h2>' +
      '<span class="sec-count">' + onCount + " dari " + total + " ya</span>" +
      '<div class="sec-actions">' +
      '<button type="button" class="mini yes" data-act="all-on">Semua ya</button>' +
      '<button type="button" class="mini no" data-act="all-off">Semua tidak</button></div>' +
      '<div class="bar" aria-hidden="true"><i style="--p:' + pct + '%"></i></div></div>' +
      '<div class="list">' + inner + "</div></section>"
    );
  }

  function countOn(map, ids) {
    return ids.filter(function (id) { return !!map[id]; }).length;
  }

  function skipped(which) {
    return (which === "harian" && state.mode === "weekly") || (which === "mingguan" && state.mode === "daily");
  }

  function skipBanner(which) {
    if (!skipped(which)) return "";
    var other = which === "harian" ? "Mingguan" : "Harian";
    return '<p class="skip"><b>Bagian ini tidak ikut script.</b> Mode sekarang hanya ' + other + ". Ganti ke Keduanya di atas untuk menyertakannya.</p>";
  }

  function renderHarian() {
    var salatRows = SALAT_GROUPS.map(function (g) {
      var point = g.items.reduce(function (sum, i) { return sum + i.onPoint; }, 0);
      var label = g.items.map(function (i) { return i.label; }).join(" + ");
      return row("salat", g.key, g.name, !!state.salatOn[g.key], point, label);
    }).join("");
    var dailyRows = DAILY_HABITS.map(function (h) {
      return row("daily", h.key, h.name, !!state.dailyOn[h.key], h.onPoint, h.onCategory);
    }).join("");
    return (
      skipBanner("harian") +
      '<div class="stack' + (skipped("harian") ? " dim" : "") + '">' +
      section("Keagamaan", "salat", countOn(state.salatOn, SALAT_GROUPS.map(function (g) { return g.key; })), SALAT_GROUPS.length, salatRows) +
      section("Kesehatan, lingkungan, kewargaan", "daily", countOn(state.dailyOn, DAILY_HABITS.map(function (h) { return h.key; })), DAILY_HABITS.length, dailyRows) +
      "</div>"
    );
  }

  function dayOf(h) {
    var d = Number(state.weeklyDay[h.habitId]);
    return d >= 0 && d <= 6 ? d : h.dayOffset;
  }

  function renderMingguan() {
    var ids = WEEKLY_HABITS.map(function (h) { return h.habitId; });
    var rows = WEEKLY_HABITS.map(function (h) {
      var on = !!state.weeklyOn[h.habitId];
      var main = row("weekly", h.habitId, h.name, on, h.onPoint, h.onCategory, "dicatat hari " + DAY_LABELS[h.dayOffset]);
      var more = "";
      if (on) {
        var day = dayOf(h);
        var witness = state.weeklyWitness[h.habitId] || "FRIEND";
        var dayBtns = DAY_SHORT.map(function (d, i) {
          return '<button type="button" class="day" data-act="day" data-v="' + i + '" aria-pressed="' + (day === i) + '" title="' + DAY_LABELS[i] + '">' + d + "</button>";
        }).join("");
        more =
          '<div class="more" data-id="' + esc(h.habitId) + '">' +
          '<div class="field-row"><span class="cap">Hari</span><div class="days" role="group" aria-label="Pilih hari">' + dayBtns + "</div></div>" +
          '<div class="field-row"><span class="cap">Saksi</span><div class="who"><div class="seg" role="group" aria-label="Saksi">' +
          '<button type="button" data-act="witness" data-v="FRIEND" aria-pressed="' + (witness === "FRIEND") + '">Teman</button>' +
          '<button type="button" data-act="witness" data-v="PARENT" aria-pressed="' + (witness === "PARENT") + '">Orang tua</button></div>' +
          (witness === "FRIEND" ? '<input class="friend" data-id="' + esc(h.habitId) + '" placeholder="Nama teman" aria-label="Nama teman">' : "") +
          "</div></div></div>";
      }
      return "<div>" + main + more + "</div>";
    }).join("");
    return skipBanner("mingguan") + '<div class="stack' + (skipped("mingguan") ? " dim" : "") + '">' + section("Pembiasaan mingguan", "weekly", countOn(state.weeklyOn, ids), ids.length, rows) + "</div>";
  }

  function missingFriendNames() {
    if (state.mode === "daily") return 0;
    return WEEKLY_HABITS.filter(function (h) {
      return state.weeklyOn[h.habitId] &&
        (state.weeklyWitness[h.habitId] || "FRIEND") === "FRIEND" &&
        !String(state.weeklyFriendName[h.habitId] || "").trim();
    }).length;
  }

  function renderScript() {
    var ok = dateValid();
    if (!ok) {
      return '<div class="stack"><p class="notice">Perbaiki tanggal Mulai dan Akhir dulu supaya script bisa dibuat.</p></div>';
    }
    var sum = summarizeScript(scriptInput());
    var miss = missingFriendNames();
    return (
      '<div class="stack">' +
      '<div class="tiles">' +
      '<div class="card tile"><strong>' + sum.days + "</strong><span>hari</span></div>" +
      '<div class="card tile"><strong>' + sum.salat + "</strong><span>request salat &amp; zikir</span></div>" +
      '<div class="card tile"><strong>' + sum.daily + "</strong><span>request harian</span></div>" +
      '<div class="card tile"><strong>' + sum.weekly + "</strong><span>request mingguan</span></div></div>" +
      (miss ? '<p class="notice">' + miss + " habit mingguan bersaksi Teman tapi nama teman masih kosong.</p>" : "") +
      '<section class="card"><ol class="steps">' +
      "<li>Login di <b>app.kejar.id</b>, tekan <b>F12</b>, buka tab <b>Console</b>.</li>" +
      "<li>Tempel script ini lalu tekan <b>Enter</b>. Kalau diblokir, ketik <code>allow pasting</code> dulu.</li>" +
      "<li>Tunggu tulisan &quot;selesai&quot; untuk tiga bagian. ✅ berhasil, ⚠️ ditolak server.</li></ol></section>" +
      '<section class="card"><div class="codebar"><span>kejar-jurnal-script.js</span><div class="acts">' +
      '<button type="button" id="dlBtn">Unduh</button><button type="button" class="go" id="copyBtn">Salin</button></div></div>' +
      '<textarea class="code" id="scriptBox" readonly spellcheck="false" aria-label="Script"></textarea></section>' +
      "</div>"
    );
  }

  /* ---------- render ---------- */

  var view = document.getElementById("view");
  var dock = document.getElementById("dock");

  function render() {
    var ok = dateValid();
    document.getElementById("startDate").value = state.startDate;
    document.getElementById("endDate").value = state.endDate;
    document.getElementById("dateWarn").hidden = ok;
    document.querySelectorAll(".tab").forEach(function (b) {
      var sel = b.dataset.tab === state.tab;
      b.setAttribute("aria-selected", String(sel));
      b.dataset.skipped = String(skipped(b.dataset.tab));
    });

    document.querySelectorAll(".modes button").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.mode === state.mode));
    });

    var sum = ok ? summarizeScript(scriptInput()) : null;
    document.getElementById("dayCount").textContent = ok ? sum.days : "–";
    document.getElementById("copyTop").disabled = !ok;
    document.getElementById("dockText").innerHTML = ok
      ? "<b>" + (sum.salat + sum.daily + sum.weekly) + " request</b><br><small>" + sum.days + " hari · " + MODE_LABEL[state.mode] + "</small>"
      : "Tanggal belum valid";
    dock.hidden = state.tab === "script";

    if (state.tab === "harian") {
      view.innerHTML = renderHarian();
    } else if (state.tab === "mingguan") {
      view.innerHTML = renderMingguan();
      view.querySelectorAll("input.friend").forEach(function (inp) {
        inp.value = state.weeklyFriendName[inp.dataset.id] || "";
      });
    } else {
      view.innerHTML = renderScript();
      var box = document.getElementById("scriptBox");
      if (box) box.value = generateScript(scriptInput());
    }
  }

  /* ---------- aksi ---------- */

  var MAPS = { salat: "salatOn", daily: "dailyOn", weekly: "weeklyOn" };

  function setSection(section, on) {
    if (section === "salat") SALAT_GROUPS.forEach(function (g) { state.salatOn[g.key] = on; });
    if (section === "daily") DAILY_HABITS.forEach(function (h) { state.dailyOn[h.key] = on; });
    if (section === "weekly") WEEKLY_HABITS.forEach(function (h) { state.weeklyOn[h.habitId] = on; });
  }

  view.addEventListener("click", function (e) {
    var t = e.target.closest(".sw");
    if (t) {
      var map = state[MAPS[t.dataset.kind]];
      map[t.dataset.id] = !map[t.dataset.id];
      save(); render();
      return;
    }
    var act = e.target.closest("[data-act]");
    if (act) {
      var a = act.dataset.act;
      if (a === "day") {
        state.weeklyDay[act.closest(".more").dataset.id] = Number(act.dataset.v);
      } else if (a === "witness") {
        state.weeklyWitness[act.closest(".more").dataset.id] = act.dataset.v;
      } else {
        setSection(act.closest("[data-section]").dataset.section, a === "all-on");
      }
      save(); render();
      return;
    }
    if (e.target.id === "copyBtn") copyScript();
    if (e.target.id === "dlBtn") downloadScript();
  });

  view.addEventListener("input", function (e) {
    if (e.target.classList.contains("friend")) {
      state.weeklyFriendName[e.target.dataset.id] = e.target.value;
      save();
    }
  });

  document.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () {
      state.tab = b.dataset.tab; save(); render();
      window.scrollTo({ top: 0 });
    });
  });
  document.querySelectorAll(".modes button").forEach(function (b) {
    b.addEventListener("click", function () {
      state.mode = b.dataset.mode; save(); render();
      toast("Mode: " + MODE_LABEL[state.mode]);
    });
  });
  document.getElementById("startDate").addEventListener("input", function (e) { state.startDate = e.target.value; save(); render(); });
  document.getElementById("endDate").addEventListener("input", function (e) { state.endDate = e.target.value; save(); render(); });
  document.getElementById("resetBtn").addEventListener("click", function () {
    var tab = state.tab;
    state = defaults();
    state.tab = tab;
    save(); render();
    toast("Pengaturan dikembalikan ke default.");
  });
  document.getElementById("copyTop").addEventListener("click", function () {
    state.tab = "script"; save(); render(); window.scrollTo({ top: 0 }); copyScript();
  });

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  function currentScript() {
    return dateValid() ? generateScript(scriptInput()) : "";
  }

  function copyScript() {
    var script = currentScript();
    if (!script) return;
    var box = document.getElementById("scriptBox");
    function fallback() {
      try {
        box.focus(); box.select(); box.setSelectionRange(0, box.value.length);
        if (document.execCommand("copy")) { toast("Script tersalin. Tempel di Console Kejar.id."); return; }
      } catch (err) { /* lanjut */ }
      toast("Teks sudah diseleksi. Tekan Ctrl+C untuk menyalin.");
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(script).then(function () { toast("Script tersalin. Tempel di Console Kejar.id."); }, fallback);
    } else {
      fallback();
    }
  }

  function downloadScript() {
    var script = currentScript();
    if (!script) return;
    var url = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = "kejar-jurnal-script.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  render();
})();
