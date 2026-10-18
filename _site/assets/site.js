/* Interactive forecast hero + publications explorer. No dependencies. */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Hero: re-forecast as you move across the chart ---------- */
  const svg = document.getElementById("fan");
  if (svg) {
    const W = 400, H = 230, N = 90, NS = "http://www.w3.org/2000/svg";
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const s = []; let v = 0.5;
    for (let i = 0; i < N; i++) {
      v += (rnd() - 0.5) * 0.11 + (0.5 - v) * 0.05;
      v = Math.min(0.95, Math.max(0.05, v)); s.push(v);
    }
    const X = i => (i / (N - 1)) * W;
    const Y = p => H - 14 - p * (H - 32);
    const clamp = p => Math.min(1, Math.max(0, p));
    svg.innerHTML = "";
    const mk = (cls, attrs) => { const e = document.createElementNS(NS, "path"); e.setAttribute("class", cls);
      for (const k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; };
    const widths = [1.28, 0.84, 0.39];            // ~ 80%, 60%, 30% central intervals
    const bands = widths.map((_, k) => mk("band b" + (k + 1), { opacity: [0.16, 0.3, 0.55][k] }));
    const truth = mk("truth", { fill: "none", "stroke-width": 1.5, "stroke-dasharray": "2 4" });
    const obs = mk("obs", { fill: "none", "stroke-width": 2.5 });
    const med = mk("median", { fill: "none", "stroke-width": 2, "stroke-dasharray": "5 5" });
    const nowLine = document.createElementNS(NS, "line"); nowLine.setAttribute("class", "now");
    nowLine.setAttribute("y1", 8); nowLine.setAttribute("y2", H - 4); svg.appendChild(nowLine);
    const dot = document.createElementNS(NS, "circle"); dot.setAttribute("class", "now-dot"); dot.setAttribute("r", 4); svg.appendChild(dot);

    const line = (pts) => pts.map((p, j) => (j ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    let now = N * 0.42, target = now, hovering = false, t0 = performance.now();

    function draw(n) {
      const i0 = Math.max(2, Math.min(N - 8, Math.round(n)));
      const last = s[i0];
      const m = [], up = widths.map(() => []), lo = widths.map(() => []);
      for (let i = i0; i < N; i++) {
        const h = i - i0;
        const mu = 0.5 + (last - 0.5) * Math.exp(-h / 22);          // persistence decaying to climatology
        const sd = 0.015 + 0.2 * (1 - Math.exp(-h / 16));            // uncertainty grows with lead time
        m.push([X(i), Y(mu)]);
        widths.forEach((z, k) => { up[k].push([X(i), Y(clamp(mu + z * sd))]); lo[k].push([X(i), Y(clamp(mu - z * sd))]); });
      }
      bands.forEach((b, k) => b.setAttribute("d", line(up[k]) + " " + line(lo[k].slice().reverse()).replace("M", "L") + " Z"));
      obs.setAttribute("d", line(s.slice(0, i0 + 1).map((p, i) => [X(i), Y(p)])));
      truth.setAttribute("d", line(s.slice(i0).map((p, j) => [X(i0 + j), Y(p)])));
      med.setAttribute("d", line(m));
      nowLine.setAttribute("x1", X(i0)); nowLine.setAttribute("x2", X(i0));
      dot.setAttribute("cx", X(i0)); dot.setAttribute("cy", Y(last));
    }
    function frame(t) {
      if (!hovering && !reduce) target = N * (0.47 + 0.13 * Math.sin((t - t0) / 5200));
      now += (target - now) * 0.08;
      draw(now);
      if (!reduce || Math.abs(target - now) > 0.05) requestAnimationFrame(frame);
    }
    const pick = (e) => { const r = svg.getBoundingClientRect(); hovering = true;
      target = ((e.clientX - r.left) / r.width) * (N - 1);
      if (reduce) requestAnimationFrame(frame); };
    svg.addEventListener("pointermove", pick);
    svg.addEventListener("pointerdown", pick);
    svg.addEventListener("pointerleave", () => { hovering = false; t0 = performance.now() - 5200 * Math.asin(Math.max(-1, Math.min(1, (now / N - 0.47) / 0.13))); if (reduce) requestAnimationFrame(frame); });
    svg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { hovering = true;
      target = Math.max(2, Math.min(N - 8, target + (e.key === "ArrowLeft" ? -3 : 3))); e.preventDefault(); if (reduce) requestAnimationFrame(frame); } });
    draw(now); requestAnimationFrame(frame);
  }

  /* ---------- Publications explorer ---------- */
  const ex = document.getElementById("pub-explorer");
  if (ex) {
    const items = Array.from(document.querySelectorAll(".pub[data-year]"));
    const state = { year: null, theme: null, kind: null, q: "" };
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get("theme")) state.theme = hash.get("theme");
    const years = items.map(i => +i.dataset.year);
    const y0 = Math.min(...years), y1 = Math.max(...years);
    const hist = ex.querySelector(".pub-hist"), count = ex.querySelector(".pub-count");
    const bars = {};
    for (let y = y0; y <= y1; y++) {
      const b = document.createElement("button"); b.type = "button"; b.className = "bar"; b.dataset.year = y;
      b.innerHTML = '<span class="fill"></span><span class="lbl">' + (y % 5 === 0 || y === y1 ? y : "") + "</span>";
      b.addEventListener("click", () => { state.year = state.year === y ? null : y; update(); });
      hist.appendChild(b); bars[y] = b;
    }
    ex.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
      const g = c.dataset.group, val = c.dataset.value || null;
      state[g] = state[g] === val ? null : val; update();
    }));
    ex.querySelector(".pub-search").addEventListener("input", (e) => { state.q = e.target.value.trim().toLowerCase(); update(); });
    ex.querySelector(".pub-reset").addEventListener("click", () => {
      Object.assign(state, { year: null, theme: null, kind: null, q: "" }); ex.querySelector(".pub-search").value = ""; update(); });

    const match = (it, skipYear) => (skipYear || !state.year || +it.dataset.year === state.year)
      && (!state.theme || it.dataset.themes.split(" ").includes(state.theme))
      && (!state.kind || it.dataset.kind === state.kind)
      && (!state.q || it.textContent.toLowerCase().includes(state.q));

    function update() {
      const per = {}; let max = 1, shown = 0;
      items.forEach(it => { if (match(it, true)) { const y = +it.dataset.year; per[y] = (per[y] || 0) + 1; max = Math.max(max, per[y]); } });
      items.forEach(it => { const ok = match(it, false); it.hidden = !ok; if (ok) shown++; });
      for (const y in bars) {
        const n = per[y] || 0; const b = bars[y];
        b.querySelector(".fill").style.height = (n / max * 100) + "%";
        b.setAttribute("aria-pressed", state.year === +y); b.title = y + ": " + n + (n === 1 ? " paper" : " papers");
        b.setAttribute("aria-label", b.title);
      }
      ex.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", (state[c.dataset.group] || null) === (c.dataset.value || null)));
      count.textContent = shown === items.length ? items.length + " papers" : shown + " of " + items.length + " papers";
      ex.classList.toggle("is-filtered", shown !== items.length);
      ex.classList.toggle("has-year", state.year !== null);
      const h = state.theme ? "#theme=" + state.theme : " ";
      history.replaceState(null, "", h === " " ? location.pathname : h);
    }
    update();
  }
})();
