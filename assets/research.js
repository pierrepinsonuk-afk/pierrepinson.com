/* Interactive illustrations for the research pages. No dependencies. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = (r) => { let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const path = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- 1. From prediction intervals to scenarios ---------- */
  const sc = document.getElementById("w-scenarios");
  if (sc) {
    const svg = sc.querySelector("svg"), slider = sc.querySelector("input[type=range]");
    const out = sc.querySelector(".w-value"), btn = sc.querySelector("button");
    const W = 640, H = 300, T = 48, L = 40, B = 34, R = 12, TOP = 12;
    const X = (t) => L + (t / (T - 1)) * (W - L - R), Y = (v) => TOP + (1 - v) * (H - TOP - B);
    const m = [], sd = [];
    for (let t = 0; t < T; t++) { m.push(0.45 + 0.18 * Math.sin(t / 9) - 0.1 * Math.sin(t / 4.5 + 1)); sd.push(0.04 + 0.16 * (1 - Math.exp(-t / 14))); }
    const grid = el("g", {}, svg);
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "w-grid" }, grid);
      el("text", { x: L - 8, y: Y(v) + 4, class: "w-tick", "text-anchor": "end" }, grid).textContent = (v * 100).toFixed(0) + "%";
    });
    [0, 12, 24, 36, 47].forEach((t) => { el("text", { x: X(t), y: H - 12, class: "w-tick", "text-anchor": "middle" }, grid).textContent = "+" + (t + 1) + "h"; });
    const band = (z) => { const up = [], lo = []; for (let t = 0; t < T; t++) { up.push([X(t), Y(clamp(m[t] + z * sd[t], 0, 1))]); lo.push([X(t), Y(clamp(m[t] - z * sd[t], 0, 1))]); }
      return path(up) + " " + path(lo.reverse()).replace("M", "L") + " Z"; };
    el("path", { d: band(1.2816), class: "w-band b1" }, svg);
    el("path", { d: band(0.6745), class: "w-band b2" }, svg);
    const g = el("g", {}, svg);
    el("path", { d: path(m.map((v, t) => [X(t), Y(v)])), class: "w-median" }, svg);
    let seed = 42;
    function draw() {
      const rho = +slider.value / 100; out.textContent = rho.toFixed(2);
      g.innerHTML = "";
      const r = rng(seed);
      for (let s = 0; s < 10; s++) {
        let z = gauss(r); const pts = [];
        for (let t = 0; t < T; t++) { if (t) z = rho * z + Math.sqrt(1 - rho * rho) * gauss(r); pts.push([X(t), Y(clamp(m[t] + sd[t] * z, 0, 1))]); }
        el("path", { d: path(pts), class: "w-scen" + (s === 0 ? " hl" : "") }, g);
      }
    }
    slider.addEventListener("input", draw);
    btn.addEventListener("click", () => { seed = (seed * 7919) % 2147483647; draw(); });
    draw();
  }

  /* ---------- 2. Trading wind under a two-price imbalance settlement ---------- */
  const tr = document.getElementById("w-trading");
  if (tr) {
    const svg = tr.querySelector("svg");
    const sUp = tr.querySelector("[name=up]"), sDown = tr.querySelector("[name=down]"), sUnc = tr.querySelector("[name=unc]");
    const vUp = tr.querySelector(".v-up"), vDown = tr.querySelector(".v-down"), vUnc = tr.querySelector(".v-unc");
    const summary = tr.querySelector(".w-summary");
    const W = 640, H = 330, L = 44, R = 30, CAP = 100, PRICE = 50, MEAN = 42;
    const X = (e) => L + (e / CAP) * (W - L - R);
    const top = { y0: 34, y1: 150 }, bot = { y0: 184, y1: 296 };
    const grid = el("g", {}, svg);
    [0, 25, 50, 75, 100].forEach((e) => { el("text", { x: X(e), y: H - 10, class: "w-tick", "text-anchor": "middle" }, grid).textContent = e + " MW"; });
    el("line", { x1: L, x2: W - R, y1: top.y1, y2: top.y1, class: "w-axis" }, grid);
    el("line", { x1: L, x2: W - R, y1: bot.y1, y2: bot.y1, class: "w-axis" }, grid);
    el("text", { x: L, y: 12, class: "w-label" }, grid).textContent = "Predictive distribution of tomorrow's wind power";
    el("text", { x: L, y: bot.y0 - 6, class: "w-label" }, grid).textContent = "Expected revenue as a function of the offer";
    const dens = el("path", { class: "w-dens" }, svg), densLine = el("path", { class: "w-dens-line" }, svg);
    const rev = el("path", { class: "w-rev" }, svg);
    const lineMean = el("line", { class: "w-mean" }, svg), lineOpt = el("line", { class: "w-opt" }, svg);
    const dotMean = el("circle", { r: 4.5, class: "w-dot-mean" }, svg), dotOpt = el("circle", { r: 5.5, class: "w-dot-opt" }, svg);
    const tagMean = el("text", { class: "w-tag", "text-anchor": "middle" }, svg), tagOpt = el("text", { class: "w-tag acc", "text-anchor": "middle" }, svg);
    const N = 201, xs = Array.from({ length: N }, (_, i) => (i / (N - 1)) * CAP);
    function update() {
      const up = +sUp.value, down = +sDown.value, unc = +sUnc.value;
      vUp.textContent = up; vDown.textContent = down; vUnc.textContent = unc;
      // logit-normal predictive density on [0, CAP], so it respects the capacity bounds
      const mu = Math.log(MEAN / (CAP - MEAN)), s = unc / 25;
      const f = xs.map((x) => { const u = clamp(x / CAP, 1e-4, 1 - 1e-4); const z = (Math.log(u / (1 - u)) - mu) / s;
        return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI) * u * (1 - u)); });
      const tot = f.reduce((a, b) => a + b, 0); const w = f.map((v) => v / tot);
      const cdf = []; w.reduce((a, b, i) => (cdf[i] = a + b), 0);
      const fmax = Math.max(...f);
      const yd = (v) => top.y1 - (v / fmax) * (top.y1 - top.y0 - 14);
      const dpts = xs.map((x, i) => [X(x), yd(f[i])]);
      densLine.setAttribute("d", path(dpts));
      dens.setAttribute("d", path(dpts) + ` L${X(CAP)} ${top.y1} L${X(0)} ${top.y1} Z`);
      // expected revenue: spot price on the offer, imbalances settled at penalised prices (two-price)
      const ER = xs.map((E) => { let r = 0; for (let i = 0; i < N; i++) { const x = xs[i];
          r += w[i] * (PRICE * E + (x > E ? (PRICE - down) * (x - E) : -(PRICE + up) * (E - x))); } return r; });
      const mean = xs.reduce((a, x, i) => a + w[i] * x, 0);
      const level = down / (down + up);
      const iOpt = cdf.findIndex((c) => c >= level), eOpt = xs[Math.max(0, iOpt)];
      const rmin = Math.min(...ER), rmax = Math.max(...ER);
      const yr = (v) => bot.y1 - ((v - rmin) / (rmax - rmin || 1)) * (bot.y1 - bot.y0 - 8);
      rev.setAttribute("d", path(xs.map((E, i) => [X(E), yr(ER[i])])));
      const iMean = Math.round((mean / CAP) * (N - 1));
      const place = (line, dot, tag, e, r, label, dy) => {
        line.setAttribute("x1", X(e)); line.setAttribute("x2", X(e)); line.setAttribute("y1", top.y0 + 4); line.setAttribute("y2", bot.y1);
        dot.setAttribute("cx", X(e)); dot.setAttribute("cy", yr(r)); tag.setAttribute("x", X(e)); tag.setAttribute("y", top.y0 - 2 + dy); tag.textContent = label; };
      const close = Math.abs(eOpt - mean) < 9;
      place(lineMean, dotMean, tagMean, mean, ER[iMean], "point forecast", close ? 13 : 0);
      place(lineOpt, dotOpt, tagOpt, eOpt, ER[Math.max(0, iOpt)], "optimal offer", 0);
      const gain = ER[Math.max(0, iOpt)] - ER[iMean];
      summary.innerHTML = `Offer the <strong>${fmt(level * 100)}% quantile</strong>, ${fmt(eOpt)} MW, rather than the point forecast of ${fmt(mean)} MW. ` +
        (gain > 0.5 ? `Expected gain: <strong>€${fmt(gain)}</strong> per hour.` : `Here the two are almost the same.`);
    }
    [sUp, sDown, sUnc].forEach((s) => s.addEventListener("input", update));
    update();
  }

  /* ---------- 3. A regression market ---------- */
  const rm = document.getElementById("w-regmarket");
  if (rm) {
    const n = 300, r = rng(7);
    const own = [], a = [], b = [], c = [], y = [];
    for (let i = 0; i < n; i++) {
      const s1 = gauss(r), s2 = 0.6 * s1 + 0.8 * gauss(r), s3 = gauss(r), o = 0.5 * s1 + 0.9 * gauss(r);
      own.push(o); a.push(s1); b.push(s2); c.push(s3);
      y.push(0.4 * o + 0.9 * s1 + 0.45 * s2 + 1.1 * gauss(r));
    }
    const sellers = [a, b, c];
    function mse(cols) { // least squares on [1, own, ...cols]
      const Xs = [Array(n).fill(1), own, ...cols], k = Xs.length;
      const A = Array.from({ length: k }, (_, i) => Array.from({ length: k + 1 }, (_, j) => {
        let s = 0; const v = j < k ? Xs[j] : y; for (let t = 0; t < n; t++) s += Xs[i][t] * v[t]; return s; }));
      for (let i = 0; i < k; i++) { let p = i; for (let j = i + 1; j < k; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
        [A[i], A[p]] = [A[p], A[i]]; for (let j = i + 1; j < k; j++) { const f = A[j][i] / A[i][i]; for (let q = i; q <= k; q++) A[j][q] -= f * A[i][q]; } }
      const beta = Array(k).fill(0);
      for (let i = k - 1; i >= 0; i--) { let s = A[i][k]; for (let j = i + 1; j < k; j++) s -= A[i][j] * beta[j]; beta[i] = s / A[i][i]; }
      let e = 0; for (let t = 0; t < n; t++) { let f = 0; for (let j = 0; j < k; j++) f += beta[j] * Xs[j][t]; e += (y[t] - f) ** 2; }
      return e / n;
    }
    const cache = {}; const loss = (mask) => (cache[mask] ??= mse(sellers.filter((_, i) => mask & (1 << i))));
    const base = loss(0);
    const boxes = Array.from(rm.querySelectorAll("input[type=checkbox]")), price = rm.querySelector("[name=price]");
    const vPrice = rm.querySelector(".v-price"), bars = rm.querySelectorAll(".rm-pay"), errBar = rm.querySelector(".rm-err-fill");
    const errTxt = rm.querySelector(".rm-err-txt"), total = rm.querySelector(".w-summary");
    const fact = [1, 1, 2, 6];
    function update() {
      const act = boxes.map((x) => x.checked), mask = act.reduce((m, on, i) => m | (on ? 1 << i : 0), 0);
      const phi = +price.value; vPrice.textContent = phi;
      const gainTotal = base - loss(mask);
      // Shapley value of each active seller, over the active coalition
      const ids = [0, 1, 2].filter((i) => act[i]), K = ids.length, pay = [0, 0, 0];
      for (const i of ids) {
        const others = ids.filter((j) => j !== i);
        for (let sub = 0; sub < 1 << others.length; sub++) {
          let m = 0, sz = 0; others.forEach((j, q) => { if (sub & (1 << q)) { m |= 1 << j; sz++; } });
          const wgt = (fact[sz] * fact[K - sz - 1]) / fact[K];
          pay[i] += wgt * (loss(m) - loss(m | (1 << i)));
        }
      }
      const maxPay = phi * (base - loss(7)) || 1;
      bars.forEach((bar, i) => { const v = Math.max(0, phi * pay[i]);
        bar.querySelector(".rm-fill").style.width = (100 * v / maxPay) + "%";
        bar.querySelector(".rm-amt").textContent = act[i] ? "€" + fmt(v) : "not selling";
        bar.classList.toggle("off", !act[i]); });
      const rel = 1 - loss(mask) / base;
      errBar.style.width = (100 * loss(mask) / base) + "%";
      errTxt.textContent = mask ? `Forecast error down ${fmt(rel * 100)}% with the data bought` : "Forecast error with own data only";
      total.innerHTML = mask ? `The forecaster pays <strong>€${fmt(phi * gainTotal)}</strong> in total, shared by each seller's marginal contribution (Shapley value).`
        : "Select data sellers to see the forecast improve and how payments are shared.";
    }
    boxes.concat([price]).forEach((x) => x.addEventListener("input", update));
    update();
  }
})();

