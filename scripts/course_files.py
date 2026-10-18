"""Find the course files the site links to inside files/31761/, wherever they sit."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSE = ROOT / "files" / "31761"
SHEETS = (".xlsx", ".xls", ".xlsm", ".csv")


def _files():
    if not COURSE.is_dir():
        return []
    return sorted(p for p in COURSE.rglob("*") if p.is_file() and not p.name.startswith("."))


def resolve():
    """Return (links, keep, notes). links maps keys to paths relative to files/31761/."""
    files = _files()
    rel = lambda p: p.relative_to(COURSE).as_posix()
    links, keep, notes = {}, set(), []

    # Slides: matched by file name anywhere in the folder.
    by_name = {}
    for p in files:
        by_name.setdefault(p.name.lower(), p)
    for f in (ROOT / "data" / "modules").glob("m*.yml"):
        for pdf in re.findall(r"31761lecture\d+p\d+\.pdf", f.read_text(encoding="utf-8")):
            p = by_name.get(pdf.lower())
            if p:
                links[pdf] = rel(p); keep.add(p)
            else:
                notes.append(f"missing slide {pdf}")

    # Exercises: files in an ExSessionN folder, or named like ...exsessionN...
    for n in range(1, 7):
        tag = re.compile(rf"exsession0?{n}(?!\d)", re.I)
        cand = [p for p in files
                if any(tag.fullmatch(part) for part in p.relative_to(COURSE).parts[:-1]) or tag.search(p.name)]
        pdfs = [p for p in cand if p.suffix.lower() == ".pdf"]
        sols = [p for p in pdfs if "sol" in p.name.lower()]
        exs = [p for p in pdfs if p not in sols]
        sheets = [p for p in cand if p.suffix.lower() in SHEETS]
        for key, group in (("ex", exs), ("sol", sols)):
            if not group:
                notes.append(f"session {n}: no {'solution' if key == 'sol' else 'exercise'} PDF found")
                continue
            group.sort(key=lambda p: (0 if tag.search(p.name) else 1, len(p.name)))
            if len(group) > 1:
                notes.append(f"session {n}: several {key} PDFs, using {group[0].name} "
                             f"(others: {', '.join(p.name for p in group[1:])})")
            links[f"{key}{n}"] = rel(group[0]); keep.add(group[0])
        if sheets:
            links[f"sheet{n}"] = [rel(p) for p in sheets]; keep.update(sheets)
    return links, keep, notes, files
