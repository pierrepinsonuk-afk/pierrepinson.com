/* Interactive career timeline on the About page. Edit the CAREER list to update it. */
(function () {
  const root = document.getElementById("ab-timeline");
  if (!root) return;
  const NOW = 2026.9;
  // lane, start, end (null = ongoing; same as start = milestone), title, details
  const CAREER = [
    ["Academia", 2002.7, 2006.5, "Ph.D., École des Mines de Paris", "Energy engineering: forecasting and stochastic optimisation for wind power."],
    ["Academia", 2006.5, 2008, "Postdoc, then Assistant Professor, DTU", "Department of Applied Mathematics and Computer Science."],
    ["Academia", 2008, 2013, "Associate Professor, DTU", "Department of Applied Mathematics and Computer Science."],
    ["Academia", 2013, 2020.9, "Professor of Energy Analytics and Markets, DTU", "Department of Electrical Engineering."],
    ["Academia", 2021, 2022.6, "Professor of Operations Research, DTU", "Department of Technology, Management and Economics."],
    ["Academia", 2022.6, null, "Professor, Imperial College London", "Dyson School of Design Engineering."],
    ["Academia", 2022.6, null, "Affiliated Professor, DTU", "Operations Research and Analytics, Department of Technology, Management and Economics."],
    ["Academia", 2023, null, "Associated Research Fellow, CoRE, Aarhus University", ""],
    ["Academia", 2009.2, 2009.2, "Visiting Researcher, University of Oxford", "Mathematical Institute."],
    ["Academia", 2009.6, 2009.6, "Visiting Researcher, University of Washington", "Department of Statistics, Seattle."],
    ["Academia", 2016.4, 2016.4, "Visiting Professor, ENS Rennes", "École Normale Supérieure de Rennes, France."],
    ["Academia", 2019.3, 2019.3, "Simons Fellow, Isaac Newton Institute", "Three months at the Institute for Mathematical Sciences, Cambridge."],
    ["Industry and advisory", 2010.3, 2011.3, "Scientist, ECMWF", "A year at the European Centre for Medium-Range Weather Forecasts, Reading: ensemble forecasting of surface winds."],
    ["Industry and advisory", 2019, 2026.4, "Scientific Advisor and Angel Investor, Atmo", "AI-based weather forecasting, acquired by Vaisala."],
    ["Industry and advisory", 2022, null, "Chief Scientific Advisor, Halfspace", "Data and AI company in Copenhagen, acquired by Accenture in 2025, now part of Faculty."],
    ["Industry and advisory", 2025, null, "International Expert, Innovation Fund Denmark", "Assessing research and innovation proposals."],
    ["Industry and advisory", 2026.75, null, "Principal, inCommodities", "Leading research and translation at an energy trading company in Aarhus."],
    ["Editorial", 2010, 2019, "Editor, Wind Energy", ""],
    ["Editorial", 2011, 2016, "Editor, IEEE Transactions on Power Systems", "Also IEEE Power Engineering Letters."],
    ["Editorial", 2014, 2019, "Associate Editor, then Editor, IJF", "International Journal of Forecasting."],
    ["Editorial", 2019, 2026.99, "Editor-in-Chief, International Journal of Forecasting", "Seven years leading the flagship journal of the International Institute of Forecasters."],
    ["Editorial", 2019, null, "Director, International Institute of Forecasters", ""],
    ["Editorial", 2021, 2026.5, "Associate Editor, OR Spectrum", ""],
    ["Editorial", 2022, 2024.9, "Associate Editor, Scientific Data (Nature)", ""],
    ["Recognition", 2017.5, 2017.5, "Emerald Citation of Excellence", ""],
    ["Recognition", 2018.5, 2018.5, "IDA Elektropris", "Yearly prize in electrical engineering of the Danish Society of Engineers."],
    ["Recognition", 2019.85, 2019.85, "Clarivate Highly Cited Researcher", "Cross-field, 2019–2023 and 2025."],
    ["Recognition", 2020.5, 2020.5, "IEEE Fellow", ""],
    ["Recognition", 2024.3, 2024.3, "INFORMS Franz Edelman Award", "Lead of the winning team, with Halfspace and Molslinjen: forecasting, optimisation and dynamic pricing in daily operations."],
    ["Recognition", 2024.7, 2024.7, "Beijing Foreign Scholar, Peking University", ""],
    ["Recognition", 2026.2, 2026.2, "DTU Ørsted Lecture", "“Can we predict the future of forecasting?”"],
    ["Recognition", 2026.5, 2026.5, "EPRI AI-ccelerate Unit Commitment competition", "Winner."],
  ];
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const svg = root.querySelector("svg");
  const W = 1100, L = 150, R = 16, Y0 = 2002, Y1 = 2027.2, ROW = 15, GAP = 4, LANEGAP = 18;
  const X = (y) => L + ((y - Y0) / (Y1 - Y0)) * (W - L - R);
  const lanes = ["Academia", "Industry and advisory", "Editorial", "Recognition"];
  // stack overlapping bars into rows within each lane
  const rows = {}; const placed = [];
  for (const it of CAREER) {
    const [lane, s, e0] = it; const e = e0 === null ? NOW : e0; const pt = e0 !== null && e0 === s;
    rows[lane] = rows[lane] || [];
    const span = pt ? [s - 0.35, s + 0.35] : [s, e];
    let r = lane === "Recognition" ? 0 : rows[lane].findIndex((ends) => ends.every(([a, b]) => span[0] >= b + 0.05 || span[1] <= a - 0.05));
    if (r < 0) { r = rows[lane].length; rows[lane].push([]); }
    if (!rows[lane][r]) rows[lane][r] = [];
    rows[lane][r].push(span);
    placed.push({ it, lane, r, s, e, pt, ongoing: e0 === null });
  }
  let y = 26; const laneY = {};
  for (const lane of lanes) { laneY[lane] = y; y += Math.max(1, (rows[lane] || []).length) * (ROW + GAP) + LANEGAP; }
  const H = y; svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  for (let yr = 2002; yr <= 2026; yr += 2) {
    el("line", { x1: X(yr), x2: X(yr), y1: 18, y2: H - 8, class: "w-grid" }, svg);
    el("text", { x: X(yr), y: 12, class: "w-tick", "text-anchor": "middle" }, svg).textContent = yr;
  }
  lanes.forEach((lane) => {
    el("text", { x: 0, y: laneY[lane] + ROW - 3, class: "ab-lane" }, svg).textContent = lane;
  });
  el("line", { x1: X(NOW - 0.4), x2: X(NOW - 0.4), y1: 18, y2: H - 8, class: "ab-today" }, svg);
  const when = root.querySelector(".ab-d-when"), title = root.querySelector(".ab-d-title"), text = root.querySelector(".ab-d-text");
  const nodes = [];
  function show(p, node) {
    nodes.forEach((n) => n.classList.remove("on")); node.classList.add("on");
    const s = Math.floor(p.s), e = p.ongoing ? "today" : Math.floor(p.e);
    when.textContent = p.pt ? s : (s === e ? s : `${s} – ${e}`);
    title.textContent = p.it[3]; text.textContent = p.it[4] || "";
  }
  placed.forEach((p) => {
    const yy = laneY[p.lane] + p.r * (ROW + GAP);
    let node;
    if (p.pt) {
      node = el("circle", { cx: X(p.s), cy: yy + ROW / 2, r: 6, class: "ab-pt " + (p.lane === "Recognition" ? "rec" : "visit"), tabindex: 0 }, svg);
    } else {
      node = el("rect", { x: X(p.s), y: yy, width: Math.max(9, X(p.e) - X(p.s)), height: ROW, rx: 4,
        class: "ab-bar lane-" + lanes.indexOf(p.lane) + (p.ongoing ? " ongoing" : ""), tabindex: 0 }, svg);
      const room = Math.floor((X(p.e) - X(p.s) - 12) / 6.2);
      if (room >= 8) {
        const t = el("text", { x: X(p.s) + 7, y: yy + ROW - 4, class: "ab-bar-label" + (p.lane === "Editorial" ? " dark" : "") }, svg);
        t.textContent = p.it[3].length > room ? p.it[3].slice(0, room - 1).trimEnd() + "…" : p.it[3];
      }
    }
    el("title", {}, node).textContent = p.it[3];
    node.setAttribute("aria-label", p.it[3]);
    ["mouseenter", "focus", "click"].forEach((ev) => node.addEventListener(ev, () => show(p, node)));
    nodes.push(node);
  });
  const start = placed.findIndex((p) => p.it[3].startsWith("Principal"));
  show(placed[start], nodes[start]);
})();
