"""Generate publication data and course pages from the plain-text sources in data/.

Run from the project root before `quarto render`:  python scripts/build.py
Requires PyYAML (pip install pyyaml).
"""
import re
import unicodedata
from pathlib import Path

import sys

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
# Where lecture slides and exercise PDFs live. Once you copy the old /31761 folder
# from the WordPress server into files/31761/, change this to "/files/31761/".
COURSE_FILES = "/files/31761/"
ME = "P. Pinson"
TYPE_LABEL = {"article": "Journal article", "conference": "Conference paper", "preprint": "Preprint"}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z]", "", s)


def title_key(t):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower())


ARXIV_ID = re.compile(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}|[a-z\-]+(?:\.[A-Z]{2})?/\d{7})", re.I)


def pdf_links(pubs):
    """PDF link per paper: data/pdf_overrides.yml first, then data/pdf_links.yml, then any arXiv link."""
    def load(name):
        f = DATA / name
        return (yaml.safe_load(f.read_text(encoding="utf-8")) or {}) if f.exists() else {}
    overrides = {title_key(k): v for k, v in load("pdf_overrides.yml").items()}
    found = load("pdf_links.yml")
    out = {}
    for p in pubs:
        k = title_key(p["title"])
        if k in overrides:
            v = overrides[k]
            out[k] = "" if not v or str(v).lower() == "none" else str(v)
            continue
        hit = (found.get(k) or {}).get("pdf")
        if not hit:
            m = ARXIV_ID.search(p["preprint"] or "") or ARXIV_ID.search(p["url"] or "")
            hit = f"https://arxiv.org/pdf/{m.group(1)}" if m else ""
        out[k] = hit
    return out


def load_pubs():
    pubs = []
    for raw in (DATA / "publications.txt").read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.startswith("#"):
            continue
        f = raw.split("|")
        f += [""] * (8 - len(f))
        year, typ, title, authors, venue, url, preprint, themes = [x.strip() for x in f[:8]]
        if not preprint and "arxiv.org" in url:
            preprint = url
        pubs.append(dict(year=int(year), type=typ, title=title, authors=authors, venue=venue,
                         url=url, preprint=preprint,
                         themes=[t.strip() for t in themes.split(",") if t.strip()]))
    pubs.sort(key=lambda p: -p["year"])  # stable sort keeps file order within a year
    return pubs


def write_listing(pubs):
    pdfs = pdf_links(pubs)
    items = []
    for p in pubs:
        inpress = "in press" in p["venue"].lower()
        cats = [t.capitalize() for t in p["themes"]] + [TYPE_LABEL.get(p["type"], "Journal article")]
        items.append({
            "title": p["title"],
            "year": p["year"],
            "venue": p["venue"],
            "authors": p["authors"],
            "url": "" if "arxiv.org" in p["url"] else p["url"],
            "preprint": p["preprint"],
            "status": "In press" if inpress else ("Preprint" if p["type"] == "preprint" else ""),
            "categories": cats,
            "themes": " ".join(p["themes"]),
            "kind": p["type"],
            "pdf": pdfs.get(title_key(p["title"]), ""),
            "haspdf": "yes" if pdfs.get(title_key(p["title"])) else "no",
        })
    with open(ROOT / "publications.yml", "w", encoding="utf-8") as fh:
        yaml.safe_dump(items, fh, allow_unicode=True, sort_keys=False, width=1000)


def bib_author(a):
    a = a.strip()
    if " " not in a or "co-author" in a or a.endswith("al."):
        return "{" + a + "}"
    parts = a.split(" ")
    initials = [x for x in parts if x.endswith(".")]
    last = " ".join(x for x in parts if not x.endswith("."))
    return f"{last}, {' '.join(initials)}" if initials else a


