import type { AstroIntegration } from "astro";

function injectMotionScript(): string {
	return `
(function () {
  function reveal(el) {
    el.classList.add("is-visible");
  }

  function setup() {
    var nodes = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(reveal);
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              reveal(entry.target);
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
      );

      nodes.forEach(function (el, i) {
        if (!el.dataset.revealDelay) {
          el.dataset.revealDelay = String(Math.min(6, (i % 6) + 1));
        }
        // Show anything already at or above the fold immediately so fast
        // scrolls and anchor jumps never leave a section stuck invisible.
        if (el.getBoundingClientRect().top < window.innerHeight) {
          reveal(el);
        } else {
          revealObserver.observe(el);
        }
      });

      // Safety net: never let content stay hidden if the observer misses it.
      window.setTimeout(function () {
        nodes.forEach(reveal);
      }, 1500);
    }

    // Only one progress bar, even if setup runs more than once.
    if (document.querySelector(".scroll-progress")) return;
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
