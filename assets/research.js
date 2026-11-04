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
