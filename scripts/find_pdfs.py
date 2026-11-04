"""Find freely available PDFs for the publications in data/publications.txt.

Run from the project root (needs an internet connection; uses only the Python standard library + PyYAML):

  python scripts/find_pdfs.py --key YOUR_OPENALEX_KEY --email you@example.com   # papers not checked before
  python scripts/find_pdfs.py --email ... --retry-missing   # look again for papers with no PDF yet
  python scripts/find_pdfs.py --email ... --refresh         # redo everything
  python scripts/find_pdfs.py --email ... --check           # also test that each link really returns a PDF

OpenAlex needs a free API key (since February 2026): get one at https://openalex.org/settings/api, or set
OPENALEX_API_KEY in your terminal once. The email is only sent to Unpaywall, which asks for it.

Sources, in order: arXiv links already in your data, OpenAlex, Unpaywall, an arXiv title search,
Semantic Scholar. A paper only counts as a match if the title is near-identical and Pinson is an author.

Results go to data/pdf_links.yml (generated; safe to delete) and a summary to data/pdf_report.txt.
To fix a link by hand, or to block a wrong one, edit data/pdf_overrides.yml: it always wins.
"""
import argparse
import os
import datetime
import difflib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import DATA, load_pubs, title_key  # noqa: E402

CACHE = DATA / "pdf_links.yml"
REPORT = DATA / "pdf_report.txt"
UA = "pierrepinson.com-pdf-finder/1.1"
KEY = ""


def words(t):
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).split())


def same_title(a, b):
    return difflib.SequenceMatcher(None, words(a), words(b)).ratio() >= 0.9


def get(url, as_json=True, tries=3):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                body = r.read()
            return json.loads(body) if as_json else body.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and k < tries - 1:
                time.sleep(5 * (k + 1))
                continue
            return None
        except Exception:
            if k < tries - 1:
                time.sleep(2)
                continue
            return None


ARXIV_RE = re.compile(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}|[a-z\-]+(?:\.[A-Z]{2})?/\d{7})", re.I)


def from_data(p):
    for u in (p["preprint"], p["url"]):
        m = ARXIV_RE.search(u or "")
        if m:
            return f"https://arxiv.org/pdf/{m.group(1)}"
    return None


def openalex(p, email):
    if not KEY:
        return None, None
    q = urllib.parse.quote(words(p["title"]))
    url = f"https://api.openalex.org/works?search={q}&per-page=8&api_key={urllib.parse.quote(KEY)}"
    data = get(url)
    for w in (data or {}).get("results", []):
        if not same_title(w.get("title"), p["title"]):
            continue
        names = " ".join(a.get("author", {}).get("display_name", "") for a in w.get("authorships", []))
        if "pinson" not in names.lower():
            continue
        doi = (w.get("doi") or "").replace("https://doi.org/", "") or None
        for loc in [w.get("best_oa_location")] + (w.get("locations") or []):
            if loc and loc.get("pdf_url"):
                return loc["pdf_url"], doi
        return None, doi
    return None, None


def unpaywall(doi, email):
    if not (doi and email):
        return None
    data = get(f"https://api.unpaywall.org/v2/{urllib.parse.quote(doi)}?email={urllib.parse.quote(email)}")
    for loc in [(data or {}).get("best_oa_location")] + ((data or {}).get("oa_locations") or []):
        if loc and loc.get("url_for_pdf"):
            return loc["url_for_pdf"]
    return None


def arxiv_search(p):
    t = words(p["title"])
    q = urllib.parse.quote(f'ti:"{t}" AND au:Pinson')
    xml = get(f"https://export.arxiv.org/api/query?search_query={q}&max_results=5", as_json=False)
    time.sleep(3)  # arXiv asks for one request every 3 seconds
    if not xml:
        return None
    ns = {"a": "http://www.w3.org/2005/Atom"}
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return None
    for e in root.findall("a:entry", ns):
        if same_title(e.findtext("a:title", "", ns), p["title"]):
            m = ARXIV_RE.search(e.findtext("a:id", "", ns))
            if m:
                return f"https://arxiv.org/pdf/{m.group(1)}"
    return None


