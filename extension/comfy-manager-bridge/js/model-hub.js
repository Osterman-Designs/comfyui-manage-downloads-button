import { app } from "../../scripts/app.js";
import { ModelManager } from "./model-manager.js";
import { createImportPanel, createGitHubPanel } from "./import-url.js";
import { setupFloatingDialog } from "./floating-window.js";

const LAST_TAB_KEY = "cmb-model-hub-last-tab";

const TABS = [
	{ id: "browse", label: "Browse catalog" },
	{ id: "huggingface", label: "Hugging Face" },
	{ id: "civitai", label: "Civitai" },
	{ id: "github", label: "GitHub" },
	{ id: "other", label: "Other URL" },
];

const IMPORT_TABS = new Set(["huggingface", "civitai", "other"]);

let hubInstance = null;
let catalogEmbedded = false;

export function openModelHub({ tab, stubManager } = {}) {
	if (!hubInstance) {
		hubInstance = new ModelHub(stubManager);
	}
	hubInstance.show(tab);
}

export function closeModelHub() {
	hubInstance?.close();
}

class ModelHub {
	constructor(stubManager) {
		this.stubManager = stubManager;
		this.activeTab = "browse";
		this.importPanels = {
			huggingface: createImportPanel("huggingface"),
			civitai: createImportPanel("civitai"),
			other: createImportPanel("other"),
		};
		this.githubPanel = createGitHubPanel(stubManager);
		this.mask = document.createElement("div");
		this.mask.id = "cmb-model-hub-mask";
		this.mask.className = "cmb-model-hub-mask";

		this.dialog = document.createElement("div");
		this.dialog.id = "cmb-model-hub";
		this.dialog.className =
			"p-dialog p-component global-dialog cmb-model-hub cmb-floating-window";
		this.dialog.setAttribute("role", "dialog");
		this.dialog.setAttribute("aria-modal", "false");

		const header = document.createElement("div");
		header.className = "p-dialog-header cmb-model-hub-header cmb-floating-drag-handle";

		const titleWrap = document.createElement("div");
		const title = document.createElement("h2");
		title.textContent = "Download Models";
		titleWrap.appendChild(title);

		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.className =
			"p-button p-component p-button-icon-only p-button-secondary p-button-rounded p-button-text p-dialog-close-button";
		closeBtn.setAttribute("aria-label", "Close");
		closeBtn.innerHTML = "&times;";
		closeBtn.addEventListener("click", () => this.close());

		header.appendChild(titleWrap);
		header.appendChild(closeBtn);

		this.tabBar = document.createElement("div");
		this.tabBar.className = "cmb-model-hub-tabs";
		this.tabButtons = {};

		for (const tab of TABS) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "cmb-model-hub-tab";
			btn.textContent = tab.label;
			btn.dataset.tab = tab.id;
			btn.addEventListener("click", () => this.switchTab(tab.id));
			this.tabBar.appendChild(btn);
			this.tabButtons[tab.id] = btn;
		}

		this.content = document.createElement("div");
		this.content.className = "p-dialog-content cmb-model-hub-content";

		this.panels = {
			browse: document.createElement("div"),
			huggingface: this.importPanels.huggingface.element,
			civitai: this.importPanels.civitai.element,
			github: this.githubPanel.element,
			other: this.importPanels.other.element,
		};
		this.panels.browse.id = "cmb-hub-panel-browse";
		this.panels.browse.className = "cmb-model-hub-panel cmb-model-hub-panel-browse";

		for (const panel of Object.values(this.panels)) {
			panel.classList.add("cmb-model-hub-panel");
			panel.hidden = true;
			this.content.appendChild(panel);
		}

		this.dialog.appendChild(header);
		this.dialog.appendChild(this.tabBar);
		this.dialog.appendChild(this.content);
		this.mask.appendChild(this.dialog);
		document.body.appendChild(this.mask);

		this.floating = setupFloatingDialog({
			dialog: this.dialog,
			dragHandle: header,
			storageKey: "cmb-model-hub-geometry",
			onLayoutChange: () => this.refreshEmbeddedLayout(),
		});

		this.onKeyDown = (e) => {
			if (e.key === "Escape" && this.isOpen()) {
				this.close();
			}
		};
	}

	ensureCatalog() {
		if (!ModelManager.instance) {
			ModelManager.instance = new ModelManager(app, this.stubManager);
			this.embedCatalog(ModelManager.instance);
		}
		return ModelManager.instance;
	}

	embedCatalog(mm) {
		if (catalogEmbedded) {
			return;
		}

		const mask = mm.element;
		const dialog = mask.querySelector("#cmm-manager-dialog");
		const browsePanel = this.panels.browse;

		if (!dialog || !browsePanel) {
			console.error("[Manager-Bridge] Failed to embed Model Manager catalog.");
			return;
		}

		dialog.querySelector(".p-dialog-close-button")?.remove();
		dialog.classList.add("cmb-embedded-catalog");
		browsePanel.appendChild(dialog);
		mask.remove();

		mm.element = dialog;
		mm.show = function showEmbedded() {
			dialog.style.display = "flex";
			this.setKeywords("");
			this.showSelection("");
			this.showMessage("");
			this.loadData();
		};
		mm.close = function closeEmbedded() {
			dialog.style.display = "none";
		};
		dialog.style.display = "none";
		catalogEmbedded = true;
	}

	resolveShowTab(tab) {
		if (tab === "import") {
			return "other";
		}
		if (tab !== undefined && tab !== null && TABS.some((t) => t.id === tab)) {
			return tab;
		}
		const lastSaved = sessionStorage.getItem(LAST_TAB_KEY);
		if (lastSaved && TABS.some((t) => t.id === lastSaved)) {
			return lastSaved;
		}
		return "browse";
	}

	switchTab(tabId) {
		this.activeTab = tabId;
		sessionStorage.setItem(LAST_TAB_KEY, tabId);

		for (const [id, panel] of Object.entries(this.panels)) {
			const active = id === tabId;
			panel.classList.remove("cmb-tab-active");
			panel.hidden = !active;
			if (active) {
				panel.classList.add("cmb-tab-active");
			}
			this.tabButtons[id]?.classList.toggle("cmb-model-hub-tab-active", active);
		}

		if (tabId === "browse") {
			this.ensureCatalog().show();
		} else {
			ModelManager.instance?.close();
			if (IMPORT_TABS.has(tabId)) {
				this.importPanels[tabId]?.onShow?.();
			} else if (tabId === "github") {
				this.githubPanel?.onShow?.();
			}
		}
	}

	isOpen() {
		return this.mask.style.display === "block";
	}

	refreshEmbeddedLayout() {
		window.dispatchEvent(new Event("resize"));
		const grid = ModelManager.instance?.grid;
		if (grid && typeof grid.update === "function") {
			grid.update();
		}
	}

	show(tab) {
		const normalizedTab = this.resolveShowTab(tab);
		this.mask.style.display = "block";
		document.addEventListener("keydown", this.onKeyDown);
		this.switchTab(normalizedTab);
		requestAnimationFrame(() => this.refreshEmbeddedLayout());
	}

	close() {
		this.mask.style.display = "none";
		document.removeEventListener("keydown", this.onKeyDown);
		ModelManager.instance?.close();
	}
}