def write_bib(pubs):
    out, seen = [], set()
    for p in pubs:
        first = p["authors"].split(",")[0].split(" ")[-1]
        word = slug(p["title"].split(" ")[0]).lower()
        key = f"{slug(first).lower()}{p['year']}{word}"
        while key in seen:
            key += "b"
        seen.add(key)
        names = [a for a in re.split(r",\s*(?=[A-Z])", p["authors"]) if a.strip() != "et al."]
        authors = " and ".join(bib_author(a) for a in names)
        etype = {"conference": "inproceedings", "preprint": "misc"}.get(p["type"], "article")
        venue_field = {"inproceedings": "booktitle", "misc": "note"}.get(etype, "journal")
        fields = [f"  title = {{{p['title']}}}", f"  author = {{{authors}}}",
                  f"  {venue_field} = {{{p['venue']}}}", f"  year = {{{p['year']}}}"]
        if p["url"]:
            fields.append(f"  url = {{{p['url']}}}")
        out.append(f"@{etype}{{{key},\n" + ",\n".join(fields) + "\n}\n")
    (ROOT / "files" / "pinson-publications.bib").write_text("\n".join(out), encoding="utf-8")


def video(yid):
    return f"{{{{< video https://www.youtube.com/embed/{yid} >}}}}"


OLD_SLUGS = {
    1: "module-1-fundamentals-of-electricity-markets",
    2: "module-2-electricity-spot-markets-e-g-day-ahead",
    3: "module-3-intra-day-and-balancing-markets",
    4: "module-4-ancillary-services",
    5: "module-5-impact-of-renewables-in-electricity-markets",
    6: "module-6-participation-of-renewables-in-electricity-markets",
    7: "module-7-introduction-to-renewable-energy-analytics",
    8: "module-8-verification-of-renewable-energy-forecasts",
    9: "module-9-renewable-energy-forecasting-first-steps",
    10: "module-10-renewable-energy-forecasting-advanced-topics",
}


