"""List publications that exist in OpenAlex but are missing from data/publications.txt.

Run from the project root (needs an internet connection):

  python scripts/find_missing.py --key YOUR_OPENALEX_KEY
  python scripts/find_missing.py --key YOUR_OPENALEX_KEY --since 2015   # only recent years

OpenAlex requires a free API key (since February 2026): create an account at https://openalex.org,
then copy the key from https://openalex.org/settings/api. You can also store it once with
  export OPENALEX_API_KEY=YOUR_OPENALEX_KEY
in your terminal (or in ~/.zshrc), and then leave out --key.

It finds your OpenAlex author profile (or use --author A1234567890 if it picks the wrong one),
downloads all your works, and compares their titles with publications.txt. Candidates are written to
data/missing_candidates.txt, already in the publications.txt format. Check each line (OpenAlex sometimes
mixes up authors or lists the same paper twice), add the themes at the end, and paste the ones you want
at the top of publications.txt. Nothing is added to the site automatically.
"""
import argparse
import os
import difflib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import DATA, load_pubs  # noqa: E402

OUT = DATA / "missing_candidates.txt"
API = "https://api.openalex.org"


KEY = ""


def get(url):
    if KEY:
        url += ("&" if "?" in url else "?") + "api_key=" + urllib.parse.quote(KEY)
    for k in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "pierrepinson.com-missing-finder/1.1"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 402, 403, 409):
                sys.exit("OpenAlex refused the request (HTTP %d). " % e.code + (
                    "Your API key was not accepted: check it at https://openalex.org/settings/api." if KEY else
                    "It needs a free API key: get one at https://openalex.org/settings/api, then run with --key YOUR_KEY."))
            if k == 2:
                sys.exit(f"OpenAlex error ({e}).")
            time.sleep(5)
        except Exception as e:
            if k == 2:
                sys.exit(f"Could not reach OpenAlex ({e}). Check your internet connection.")
            time.sleep(3)


def words(t):
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).split())


def known(title, existing):
    w = words(title)
    return any(difflib.SequenceMatcher(None, w, e).ratio() >= 0.88 for e in existing)


def initials(name):
    parts = name.replace(".", ". ").split()
    if len(parts) < 2:
        return name
    first = "".join(p[0] + "." for p in parts[:-1] if p[0].isalpha())
    return f"{first} {parts[-1]}"


def pick_author():
    data = get(f"{API}/authors?search=Pierre%20Pinson&per-page=10")
    cands = [a for a in data.get("results", []) if "pinson" in a.get("display_name", "").lower()]
    if not cands:
        sys.exit("No OpenAlex author found. Use --author with your OpenAlex ID.")
    best = max(cands, key=lambda a: a.get("works_count", 0))
    print(f"Using OpenAlex author {best['id'].split('/')[-1]}: {best['display_name']}, "
          f"{best.get('works_count')} works. If that's wrong, rerun with --author <ID>.")
    return best["id"].split("/")[-1]


def venue_of(w):
    loc = w.get("primary_location") or {}
    src = (loc.get("source") or {}).get("display_name") or ""
    b = w.get("biblio") or {}
    v = src
    if b.get("volume"):
        v += f" {b['volume']}" + (f"({b['issue']})" if b.get("issue") else "")
    if b.get("first_page") and b.get("last_page") and b["first_page"] != b["last_page"]:
        v += f", pp. {b['first_page']}-{b['last_page']}"
    elif b.get("first_page"):
        v += f", art. no. {b['first_page']}"
    return v.strip() or "Unknown venue"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("OPENALEX_API_KEY", ""), help="your free OpenAlex API key")
    ap.add_argument("--email", default="", help=argparse.SUPPRESS)  # no longer used by OpenAlex
    ap.add_argument("--author", help="OpenAlex author ID, e.g. A5012345678")
    ap.add_argument("--orcid", default="0000-0002-1480-0282", help="your ORCID (default: Pierre Pinson's)")
    ap.add_argument("--since", type=int, default=0, help="only list works from this year on")
    args = ap.parse_args()
    global KEY
    KEY = args.key.strip()
    if not KEY:
        print("No OpenAlex API key given; OpenAlex will probably refuse after the first page. "
              "Get a free key at https://openalex.org/settings/api and use --key.")

    author = args.author
    if not author and args.orcid:
        a = get(f"{API}/authors/orcid:{args.orcid}")
        if a and a.get("id"):
            author = a["id"].split("/")[-1]
            print(f"Using OpenAlex author {author} ({a.get('display_name')}, {a.get('works_count')} works), from ORCID {args.orcid}.")
    author = author or pick_author()
    existing = [words(p["title"]) for p in load_pubs()]
    works, page = [], 1
    while True:  # page= paging (not cursor=), which OpenAlex allows up to 10,000 results
        data = get(f"{API}/works?filter=author.id:{author}&per-page=200&page={page}")
        batch = data.get("results", [])
        works += batch
        if not batch or len(works) >= data.get("meta", {}).get("count", 0):
            break
        page += 1
        time.sleep(0.3)
    print(f"{len(works)} works in OpenAlex.")

    seen, out = [], []
    for w in sorted(works, key=lambda w: -(w.get("publication_year") or 0)):
        title = (w.get("title") or "").strip()
        year = w.get("publication_year") or 0
        if not title or year < args.since or w.get("type") in ("paratext", "erratum", "retraction", "peer-review"):
            continue
        if known(title, existing) or known(title, seen):
            continue
        seen.append(words(title))
        src = ((w.get("primary_location") or {}).get("source") or {})
        is_preprint = w.get("type") == "preprint" or "arxiv" in (src.get("display_name") or "").lower()
        kind = "preprint" if is_preprint else ("conference" if src.get("type") == "conference" else "article")
        authors = ", ".join(initials(a.get("author", {}).get("display_name", "")) for a in w.get("authorships", []))
        doi = w.get("doi") or ""
        arxiv = next((l.get("landing_page_url") for l in (w.get("locations") or [])
                      if "arxiv.org" in (l.get("landing_page_url") or "")), "")
        venue = "Preprint" if is_preprint else venue_of(w)
        out.append(f"{year}|{kind}|{title}|{authors}|{venue}|{doi}|{arxiv}|")

    header = ["# Candidates found in OpenAlex but not in publications.txt.",
              "# Check each one, add themes after the last | (forecasting, markets, optimisation, energy, analytics),",
              "# then copy the lines you want to the top of publications.txt and run python scripts/build.py.", ""]
    OUT.write_text("\n".join(header + out) + "\n", encoding="utf-8")
    print(f"{len(out)} candidates written to {OUT.relative_to(DATA.parent)}.")


if __name__ == "__main__":
    main()
