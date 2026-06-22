import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import {
	setManagerInstance,
	rebootAPI,
	free_models,
	customConfirm,
	loadCss,
} from "./common.js";
import { openModelHub, closeModelHub } from "./model-hub.js";

loadCss("./bridge.css");

const DEFAULT_CONFIG = { button: "float", quickCatalog: false, defaultModelTab: "browse" };
const FAB_POSITION_KEY = "cmb-fab-position";
const FAB_DRAG_THRESHOLD = 5;

let reopenManagerMenu = null;
let managerMenuEl = null;
let stubManagerRef = null;
let floatStackEl = null;
let managerFabEl = null;
let fabDragState = null;

async function loadBridgeConfig() {
	try {
		const res = await fetch(new URL("./bridge-config.json", import.meta.url).href);
		if (res.ok) {
			return { ...DEFAULT_CONFIG, ...(await res.json()) };
		}
	} catch (e) {
		console.warn("[Manager-Bridge] bridge-config.json not found, using defaults.", e);
	}
	return DEFAULT_CONFIG;
}

function createStubManager() {
	const datasrc_combo = document.createElement("select");
	datasrc_combo.appendChild(
		Object.assign(document.createElement("option"), { value: "cache", text: "Channel (1day cache)" })
	);
	datasrc_combo.appendChild(
		Object.assign(document.createElement("option"), { value: "local", text: "Local" })
	);
	datasrc_combo.appendChild(
		Object.assign(document.createElement("option"), { value: "remote", text: "Channel (remote)" })
	);

	api.fetchApi("/v2/manager/db_mode")
		.then((response) => response.text())
		.then((data) => {
			datasrc_combo.value = data;
		})
		.catch(() => {});

	datasrc_combo.addEventListener("change", (event) => {
		api.fetchApi("/v2/manager/db_mode", {
			method: "POST",
			body: JSON.stringify({ value: event.target.value }),
		});
	});

	const stub = {
		datasrc_combo,
		show() {
			closeModelHub();
			reopenManagerMenu?.();
		},
		close() {},
	};

	stubManagerRef = stub;
	return stub;
}

function openHub(tab) {
	closeManagerMenu();
	openModelHub({ tab, stubManager: stubManagerRef || createStubManager() });
}

function hasCustomFabPosition() {
	try {
		const raw = sessionStorage.getItem(FAB_POSITION_KEY);
		if (!raw) {
			return false;
		}
		const pos = JSON.parse(raw);
		return typeof pos.left === "number" && typeof pos.bottom === "number";
	} catch {
		return false;
	}
}

function applySavedFabPosition() {
	if (!floatStackEl || !hasCustomFabPosition()) {
		return false;
	}
	try {
		const { left, bottom } = JSON.parse(sessionStorage.getItem(FAB_POSITION_KEY));
		floatStackEl.style.left = `${Math.round(left)}px`;
		floatStackEl.style.bottom = `${Math.round(bottom)}px`;
		floatStackEl.style.top = "";
		return true;
	} catch {
		return false;
	}
}

function saveFabPosition(left, bottom) {
	sessionStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ left, bottom }));
}

function positionFloatStack() {
	if (!floatStackEl) {
		return;
	}
	if (applySavedFabPosition()) {
		return;
	}

	const canvas = document.querySelector(".graph-canvas-container");
	const rect = canvas?.getBoundingClientRect();
	if (rect && rect.width > 0 && rect.height > 0) {
		floatStackEl.style.left = `${Math.round(rect.left + 12)}px`;
		floatStackEl.style.bottom = `${Math.round(window.innerHeight - rect.bottom + 12)}px`;
	} else {
		floatStackEl.style.left = "12px";
		floatStackEl.style.bottom = "12px";
	}
}

