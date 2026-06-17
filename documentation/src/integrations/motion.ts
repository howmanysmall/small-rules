import type { AstroIntegration } from "astro";

function injectMotionScript(): string {
	return `
(function () {
  function setup() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    document.querySelectorAll(".reveal").forEach(function (el, i) {
      if (!el.dataset.revealDelay) {
        el.dataset.revealDelay = String(Math.min(6, (i % 6) + 1));
      }
      revealObserver.observe(el);
    });

    var progress = document.createElement("div");
    progress.className = "scroll-progress";
    document.body.appendChild(progress);

    function updateProgress() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progress.style.setProperty("--progress", percent + "%");
    }

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    updateProgress();
  }

  document.addEventListener("astro:page-load", setup);
  document.addEventListener("DOMContentLoaded", setup);
})();
`;
}

export default function motion(): AstroIntegration {
	return {
		hooks: {
			"astro:config:setup": ({ injectScript }): void => {
				injectScript("page", injectMotionScript());
			},
		},
		name: "motion",
	};
}