def semantic_scholar(p):
    q = urllib.parse.quote(p["title"])
    data = get(f"https://api.semanticscholar.org/graph/v1/paper/search/match?query={q}"
               "&fields=title,authors,openAccessPdf")
    time.sleep(1.1)
    for w in (data or {}).get("data", []):
        names = " ".join(a.get("name", "") for a in w.get("authors", []))
        if same_title(w.get("title"), p["title"]) and "pinson" in names.lower():
            return ((w.get("openAccessPdf") or {}).get("url")) or None
    return None


def looks_like_pdf(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-1023"})
        with urllib.request.urlopen(req, timeout=25) as r:
            head = r.read(1024)
            return head.startswith(b"%PDF") or "pdf" in r.headers.get("Content-Type", "").lower()
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", default="", help="your email, passed to Unpaywall")
    ap.add_argument("--key", default=os.environ.get("OPENALEX_API_KEY", ""), help="your free OpenAlex API key")
    ap.add_argument("--refresh", action="store_true", help="look up every paper again")
    ap.add_argument("--retry-missing", action="store_true", help="look again for papers without a PDF")
    ap.add_argument("--check", action="store_true", help="download the first bytes of each link to verify it")
    args = ap.parse_args()
    global KEY
    KEY = args.key.strip()
    if not KEY:
        print("No OpenAlex API key: skipping OpenAlex (the best source). Get a free key at "
              "https://openalex.org/settings/api and use --key.")

    cache = yaml.safe_load(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    cache = cache or {}
    pubs = load_pubs()
    today = datetime.date.today().isoformat()
    todo = [p for p in pubs if args.refresh or title_key(p["title"]) not in cache
            or (args.retry_missing and not cache[title_key(p["title"])].get("pdf"))]
    print(f"{len(pubs)} papers, {len(todo)} to look up.")

    for i, p in enumerate(todo, 1):
        pdf, source, doi = from_data(p), "arxiv (from your data)", None
        if not pdf:
            pdf, doi = openalex(p, args.email)
            source = "openalex"
        if not pdf and doi:
            pdf, source = unpaywall(doi, args.email), "unpaywall"
        if not pdf:
            pdf, source = arxiv_search(p), "arxiv search"
        if not pdf:
            pdf, source = semantic_scholar(p), "semantic scholar"
        entry = {"title": p["title"], "year": p["year"], "pdf": pdf, "source": source if pdf else None,
                 "doi": doi, "checked": today}
        if pdf and args.check:
            entry["verified"] = looks_like_pdf(pdf)
        cache[title_key(p["title"])] = entry
        print(f"[{i}/{len(todo)}] {'PDF ' if pdf else '--- '} {p['year']} {p['title'][:70]}")
        if i % 10 == 0:  # save as we go, so an interruption loses little
            CACHE.write_text(yaml.safe_dump(cache, allow_unicode=True, sort_keys=True, width=1000), encoding="utf-8")
        time.sleep(0.2)

    CACHE.write_text(yaml.safe_dump(cache, allow_unicode=True, sort_keys=True, width=1000), encoding="utf-8")

    keys = {title_key(p["title"]) for p in pubs}
    found = [v for k, v in cache.items() if k in keys and v.get("pdf")]
    missing = sorted((v for k, v in cache.items() if k in keys and not v.get("pdf")), key=lambda v: -v["year"])
    bad = [v for v in found if v.get("verified") is False]
    lines = [f"PDF found for {len(found)} of {len(pubs)} papers.", ""]
    if bad:
        lines += [f"{len(bad)} links could not be confirmed as PDFs (often just a publisher blocking scripts;"
                  " open them in a browser and block any wrong ones in data/pdf_overrides.yml):"]
        lines += [f"  {v['year']}  {v['title']}\n        {v['pdf']}" for v in bad] + [""]
    lines += [f"No free PDF found for {len(missing)} papers:"]
    lines += [f"  {v['year']}  {v['title']}" for v in missing]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n" + lines[0] + f" Details in {REPORT.relative_to(DATA.parent)}.")
    print("Now run `quarto preview` to see the links on the site.")


if __name__ == "__main__":
    main()