def write_modules():
    from course_files import resolve
    found = resolve()[0]
    mods = [yaml.safe_load(p.read_text(encoding="utf-8")) for p in (DATA / "modules").glob("m*.yml")]
    mods.sort(key=lambda m: m["num"])
    for m in mods:
        n = m["num"]
        prev_link = f"[← Module {n-1}](module-{n-1:02d}.qmd)" if n > 1 else "[← Course overview](index.qmd)"
        next_link = f"[Module {n+1} →](module-{n+1:02d}.qmd)" if n < 10 else "[Exercises →](exercises.qmd)"
        L = ["---", f'title: "Module {n}: {m["title"]}"',
             f'subtitle: "Renewables in Electricity Markets · module {n} of 10"',
             "aliases:", f"  - /index.php/teaching/{OLD_SLUGS[n]}/index.html", "---", "",
             m["intro"], "", "This module covers:", ""]
        L += [f"- {t}" for t in m["topics"]] + [""]
        if m.get("interviews"):
            L += ["## Before you start", ""]
            for name, yid, blurb in m["interviews"]:
                L += [f"### Interview with {name}", "", blurb, "", video(yid), ""]
        L += ["## Lectures", ""]
        for i, (title, yid, pdf) in enumerate(m["lectures"]):
            L += [f"### {n}.{i} {title}", "", video(yid), "",
                  f"[Slides (PDF)]({COURSE_FILES}{found.get(pdf, 'Slides/' + pdf)}){{.slides-link}}", ""]
        L += ["::: {.module-nav}", prev_link, "", next_link, ":::", ""]
        (ROOT / "teaching" / f"module-{n:02d}.qmd").write_text("\n".join(L), encoding="utf-8")

    rows = ['::: {.module-list}']
    for m in mods:
        rows.append(f"[[{m['num']}]{{.mod-num}} [{m['title']}]{{.mod-title}} "
                    f"[{len(m['lectures'])} lectures]{{.mod-count}}](module-{m['num']:02d}.qmd)")
        rows.append("")
    rows.append(":::")
    (ROOT / "teaching" / "_modules.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


def write_interviews():
    iv = yaml.safe_load((DATA / "interviews.yml").read_text(encoding="utf-8"))
    L = ["---", 'title: "Interviews"',
         'subtitle: "Industry guests and former students on renewables, markets and careers"',
         "aliases:", "  - /index.php/teaching/additional-industry-interviews/index.html",
         "  - /index.php/teaching/interviews-with-former-students/index.html", "---", "",
         "Conversations recorded for the course, to motivate what it covers and show where it leads.", "",
         "## Industry guests", ""]
    for name, yid, blurb in iv["industry"]:
        L += [f"### {name}", ""] + ([blurb, ""] if blurb else []) + [video(yid), ""]
    L += ["## Former students", "",
          "Around 500 M.Sc. students took this course at DTU. Some of them shared how it "
          "helped at the start of their careers.", ""]
    for name, yid, _ in iv["students"]:
        L += [f"### {name}", "", video(yid), ""]
    (ROOT / "teaching" / "interviews.qmd").write_text("\n".join(L), encoding="utf-8")


def write_exercises():
    from course_files import resolve
    links = resolve()[0]
    sessions = ["Day-ahead electricity markets: basics", "Day-ahead electricity markets: advanced",
                "Intra-day and balancing markets", "Ancillary service markets",
                "Market participation for renewables", "Verification of renewable energy forecasts"]
    L = ["---", 'title: "Exercises"', 'subtitle: "Six sessions, with solutions"',
         "aliases:", "  - /index.php/teaching/exercises/index.html", "---", "",
         "Six exercise sessions let you apply the concepts from the lectures. Each takes 2 to 3 hours.", "",
         "| Session | Exercise | Solution |", "|:--|:--|:--|"]
    for i, s in enumerate(sessions, 1):
        ex = links.get(f"ex{i}", f"Exercises/31761-exsession{i}.pdf")
        sol = links.get(f"sol{i}", f"Exercises/31761-exsession{i}_solution.pdf")
        cell = f"[PDF]({COURSE_FILES}{sol})"
        for sh in links.get(f"sheet{i}", []):
            label = "data (CSV)" if sh.lower().endswith(".csv") else "spreadsheet"
            cell += f", [{label}]({COURSE_FILES}{sh})"
        L.append(f"| {i} | [{s}]({COURSE_FILES}{ex}) | {cell} |")
    (ROOT / "teaching" / "exercises.qmd").write_text("\n".join(L) + "\n", encoding="utf-8")


# Papers on data, forecast and model markets get the "datamarkets" theme automatically.
# You can also add the theme by hand in publications.txt.
DATA_MARKET_TERMS = ["data market", "analytics market", "regression market", "wagering", "trading forecasts",
                     "prediction markets", "model trading", "data pricing", "data acquisition", "monetizing",
                     "purchase labels", "collaborative forecasting", "sharing wind power forecasts", "trading data"]


def tag_data_markets(pubs):
    for p in pubs:
        if any(t in p["title"].lower() for t in DATA_MARKET_TERMS) and "datamarkets" not in p["themes"]:
            p["themes"].append("datamarkets")


SVG = '<svg viewBox="0 0 160 96" aria-hidden="true" focusable="false">{}</svg>'
ILLUSTRATIONS = {
    "edelman": (
        '<path class="il-grid" d="M12 30h136M12 50h136"/>'
        '<path class="il-acc il-draw" pathLength="1" d="M14 58 C30 52 40 56 52 46 S74 40 86 44 S110 26 122 28 S140 18 148 14"/>'
        '<circle class="il-dot" cx="148" cy="14" r="3.5"/>'
        '<path class="il-fill" d="M40 66 h76 l-9 11 h-58 z"/>'
        '<path class="il-line" d="M58 66 v-8 h36 v8 M66 58 v-5 h18 v5"/>'
        '<path class="il-line il-wave" d="M10 84 q8 -5 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0"/>'),
    "forecasting": (
        '<path class="il-fill o1" d="M70 52 C96 30 124 22 150 16 L150 88 C124 82 96 74 70 52Z"/>'
        '<path class="il-fill o2" d="M70 52 C96 40 124 36 150 33 L150 72 C124 68 96 62 70 52Z"/>'
        '<path class="il-fill o3" d="M70 52 C96 47 124 47 150 47 L150 58 C124 57 96 55 70 52Z"/>'
        '<path class="il-line il-thick" d="M10 60 C22 54 30 62 42 56 S60 50 70 52"/>'
        '<path class="il-acc" stroke-dasharray="4 4" d="M70 52 C96 51 124 52 150 53"/>'
        '<path class="il-grid" d="M70 10 v80"/><circle class="il-dot" cx="70" cy="52" r="3.5"/>'),
    "markets": (
        '<path class="il-grid" d="M20 10 v76 h130"/>'
        '<path class="il-acc il-thick" d="M20 80 h24 v-8 h22 v-10 h20 v-14 h18 v-18 h22 v-22"/>'
        '<path class="il-line il-thick" d="M30 14 C60 34 90 52 146 76"/>'
        '<path class="il-grid" stroke-dasharray="3 4" d="M20 48 h83 v38"/>'
        '<circle class="il-dot pulse" cx="103" cy="48" r="4"/>'),
    "datamarkets": (
        '<path class="il-line" d="M80 48 L30 22 M80 48 L30 74 M80 48 L130 22 M80 48 L130 74 M80 48 L80 12"/>'
        '<path class="il-acc il-flow" d="M80 48 L30 22 M80 48 L130 74 M80 48 L130 22"/>'
        '<circle class="il-node" cx="30" cy="22" r="7"/><circle class="il-node" cx="30" cy="74" r="7"/>'
        '<circle class="il-node" cx="130" cy="22" r="7"/><circle class="il-node" cx="130" cy="74" r="7"/>'
        '<circle class="il-node" cx="80" cy="12" r="6"/>'
        '<circle class="il-hub" cx="80" cy="48" r="12"/>'
        '<path class="il-hubmark" d="M74 52 v-4 M78 52 v-8 M82 52 v-6 M86 52 v-10"/>'),
    "ijf": (
        '<rect class="il-line" x="58" y="14" width="56" height="72" rx="3"/>'
        '<rect class="il-line" x="50" y="10" width="56" height="72" rx="3"/>'
        '<rect class="il-cover" x="42" y="6" width="56" height="72" rx="3"/>'
        '<path class="il-acc" d="M50 56 C58 50 64 54 70 46 S84 36 90 30"/>'
        '<path class="il-grid" d="M50 66 h40 M50 71 h26"/>'
        '<text class="il-text" x="50" y="24">IJF</text>'),
    "orsted": (
        '<rect class="il-line" x="26" y="8" width="108" height="56" rx="3"/>'
        '<path class="il-fill o1" d="M70 40 C90 26 110 20 126 16 L126 60 C110 58 90 52 70 40Z"/>'
        '<path class="il-fill o2" d="M70 40 C90 34 110 32 126 31 L126 49 C110 48 90 45 70 40Z"/>'
        '<path class="il-line" d="M34 44 C44 40 52 46 60 40 S66 38 70 40"/>'
        '<text class="il-q" x="96" y="44">?</text>'
        '<path class="il-line" d="M80 64 v8 M62 88 l6 -16 h24 l6 16 z"/>'),
}


def write_highlights(pubs):
    n = lambda key: sum(key in p["themes"] for p in pubs)
    cards = [
        ("edelman", "2024 · Award", "INFORMS Franz Edelman Award",
         "Led the team, with Halfspace, that put forecasting and revenue management into daily operation at Molslinjen.",
         "news/posts/2024-edelman/index.html", "Read the story"),
        ("forecasting", f"Research · {n('forecasting')} papers", "Probabilistic energy forecasting",
         "From early work on wind power to methods for wind, solar, wave, load and market quantities, and how to verify them.",
         "research/forecasting.html", "Explore the work"),
        ("markets", f"Research · {n('markets')} papers", "Energy markets",
         "Trading strategies for renewables, and market design and clearing under uncertainty, from coordinated to peer-to-peer markets.",
         "research/markets.html", "Explore the work"),
        ("datamarkets", f"Research · {n('datamarkets')} papers", "Data and analytics markets",
         "Mechanisms to value, share and trade data, forecasts and models.",
         "research/data-markets.html", "Explore the work"),
        ("ijf", "2019 – 2026 · Editorial", "Editor-in-Chief, International Journal of Forecasting",
         "Seven years leading the flagship journal of the International Institute of Forecasters.",
         "ijf.html", "About the journal"),
         ("orsted", "2026 · Lecture", "DTU Ørsted Lecture",
         "“Can we predict the future of forecasting?”, the yearly public lecture at the Technical University of Denmark.",
         "https://www.youtube.com/watch?v=tOe7jf_pcB8", "Watch the lecture"),
    ]
    out = []
    for key, kicker, title, text, href, cta in cards:
        out.append(f'<a class="hl-card" href="{href}"><div class="hl-art">{SVG.format(ILLUSTRATIONS[key])}</div>'
                   f'<div class="hl-body"><span class="hl-kicker">{kicker}</span><h3>{title}</h3><p>{text}</p>'
                   f'<span class="hl-cta">{cta}<span aria-hidden="true"> →</span></span></div></a>')
    block = ('```{=html}\n<section class="highlights" aria-labelledby="hl-title"><h2 id="hl-title">Highlights</h2>'
             '<div class="hl-grid">' + "".join(out) + "</div></section>\n```\n")
    (ROOT / "_highlights.md").write_text(block, encoding="utf-8")


KEY_PAPERS = {
    "forecasting": [
        "Nonparametric probabilistic forecasts of wind power: required properties",
        "From probabilistic forecasts to statistical scenarios",
        "Conditional prediction intervals of wind power generation",
        "Very short-term probabilistic forecasting of wind power with generalized logit",
        "Wind energy: Forecasting challenges",
        "Probabilistic forecasts of wind power generation accounting for geographically",
        "Probabilistic energy forecasting: Global Energy Forecasting Competition 2014",
        "Online distributed learning in wind power forecasting",
        "Value-oriented forecast reconciliation",
    ],
    "markets": [
        "Trading wind generation with short-term probabilistic forecasts",
        "Pool strategy of a price-maker wind power producer",
        "Distributionally robust trading strategies",
        "Electricity market clearing with improved dispatch of stochastic producers",
        "Stochastic market design with revenue adequacy",
        "An integrated market for electricity and natural gas systems",
        "Peer-to-peer and community-driven markets",
        "Energy Collectives",
        "What may future electricity markets look like",
    ],
    "data-markets": [
        "Towards data markets in renewable energy forecasting",
        "A critical overview of privacy-preserving approaches",
        "Regression markets and application to energy forecasting",
        "Bayesian regression markets",
        "A market for trading forecasts: A wagering mechanism",
        "Towards replication-robust analytics markets",
        "Prediction markets with intermittent contributions",
    ],
}


def write_key_papers(pubs):
    pdfs = pdf_links(pubs)
    (ROOT / "research").mkdir(exist_ok=True)
    for topic, prefixes in KEY_PAPERS.items():
        lines = ['::: {.key-papers}']
        for pre in prefixes:
            hit = next((p for p in pubs if p["title"].lower().startswith(pre.lower())), None)
            if not hit:
                print(f"  key paper not found, skipped: {pre}")
                continue
            link = pdfs.get(title_key(hit["title"])) or hit["url"] or hit["preprint"]
            title = f"[{hit['title']}]({link})" if link else hit["title"]
            authors = hit["authors"].replace(ME, f"**{ME}**")
            lines.append(f"- {title}  \n  [{authors} · *{hit['venue']}* · {hit['year']}]{{.kp-meta}}")
        lines.append(":::")
        (ROOT / "research" / f"_papers-{topic}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    pubs = load_pubs()
    tag_data_markets(pubs)
    write_listing(pubs)
    write_bib(pubs)
    write_modules()
    write_interviews()
    write_exercises()
    write_highlights(pubs)
    write_key_papers(pubs)
    print(f"{len(pubs)} publications; course pages written.")
