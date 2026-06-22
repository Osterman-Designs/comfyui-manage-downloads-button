const DEFAULTS = {
	width: 1200,
	height: 780,
	minWidth: 520,
	minHeight: 360,
	margin: 12,
};

function clampGeometry(geo) {
	const maxWidth = Math.max(DEFAULTS.minWidth, window.innerWidth - DEFAULTS.margin * 2);
	const maxHeight = Math.max(DEFAULTS.minHeight, window.innerHeight - DEFAULTS.margin * 2);

	geo.width = Math.min(Math.max(geo.width, DEFAULTS.minWidth), maxWidth);
	geo.height = Math.min(Math.max(geo.height, DEFAULTS.minHeight), maxHeight);
	geo.left = Math.min(
		Math.max(geo.left, DEFAULTS.margin),
		window.innerWidth - geo.width - DEFAULTS.margin
	);
	geo.top = Math.min(
		Math.max(geo.top, DEFAULTS.margin),
		window.innerHeight - geo.height - DEFAULTS.margin
	);
	return geo;
}

function centerDefault() {
	const width = Math.min(DEFAULTS.width, window.innerWidth - DEFAULTS.margin * 2);
	const height = Math.min(DEFAULTS.height, window.innerHeight - DEFAULTS.margin * 2);
	return clampGeometry({
		left: Math.round((window.innerWidth - width) / 2),
		top: Math.round((window.innerHeight - height) / 2),
		width,
		height,
	});
}

function applyGeometry(dialog, geo) {
	dialog.style.left = `${Math.round(geo.left)}px`;
	dialog.style.top = `${Math.round(geo.top)}px`;
	dialog.style.width = `${Math.round(geo.width)}px`;
	dialog.style.height = `${Math.round(geo.height)}px`;
}

export function setupFloatingDialog({ dialog, dragHandle, storageKey, onLayoutChange }) {
	let geo = centerDefault();

	if (storageKey) {
		try {
			const saved = sessionStorage.getItem(storageKey);
			if (saved) {
				geo = clampGeometry({ ...geo, ...JSON.parse(saved) });
			}
		} catch (e) {
			console.warn("[Manager-Bridge] Could not restore window geometry.", e);
		}
	}

	applyGeometry(dialog, geo);

	const resizeHandle = document.createElement("div");
	resizeHandle.className = "cmb-floating-resize-handle";
	resizeHandle.title = "Resize";
	resizeHandle.setAttribute("aria-hidden", "true");
	dialog.appendChild(resizeHandle);

	let interaction = null;

	const persist = () => {
		if (storageKey) {
			sessionStorage.setItem(
				storageKey,
				JSON.stringify({
					left: geo.left,
					top: geo.top,
					width: geo.width,
					height: geo.height,
				})
			);
		}
	};

	const finishInteraction = () => {
		if (!interaction) {
			return;
		}
		interaction = null;
		persist();
		onLayoutChange?.();
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
		dragHandle.classList.remove("cmb-floating-dragging");
		dialog.classList.remove("cmb-floating-resizing");
	};

	const onMouseMove = (event) => {
		if (!interaction) {
			return;
		}
		const dx = event.clientX - interaction.startX;
		const dy = event.clientY - interaction.startY;

		if (interaction.mode === "drag") {
			geo.left = interaction.startGeo.left + dx;
			geo.top = interaction.startGeo.top + dy;
		} else {
			geo.width = interaction.startGeo.width + dx;
			geo.height = interaction.startGeo.height + dy;
		}

		geo = clampGeometry({ ...geo });
		applyGeometry(dialog, geo);
		onLayoutChange?.();
	};

	const onMouseUp = () => {
		finishInteraction();
	};

	const startInteraction = (mode, event) => {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		interaction = {
			mode,
			startX: event.clientX,
			startY: event.clientY,
			startGeo: { ...geo },
		};
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		if (mode === "drag") {
			dragHandle.classList.add("cmb-floating-dragging");
		} else {
			dialog.classList.add("cmb-floating-resizing");
		}
	};

	dragHandle.addEventListener("mousedown", (event) => {
		if (event.target.closest("button")) {
			return;
		}
		startInteraction("drag", event);
	});

	resizeHandle.addEventListener("mousedown", (event) => {
		event.stopPropagation();
		startInteraction("resize", event);
	});

	const onWindowResize = () => {
		geo = clampGeometry(geo);
		applyGeometry(dialog, geo);
		onLayoutChange?.();
	};

	window.addEventListener("resize", onWindowResize);

	return {
		resetPosition() {
			geo = centerDefault();
			applyGeometry(dialog, geo);
			persist();
			onLayoutChange?.();
		},
		destroy() {
			finishInteraction();
			window.removeEventListener("resize", onWindowResize);
			resizeHandle.remove();
		},
	};
}