/* ---------- 4. Future electricity markets: a stylised day-ahead market ---------- */
(function () {
  const root = document.getElementById("w-future");
  if (!root) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const fmt = (x, d = 0) => x.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  const merit = root.querySelector(".fm-merit"), day = root.querySelector(".fm-day");
  const sRen = root.querySelector("[name=ren]"), sFlex = root.querySelector("[name=flex]"), sHour = root.querySelector("[name=hour]");
  const vRen = root.querySelector(".v-ren"), vHour = root.querySelector(".v-hour"), summary = root.querySelector(".w-summary");
  const stat = (k) => root.querySelector(`[data-k=${k}]`);
  const LCOE = 45, PCAP = 200, FLEX = 0.15;
  const THERMAL = [{ n: "Nuclear", q: 12, c: 12 }, { n: "Coal", q: 16, c: 55 }, { n: "Gas", q: 26, c: 90 }, { n: "Peakers", q: 14, c: 160 }];
  const H = 24, demand = [], solar = [], wind = [];
  for (let h = 0; h < H; h++) {
    demand.push(46 + 9 * Math.sin(((h - 7) / 24) * 2 * Math.PI) + 5 * Math.exp(-((h - 19) ** 2) / 6));
    solar.push(Math.max(0, Math.sin(((h - 6) / 13) * Math.PI)) ** 1.3);
    wind.push(0.42 + 0.14 * Math.cos(((h - 3) / 24) * 2 * Math.PI));
  }
  const ELAST = 6; // GW of price-responsive demand, from PCAP down to 0
  function clear(D, R) { // returns {p, q, ren}
    const steps = [{ q: R, c: 0 }, ...THERMAL.map((t) => ({ q: t.q, c: t.c }))];
    const inv = (q) => (q <= D - ELAST ? PCAP : PCAP * (1 - (q - (D - ELAST)) / ELAST));
    let Q = 0;
    for (const s of steps) {
      const Qn = Q + s.q;
      const qAt = inv(Qn) >= s.c ? null : 0; // demand price at the end of this step below its cost?
      const pAtStart = inv(Q);
      if (pAtStart < s.c) return { p: pAtStart, q: Q }; // demand price falls below this step's cost before it is used
      if (inv(Qn) <= s.c) { // crossing within this step at price s.c
        const q = s.c >= PCAP ? D - ELAST : (D - ELAST) + ELAST * (1 - s.c / PCAP);
        return { p: s.c, q: Math.max(Q, Math.min(Qn, q)) };
      }
      Q = Qn;
    }
    return { p: PCAP, q: Q };
  }
  function run() {
    const cap = +sRen.value, flex = sFlex.checked;
    const R = solar.map((s, h) => cap * (0.45 * s + 0.55 * wind[h]) * 0.7);
    let D = demand.slice();
    if (flex) { // shift up to FLEX of each hour's demand, flattening the residual demand (demand minus wind and solar)
      const resid = D.map((d, h) => d - R[h]);
      const shift = (L) => D.map((d, h) => Math.max(-FLEX * d, Math.min(2 * FLEX * d, L - resid[h])));
      let lo = Math.min(...resid) - 100, hi = Math.max(...resid) + 100;
      for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (shift(mid).reduce((x, y) => x + y, 0) > 0) hi = mid; else lo = mid; }
      const sh = shift((lo + hi) / 2);
      D = D.map((d, h) => d + sh[h]);
    }
    const res = D.map((d, h) => { const r = clear(d, R[h]); return { ...r, D: d, R: R[h], ren: Math.min(R[h], r.q) }; });
    return { res, cap };
  }
  // --- static drawing setup ---
  const M = { W: 640, H: 230, L: 46, R: 14, T: 14, B: 30 }, QMAX = 110;
  const mx = (q) => M.L + (q / QMAX) * (M.W - M.L - M.R), my = (p) => M.T + (1 - p / PCAP) * (M.H - M.T - M.B);
  const gm = el("g", {}, merit);
  [0, 50, 100, 150, 200].forEach((p) => { el("line", { x1: M.L, x2: M.W - M.R, y1: my(p), y2: my(p), class: "w-grid" }, gm);
    el("text", { x: M.L - 8, y: my(p) + 4, class: "w-tick", "text-anchor": "end" }, gm).textContent = "€" + p; });
  [0, 25, 50, 75, 100].forEach((q) => { el("text", { x: mx(q), y: M.H - 10, class: "w-tick", "text-anchor": "middle" }, gm).textContent = q + " GW"; });
  const mLayer = el("g", {}, merit);
  const DW = { W: 640, H: 170, L: 46, R: 14, T: 10, B: 26 };
  const bw = (DW.W - DW.L - DW.R) / H, dx = (h) => DW.L + h * bw, dyP = (p) => DW.T + (1 - p / PCAP) * (DW.H - DW.T - DW.B);
  const gd = el("g", {}, day);
  [0, 100, 200].forEach((p) => { el("line", { x1: DW.L, x2: DW.W - DW.R, y1: dyP(p), y2: dyP(p), class: "w-grid" }, gd);
    el("text", { x: DW.L - 8, y: dyP(p) + 4, class: "w-tick", "text-anchor": "end" }, gd).textContent = "€" + p; });
  [0, 6, 12, 18, 23].forEach((h) => { el("text", { x: dx(h) + bw / 2, y: DW.H - 8, class: "w-tick", "text-anchor": "middle" }, gd).textContent = String(h).padStart(2, "0") + ":00"; });
  const lcoe = el("line", { x1: DW.L, x2: DW.W - DW.R, y1: dyP(LCOE), y2: dyP(LCOE), class: "fm-lcoe" }, gd);
  el("text", { x: DW.L + 4, y: dyP(LCOE) - 5, class: "w-tick fm-acc" }, gd).textContent = "€45: what wind and solar need";
  el("text", { x: DW.W - DW.R, y: DW.T + 10, class: "w-tick", "text-anchor": "end" }, gd).textContent = "bars: hourly price · shaded: wind and solar available";
  const renArea = el("path", { class: "fm-renarea" }, day);
  const bars = [];
  for (let h = 0; h < H; h++) {
    const b = el("rect", { x: dx(h) + 2, width: bw - 4, class: "fm-bar", tabindex: -1 }, day);
    b.addEventListener("click", () => { sHour.value = h; draw(); });
    b.addEventListener("mouseenter", () => { sHour.value = h; draw(); });
    bars.push(b);
  }
  function draw() {
    const { res, cap } = run(), h = +sHour.value, r = res[h];
    vRen.textContent = cap; vHour.textContent = String(h).padStart(2, "0") + ":00";
    // merit order for the selected hour
    mLayer.innerHTML = "";
    const steps = [{ n: "Wind & solar", q: r.R, c: 0, ren: true }, ...THERMAL];
    let Q = 0;
    steps.forEach((s) => { if (s.q <= 0.01) return;
      const used = Math.max(0, Math.min(s.q, r.q - Q));
      el("rect", { x: mx(Q), y: my(Math.max(s.c, 2)), width: Math.max(0, mx(Q + s.q) - mx(Q)), height: Math.max(1.5, my(0) - my(Math.max(s.c, 2))),
        class: "fm-step" + (s.ren ? " ren" : "") + (used > 0 ? " used" : "") }, mLayer);
      if (mx(Q + s.q) - mx(Q) > 44 && Q < QMAX) el("text", { x: mx(Q) + 5, y: my(Math.max(s.c, 2)) - 5, class: "w-tick" }, mLayer).textContent = s.n;
      Q += s.q; });
    const Dd = r.D, dpts = [[mx(0), my(PCAP)], [mx(Dd - ELAST), my(PCAP)], [mx(Dd), my(0)]];
    el("path", { d: dpts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" "), class: "fm-demand" }, mLayer);
    el("line", { x1: M.L, x2: mx(r.q), y1: my(r.p), y2: my(r.p), class: "fm-price" }, mLayer);
    el("circle", { cx: mx(r.q), cy: my(r.p), r: 5, class: "w-dot-opt" }, mLayer);
    el("text", { x: Math.min(mx(r.q) + 8, M.W - 120), y: my(r.p) - 8, class: "w-tag acc" }, mLayer).textContent = "€" + fmt(r.p) + "/MWh";
    el("text", { x: mx(Math.min(Dd - ELAST, QMAX - 12)) - 6, y: my(PCAP) + 16, class: "w-tick", "text-anchor": "end" }, mLayer).textContent = "demand";
    // day profile
    const rmax = 110; const ry = (g) => DW.T + (1 - g / rmax) * (DW.H - DW.T - DW.B);
    const top = res.map((x, i) => [dx(i) + bw / 2, ry(Math.min(rmax, x.R))]);
    renArea.setAttribute("d", `M${dx(0)} ${ry(0)} ` + top.map((p) => `L${p[0]} ${p[1]}`).join(" ") + ` L${dx(H)} ${ry(0)} Z`);
    res.forEach((x, i) => { const b = bars[i]; const y = dyP(Math.max(x.p, 1.5));
      b.setAttribute("y", y); b.setAttribute("height", dyP(0) - y); b.classList.toggle("sel", i === h); b.classList.toggle("zero", x.p < 1); });
    // stats
    const totD = res.reduce((a, x) => a + x.q, 0), avg = res.reduce((a, x) => a + x.p * x.q, 0) / totD;
    const renE = res.reduce((a, x) => a + x.ren, 0), renAvail = res.reduce((a, x) => a + x.R, 0);
    const capture = renE > 0 ? res.reduce((a, x) => a + x.p * x.ren, 0) / renE : 0;
    const zero = res.filter((x) => x.p < 1).length, curt = renAvail > 0 ? 1 - renE / renAvail : 0;
    stat("avg").textContent = "€" + fmt(avg); stat("zero").textContent = zero;
    stat("capture").textContent = cap > 0 ? "€" + fmt(capture) : "–"; stat("curt").textContent = fmt(curt * 100) + "%";
    root.querySelector("[data-k=capture]").classList.toggle("bad", cap > 0 && capture < LCOE);
    summary.innerHTML = cap === 0 ? "No wind or solar yet: fossil plants set the price in every hour."
      : capture >= LCOE ? `Wind and solar earn <strong>€${fmt(capture)}/MWh</strong> on average, enough to recover their investment.`
      : `Wind and solar earn only <strong>€${fmt(capture)}/MWh</strong> on average, below the ~€${LCOE} they need: marginal pricing alone no longer pays for the investment.` +
        (sFlex.checked ? " Flexible demand helps, but here there is more renewable energy than demand to shift." : " Try letting flexible demand follow supply.");
  }
  [sRen, sFlex, sHour].forEach((x) => x.addEventListener("input", draw));
  draw();
})();
