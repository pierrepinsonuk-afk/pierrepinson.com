# pierrepinson.com (Quarto)

## Run it locally

1. Install [Quarto](https://quarto.org/docs/get-started/) and Python 3 with PyYAML (`pip install pyyaml`).
2. In this folder, run `quarto preview`. The site opens in your browser and reloads as you edit.

`scripts/build.py` runs automatically before each render. It turns the plain-text files in `data/`
into the publication list, the BibTeX file and the course pages.

## Everyday edits

| To change… | Edit |
|---|---|
| Publications | `data/publications.txt` (one paper per line, newest at the top) |
| A course module | `data/modules/mNN.yml` |
| Interviews | `data/interviews.yml` |
| Home page, About, IJF | `index.qmd`, `about.qmd`, `ijf.qmd` |
| News | add a folder in `news/posts/` with an `index.qmd` |
| Colours and fonts | `scss/dark.scss`, `scss/light.scss`, `scss/common.scss` |

Do not edit `publications.yml`, `files/pinson-publications.bib` or `teaching/module-*.qmd` by hand:
they are regenerated on every render.

## Before going live

- Add `images/portrait.jpg` (used on the About page).
- Copy the `31761/` folder (slides and exercises) from the WordPress server into `files/31761/`,
  then set `COURSE_FILES = "/files/31761/"` in `scripts/build.py`.
- Add an up-to-date CV as `files/cv.pdf` and point the CV links in `_quarto.yml` and `about.qmd` to it.

## Publish on GitHub Pages

1. Create a GitHub repository and push this folder to the `main` branch.
2. Run `quarto publish gh-pages` once from your computer. After that, the workflow in
   `.github/workflows/publish.yml` republishes on every push.
3. In the repository settings, under Pages, set the custom domain to `pierrepinson.com`, then point
   your domain's DNS to GitHub Pages.

Old WordPress addresses (for example `/index.php/pubs/`) redirect to their new pages automatically.
