"""Keep only the course files the site links to, in files/31761/.

Usage (from the project root):
  python scripts/prune_course_files.py           # dry run: lists what would be kept, moved and is missing
  python scripts/prune_course_files.py --apply   # moves unused files to ../31761-unused/ (nothing is deleted)

Check the moved folder, then delete it yourself when you are happy.
"""
import shutil
import sys

from course_files import COURSE, ROOT, resolve

UNUSED = ROOT.parent / "31761-unused"

if not COURSE.is_dir():
    sys.exit(f"Folder not found: {COURSE}. Put the 31761 folder inside files/ first.")

links, keep, notes, files = resolve()
unused = [p for p in files if p not in keep]
mb = lambda ps: sum(p.stat().st_size for p in ps) / 1e6
rel = lambda p: p.relative_to(COURSE).as_posix()

print(f"Keep:   {len(keep)} files ({mb(keep):.1f} MB)")
for n in range(1, 7):
    parts = [links.get(f"ex{n}"), links.get(f"sol{n}")] + links.get(f"sheet{n}", [])
    print(f"   session {n}: " + ", ".join(p for p in parts if p))
print(f"Unused: {len(unused)} files ({mb(unused):.1f} MB)")
for p in unused:
    print("   -", rel(p))
if notes:
    print("Check:")
    for n in notes:
        print("   !", n)

if "--apply" in sys.argv and unused:
    for p in unused:
        dest = UNUSED / rel(p)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(p), dest)
    for d in sorted((d for d in COURSE.rglob("*") if d.is_dir()), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    print(f"\nMoved {len(unused)} files to {UNUSED}")
elif unused:
    print("\nDry run only. Re-run with --apply to move the unused files out of the site.")
