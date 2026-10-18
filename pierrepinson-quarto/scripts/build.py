"""Generate publication data and course pages from the plain-text sources in data/.

Run from the project root before `quarto render`:  python scripts/build.py
Requires PyYAML (pip install pyyaml).
"""
import re
import unicodedata
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
# Where lecture slides and exercise PDFs live. Once you copy the old /31761 folder
# from the WordPress server into files/31761/, change this to "/files/31761/".
COURSE_FILES = "https://pierrepinson.com/31761/"
ME = "P. Pinson"
TYPE_LABEL = {"article": "Journal article", "conference": "Conference paper", "preprint": "Preprint"}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z]", "", s)


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
                  f"[Slides (PDF)]({COURSE_FILES}Slides/{pdf}){{.slides-link}}", ""]
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
    sessions = ["Day-ahead electricity markets: basics", "Day-ahead electricity markets: advanced",
                "Intra-day and balancing markets", "Ancillary service markets",
                "Market participation for renewables", "Verification of renewable energy forecasts"]
    extra = {1: "31761-exsession1_solution.xlsx", 6: "31761-exsession6_solution.xlsx"}
    L = ["---", 'title: "Exercises"', 'subtitle: "Six sessions, with solutions"',
         "aliases:", "  - /index.php/teaching/exercises/index.html", "---", "",
         "Six exercise sessions let you apply the concepts from the lectures. Each takes 2 to 3 hours.", "",
         "| Session | Exercise | Solution |", "|:--|:--|:--|"]
    for i, s in enumerate(sessions, 1):
        base = f"{COURSE_FILES}Exercises/31761-exsession{i}"
        sol = f"[PDF]({base}_solution.pdf)"
        if i in extra:
            sol += f", [spreadsheet]({COURSE_FILES}Exercises/{extra[i]})"
        L.append(f"| {i} | [{s}]({base}.pdf) | {sol} |")
    (ROOT / "teaching" / "exercises.qmd").write_text("\n".join(L) + "\n", encoding="utf-8")


if __name__ == "__main__":
    pubs = load_pubs()
    write_listing(pubs)
    write_bib(pubs)
    write_modules()
    write_interviews()
    write_exercises()
    print(f"{len(pubs)} publications; course pages written.")