function positionManagerMenu() {
	if (!managerMenuEl || managerMenuEl.hidden) {
		return;
	}
	const anchor = managerFabEl || floatStackEl;
	if (!anchor) {
		return;
	}

	const rect = anchor.getBoundingClientRect();
	const gap = 8;
	const margin = 8;
	const menuHeight = managerMenuEl.offsetHeight || 180;
	const spaceAbove = rect.top - gap;
	const spaceBelow = window.innerHeight - rect.bottom - gap;

	managerMenuEl.style.left = `${Math.round(rect.left)}px`;
	managerMenuEl.style.top = "";
	managerMenuEl.style.bottom = "";

	const openAbove = spaceAbove >= menuHeight || spaceAbove >= spaceBelow;
	if (openAbove) {
		managerMenuEl.style.bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`;
		managerMenuEl.dataset.placement = "above";
	} else {
		managerMenuEl.style.top = `${Math.round(rect.bottom + gap)}px`;
		managerMenuEl.dataset.placement = "below";
	}

	let menuRect = managerMenuEl.getBoundingClientRect();
	if (menuRect.top < margin) {
		managerMenuEl.style.top = `${margin}px`;
		managerMenuEl.style.bottom = "";
		managerMenuEl.dataset.placement = "below";
	} else if (menuRect.bottom > window.innerHeight - margin) {
		managerMenuEl.style.bottom = `${margin}px`;
		managerMenuEl.style.top = "";
		managerMenuEl.dataset.placement = "above";
	}

	menuRect = managerMenuEl.getBoundingClientRect();
	if (menuRect.right > window.innerWidth - margin) {
		managerMenuEl.style.left = `${Math.round(Math.max(margin, rect.left - (menuRect.right - (window.innerWidth - margin))))}px`;
	}
}

function closeManagerMenu() {
	if (managerMenuEl) {
		managerMenuEl.hidden = true;
	}
}

function toggleManagerMenu(anchorEl) {
	if (!managerMenuEl) {
		return;
	}
	const willOpen = managerMenuEl.hidden;
	closeManagerMenu();
	if (willOpen) {
		managerFabEl = anchorEl || managerFabEl;
		if (!hasCustomFabPosition()) {
			positionFloatStack();
		}
		managerMenuEl.hidden = false;
		positionManagerMenu();
	}
}

function isFabDragTarget(target) {
	return target instanceof Element && target.closest("#cmb-manager-fab");
}

function clampFabPosition(left, bottom) {
	const stackW = floatStackEl?.offsetWidth || 140;
	const stackH = floatStackEl?.offsetHeight || 44;
	const maxLeft = Math.max(0, window.innerWidth - stackW - 8);
	const maxBottom = Math.max(0, window.innerHeight - stackH - 8);
	return {
		left: Math.min(Math.max(8, left), maxLeft),
		bottom: Math.min(Math.max(8, bottom), maxBottom),
	};
}

function setupFabDrag() {
	if (!floatStackEl || !managerFabEl) {
		return;
	}

	floatStackEl.addEventListener("pointerdown", (e) => {
		if (!isFabDragTarget(e.target) || e.button !== 0) {
			return;
		}
		const rect = floatStackEl.getBoundingClientRect();
		fabDragState = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			dragging: false,
			startLeft: rect.left,
			startBottom: window.innerHeight - rect.bottom,
			offsetX: e.clientX - rect.left,
			offsetY: e.clientY - rect.top,
		};
	});

	floatStackEl.addEventListener("pointermove", (e) => {
		if (!fabDragState || fabDragState.pointerId !== e.pointerId) {
			return;
		}
		const dx = e.clientX - fabDragState.startX;
		const dy = e.clientY - fabDragState.startY;
		if (!fabDragState.dragging) {
			if (Math.hypot(dx, dy) < FAB_DRAG_THRESHOLD) {
				return;
			}
			fabDragState.dragging = true;
			managerFabEl.classList.add("cmb-fab-dragging");
			closeManagerMenu();
			floatStackEl.setPointerCapture(e.pointerId);
		}
		const left = e.clientX - fabDragState.offsetX;
		const bottom = window.innerHeight - (e.clientY - fabDragState.offsetY + floatStackEl.offsetHeight);
		const clamped = clampFabPosition(left, bottom);
		floatStackEl.style.left = `${Math.round(clamped.left)}px`;
		floatStackEl.style.bottom = `${Math.round(clamped.bottom)}px`;
	});

	const finishFabDrag = (e) => {
		if (!fabDragState || fabDragState.pointerId !== e.pointerId) {
			return;
		}
		const wasDragging = fabDragState.dragging;
		managerFabEl.classList.remove("cmb-fab-dragging");
		if (wasDragging) {
			const rect = floatStackEl.getBoundingClientRect();
			saveFabPosition(rect.left, window.innerHeight - rect.bottom);
			try {
				floatStackEl.releasePointerCapture(e.pointerId);
			} catch {
				// ignore
			}
		} else {
			toggleManagerMenu(managerFabEl);
		}
		fabDragState = null;
	};

	floatStackEl.addEventListener("pointerup", finishFabDrag);
	floatStackEl.addEventListener("pointercancel", finishFabDrag);
}

function watchCanvasLayout() {
	const canvas = document.querySelector(".graph-canvas-container");
	if (!canvas) {
		return false;
	}
	positionFloatStack();
	if (typeof ResizeObserver !== "undefined") {
		new ResizeObserver(() => {
			if (!hasCustomFabPosition()) {
				positionFloatStack();
			}
			positionManagerMenu();
		}).observe(canvas);
	}
	return true;
}

function createManagerMenu(actions) {
	const menu = document.createElement("div");
	menu.id = "cmb-manager-menu";
	menu.hidden = true;

	for (const action of actions) {
		const item = document.createElement("button");
		item.type = "button";
		item.className = action.primary ? "cmb-menu-item cmb-menu-item-primary" : "cmb-menu-item";
		item.textContent = action.label;
		item.title = action.title;
		item.onclick = () => {
			closeManagerMenu();
			action.onClick();
		};
		menu.appendChild(item);
	}

	document.body.appendChild(menu);
	managerMenuEl = menu;

	document.addEventListener(
		"pointerdown",
		(e) => {
			if (managerMenuEl.hidden) {
				return;
			}
			const target = e.target;
			if (
				target instanceof Node &&
				!managerMenuEl.contains(target) &&
				!(target instanceof Element && target.closest("#cmb-manager-fab"))
			) {
				closeManagerMenu();
			}
		},
		true
	);

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeManagerMenu();
		}
	});

	reopenManagerMenu = () => toggleManagerMenu(managerFabEl);
	return menu;
}

async function confirmUnloadModels() {
	const ok = await customConfirm(
		"Unload all models from VRAM? They will reload on the next run."
	);
	if (ok) {
		await free_models(false);
	}
}

async function confirmFreeMemory() {
	const ok = await customConfirm(
		"Unload all models and clear the execution cache? Next run may be slower until cache rebuilds."
	);
	if (ok) {
		await free_models(true);
	}
}

function buildMenuActions() {
	return [
		{
			label: "Download Models",
			title: "Browse catalog or import from Hugging Face, Civitai, Replicate, and more",
			primary: true,
			onClick: () => openHub(),
		},
		{
			label: "Unload all models",
			title: "Unload all models from VRAM",
			onClick: () => confirmUnloadModels(),
		},
		{
			label: "Free memory + cache",
			title: "Unload all models and clear the execution cache",
			onClick: () => confirmFreeMemory(),
		},
		{
			label: "Restart",
			title: "Restart ComfyUI server",
			onClick: () => rebootAPI(),
		},
	];
}

function makeFab(id, label, title, onClick, primary = false) {
	const btn = document.createElement("button");
	btn.id = id;
	btn.type = "button";
	btn.textContent = label;
	btn.title = title;
	btn.className = primary ? "cmb-fab cmb-fab-primary" : "cmb-fab";
	if (onClick) {
		btn.onclick = onClick;
	}
	return btn;
}

function createFloatFabs(config) {
	floatStackEl = document.createElement("div");
	floatStackEl.id = "cmb-fab-stack";
	floatStackEl.style.cssText = [
		"position:fixed",
		"display:flex",
		"flex-direction:column",
		"gap:8px",
		"pointer-events:auto",
		"z-index:10000",
	].join(";");

	if (config.quickCatalog === true) {
		floatStackEl.appendChild(
			makeFab(
				"cmb-catalog-fab",
				"Download Models",
				"Browse catalog or import from Hugging Face, Civitai, Replicate, and more",
				() => openHub(config.defaultModelTab || "browse"),
				false
			)
		);
	}

	managerFabEl = makeFab(
		"cmb-manager-fab",
		"Manager",
		"Manager tools: download models, unload, restart",
		null,
		true
	);
	floatStackEl.appendChild(managerFabEl);

	document.body.appendChild(floatStackEl);
	positionFloatStack();
	setupFabDrag();

	window.addEventListener("resize", () => {
		if (!hasCustomFabPosition()) {
			positionFloatStack();
		}
		if (!managerMenuEl?.hidden) {
			positionManagerMenu();
		}
	});

	if (!watchCanvasLayout()) {
		const observer = new MutationObserver(() => {
			if (watchCanvasLayout()) {
				observer.disconnect();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	return floatStackEl;
}

app.registerExtension({
	name: "Comfy.ManagerBridge",

	async setup() {
		const config = await loadBridgeConfig();
		if (config.button === "off") {
			return;
		}

		const stub = createStubManager();
		setManagerInstance(stub);

		createManagerMenu(buildMenuActions());

		if (config.button === "float") {
			createFloatFabs(config);
		} else {
			console.warn(
				`[Manager-Bridge] Unknown button mode "${config.button}"; use float or off.`
			);
		}
	},
});
