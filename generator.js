// Generator script Kejar Jurnal (JavaScript biasa, tanpa build).
// Membutuhkan habits.js dimuat lebih dulu.
// Semua perhitungan tanggal pakai UTC supaya tidak bergeser 1 hari
// di zona waktu seperti WIB (UTC+7).
function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function parseISO(s) {
  return new Date(s + "T00:00:00Z");
}

function dateRange(start, end) {
  const dates = [];
  const cur = parseISO(start);
  const last = parseISO(end);
  while (cur <= last) {
    dates.push(toISO(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function weeks(startStr, endStr) {
  const d = parseISO(startStr);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  const out = [];
  const end = parseISO(endStr);
  while (d <= end) {
    const endW = new Date(d);
    endW.setUTCDate(endW.getUTCDate() + 6);
    out.push({ start: toISO(d), end: toISO(endW) });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

// Hari yang dipilih user (0 = Senin ... 6 = Minggu); kalau belum dipilih, pakai bawaan habit.
function dayFor(input, h) {
  // Habit yang diset "Tidak" selalu dicatat di hari bawaannya.
  if (input.weeklyOn && input.weeklyOn[h.habitId] === false) return h.dayOffset;
  const v = input.weeklyDay ? Number(input.weeklyDay[h.habitId]) : NaN;
  return Number.isInteger(v) && v >= 0 && v <= 6 ? v : h.dayOffset;
}

// Mode: "daily" (salat, zikir, harian), "weekly" (mingguan), atau "both" (keduanya).
var MODE_LABEL = { daily: "Harian saja", weekly: "Mingguan saja", both: "Harian + Mingguan" };
function normalizeMode(m) {
  return m === "daily" || m === "weekly" ? m : "both";
}

function generateScript(input) {
  const dates = dateRange(input.startDate, input.endDate);
  const weekList = weeks(input.startDate, input.endDate);

  const salat = SALAT_GROUPS.map((group) => {
    const on = input.salatOn[group.key] !== false;
    return group.items.map((item) =>
      on
        ? { id: item.id, category: item.onCategory, point: item.onPoint, do: true }
        : { id: item.id, category: "Tidak Melaksanakan", point: 0, do: false },
    );
  });

  const harian = DAILY_HABITS.map((h) => {
    const on = input.dailyOn[h.key] !== false;
    return {
      key: h.key,
      id: h.id,
      category: on ? h.onCategory : "Tidak Melaksanakan",
      point: on ? h.onPoint : 0,
      do: on,
      deed_id: h.deedId || null,
    };
  });

  const weekly = WEEKLY_HABITS.map((h) => {
    const on = input.weeklyOn[h.habitId] !== false;
    const dayOffset = dayFor(input, h);
    if (!on) {
      return {
        habit_id: h.habitId,
        category: "tidak melaksanakan",
        point: 0,
        dayOffset,
        deed_id: h.deedId || null,
      };
    }
    const witnessType = input.weeklyWitness[h.habitId] || "FRIEND";
    return {
      habit_id: h.habitId,
      category: h.onCategory,
      point: h.onPoint,
      dayOffset,
      deed_id: h.deedId || null,
      witnessType,
      witnessName: witnessType === "FRIEND" ? (input.weeklyFriendName[h.habitId] || "") : "",
    };
  });

  const mode = normalizeMode(input.mode);
  const head = `// === Kejar Jurnal Generator ===
// ${input.startDate} s/d ${input.endDate}
// Mode: ${MODE_LABEL[mode]}`;
  const salatBlock = `(async () => {
  const EP = "https://app.kejar.id/student/journal_salat_zikir/bulk-create";
  const GROUPS = ${JSON.stringify(salat)};
  const DATES = ${JSON.stringify(dates)};
  let ok=0, err=0;
  for (const date of DATES) {
    for (const group of GROUPS) {
      const params = new URLSearchParams();
      params.append("payloadHabit[date]", date);
      group.forEach((item, i) => {
        params.append("payloadHabit[categories]["+i+"][category]", item.category);
        params.append("payloadHabit[categories]["+i+"][point]", item.point);
        params.append("payloadHabit[categories]["+i+"][do]", item.do);
        params.append("payloadHabit[categories]["+i+"][deedable_id]", item.id);
      });
      try {
        const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/)||[])[1]||"");
        const res = await fetch(EP, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","X-XSRF-TOKEN":xsrf}, credentials:"include", body:params.toString() });
        const json = await res.json();
        if(res.ok){ok++;console.log("✅ Salat ["+date+"]",json);} else {err++;console.warn("⚠️ Salat ["+date+"] "+res.status,json);}
      } catch(e){err++;console.error("❌ Salat ["+date+"]",e);}
      await new Promise(r=>setTimeout(r,500));
    }
  }
  console.log("Salat & Zikir selesai — OK:"+ok+" ERR:"+err);
})();`;
  const dailyBlock = `(async () => {
  const EP = "https://app.kejar.id/student/journal-daily/bulk-deed-habbit";
  const HARIAN = ${JSON.stringify(harian)};
  const DATES = ${JSON.stringify(dates)};
  let ok=0, err=0;
  for (const date of DATES) {
    for (const h of HARIAN) {
      const params = new URLSearchParams();
      params.append("payloadHabit[date]", date);
      params.append("payloadHabit[type]", "HABIT");
      params.append("payloadHabit[categories][0][category]", h.category);
      params.append("payloadHabit[categories][0][point]", h.point);
      params.append("payloadHabit[categories][0][do]", h.do);
      params.append("payloadHabit[categories][0][deedable_id]", h.id);
      if (h.deed_id) params.append("payloadHabit[categories][0][deed_id]", h.deed_id);
      try {
        const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/)||[])[1]||"");
        const res = await fetch(EP, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","X-XSRF-TOKEN":xsrf}, credentials:"include", body:params.toString() });
        const json = await res.json();
        if(res.ok){ok++;console.log("✅ Harian ["+date+"]["+h.key+"]",json);} else {err++;console.warn("⚠️ Harian ["+date+"]["+h.key+"] "+res.status,json);}
      } catch(e){err++;console.error("❌ Harian ["+date+"]["+h.key+"]",e);}
      await new Promise(r=>setTimeout(r,400));
    }
  }
  console.log("Harian selesai — OK:"+ok+" ERR:"+err);
})();`;
  const weeklyBlock = `(async () => {
  const EP = "https://app.kejar.id/student/journal-weekly/deed-habbit";
  const RANGE_START = ${JSON.stringify(input.startDate)};
  const RANGE_END = ${JSON.stringify(input.endDate)};
  const WEEKS = ${JSON.stringify(weekList)};
  const TEMPLATES = ${JSON.stringify(weekly)};
  function addDays(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0,10);
  }
  let ok=0, err=0;
  for (const week of WEEKS) {
    console.log("\\n=== Minggu "+week.start+" s/d "+week.end+" ===");
    for (const t of TEMPLATES) {
      const date = addDays(week.start, t.dayOffset);
      if (date < week.start || date > week.end) continue;
      // Hanya kirim tanggal di dalam rentang Mulai–Akhir (hindari tanggal masa depan).
      if (date < RANGE_START || date > RANGE_END) continue;
      const params = new URLSearchParams();
      params.append("payloadDeed[habit_id]", t.habit_id);
      params.append("payloadDeed[category]", t.category);
      params.append("payloadDeed[point]", t.point);
      params.append("payloadDeed[date]", date);
      params.append("payloadDeed[deedable_type]", "HABIT");
      params.append("payloadDeed[subtype]", "HABIT");
      if (t.witnessType) {
        params.append("payloadDeed[witnessType]", t.witnessType);
        params.append("payloadDeed[witnessName]", t.witnessName || "");
      }
      if (t.deed_id) params.append("payloadDeed[deed_id]", t.deed_id);
      try {
        const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/)||[])[1]||"");
        const res = await fetch(EP, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","X-XSRF-TOKEN":xsrf}, credentials:"include", body:params.toString() });
        const json = await res.json();
        if(res.ok){ok++;console.log("✅ Weekly "+date+" | "+t.habit_id.slice(0,8),json);} else {err++;console.warn("⚠️ Weekly "+date+" | "+t.habit_id.slice(0,8)+" → "+res.status,json);}
      } catch(e){err++;console.error("❌ Weekly "+date,e);}
      await new Promise(r=>setTimeout(r,500));
    }
  }
  console.log("\\nMingguan selesai — OK:"+ok+" ERR:"+err);
})();`;
  const parts = [head];
  if (mode !== "weekly") parts.push(salatBlock, dailyBlock);
  if (mode !== "daily") parts.push(weeklyBlock);
  return parts.join("\n\n") + "\n";
}

// Ringkasan jumlah request, memakai aturan tanggal yang sama dengan script.
function summarizeScript(input) {
  const dates = dateRange(input.startDate, input.endDate);
  const weekList = weeks(input.startDate, input.endDate);
  let weekly = 0;
  for (const week of weekList) {
    for (const h of WEEKLY_HABITS) {
      const d = parseISO(week.start);
      d.setUTCDate(d.getUTCDate() + dayFor(input, h));
      const date = toISO(d);
      if (date < week.start || date > week.end) continue;
      if (date < input.startDate || date > input.endDate) continue;
      weekly++;
    }
  }
  const mode = normalizeMode(input.mode);
  return {
    days: dates.length,
    salat: mode === "weekly" ? 0 : dates.length * SALAT_GROUPS.length,
    daily: mode === "weekly" ? 0 : dates.length * DAILY_HABITS.length,
    weekly: mode === "daily" ? 0 : weekly,
  };
}

window.generateScript = generateScript;
window.MODE_LABEL = MODE_LABEL;
window.summarizeScript = summarizeScript;
