import type { AstroIntegration } from "astro";

const BASE_URL = "/small-rules/";

function injectContextualMenuScript(): string {
	return `
(function () {
  function addContextualMenu() {
    var target = document.querySelector("main .sl-markdown-content h1, main h1");
    if (!target) return;
    var h1 = target;
    if (h1.dataset.contextualMenu === "true") return;

    h1.dataset.contextualMenu = "true";

    var container = document.createElement("span");
    container.className = "contextual-menu";
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "Page actions");

    var copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "contextual-menu__button";
    copyButton.setAttribute("title", "Copy page markdown");
    copyButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy page</span>';
    copyButton.addEventListener("click", function () {
      var url = window.location.pathname;
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      var markdownUrl = "${BASE_URL}" + "index.md" + url.replace(/^\\/small-rules/, "");
      fetch(markdownUrl)
        .then(function (res) {
          if (!res.ok) throw new Error("Failed to fetch page markdown");
          return res.text();
        })
        .then(function (text) {
          return navigator.clipboard.writeText(text);
        })
        .then(function () {
          copyButton.setAttribute("title", "Copied!");
          copyButton.querySelector("span").textContent = "Copied!";
          window.setTimeout(function () {
            copyButton.setAttribute("title", "Copy page markdown");
            copyButton.querySelector("span").textContent = "Copy page";
          }, 2000);
        })
        .catch(function () {
          copyButton.querySelector("span").textContent = "Failed";
          window.setTimeout(function () {
            copyButton.querySelector("span").textContent = "Copy page";
          }, 2000);
        });
    });

    var viewButton = document.createElement("a");
    viewButton.className = "contextual-menu__button contextual-menu__link";
    viewButton.setAttribute("title", "View as Markdown");
    var pathname = window.location.pathname;
    if (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    viewButton.href = "${BASE_URL}" + "index.md" + pathname.replace(/^\\/small-rules/, "");
    viewButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><span>View as Markdown</span>';

    container.appendChild(copyButton);
    container.appendChild(viewButton);

    h1.insertAdjacentElement("afterend", container);
  }

  document.addEventListener("astro:page-load", addContextualMenu);
  addContextualMenu();
})();
`;
}

export default function contextualMenu(): AstroIntegration {
	return {
		hooks: {
			"astro:config:setup": ({ injectScript }): void => {
				injectScript("page", injectContextualMenuScript());
			},
		},
		name: "contextual-menu",
	};
}
