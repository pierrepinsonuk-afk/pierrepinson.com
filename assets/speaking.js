/* Audience filter for the talks on the Speaking page. */
(function () {
  const chips = document.querySelectorAll(".sp-filter .chip");
  const talks = document.querySelectorAll(".sp-talk");
  const empty = document.querySelector(".sp-empty");
  if (!chips.length) return;
  chips.forEach((c) => c.addEventListener("click", () => {
    const aud = c.dataset.aud;
    chips.forEach((x) => x.setAttribute("aria-pressed", x === c ? "true" : "false"));
    let shown = 0;
    talks.forEach((t) => {
      const ok = aud === "all" || t.dataset.aud.split(" ").includes(aud);
      t.classList.toggle("dim", !ok);
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  }));
})();

/* Click-to-play YouTube thumbnails: load the player only when asked. */
document.querySelectorAll(".sp-thumb").forEach((b) => b.addEventListener("click", () => {
  const f = document.createElement("iframe");
  f.src = "https://www.youtube-nocookie.com/embed/" + b.dataset.yt + "?autoplay=1";
  f.title = b.getAttribute("aria-label"); f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
  b.replaceWith(f);
}));
