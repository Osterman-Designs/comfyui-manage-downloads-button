import { api } from "../../scripts/api.js";
import { generateUUID, show_message, infoToast } from "./common.js";

const MODEL_EXTENSIONS = [".safetensors", ".sft", ".ckpt", ".pth", ".pt"];

const KNOWN_PROVIDER_PREFIXES = [
	"https://civitai.com/",
	"https://civitai.red/",
	"https://huggingface.co/",
	"https://github.com/",
	"https://raw.githubusercontent.com/",
];

const FOLDER_TO_TYPE = {
	checkpoints: "checkpoint",
	loras: "lora",
	vae: "vae",
	controlnet: "controlnet",
	clip_vision: "clip_vision",
	embeddings: "embedding",
	upscale_models: "upscale",
	diffusion_models: "unet",
	text_encoders: "clip",
	gligen: "gligen",
};

/** First match wins — order from most specific to general. */
const FOLDER_INFERENCE_RULES = [
	{ folder: "upscale_models", test: (text) => /realesrgan|esrgan|upscale|swinir/i.test(text) },
	{ folder: "clip_vision", test: (text) => /clip[-_]vision/i.test(text) },
	{ folder: "text_encoders", test: (text) => /text[-_]encoder|\/t5\/|\/text_encoders?\//i.test(text) },
	{ folder: "controlnet", test: (text) => /controlnet|control[-_]net/i.test(text) },
	{ folder: "embeddings", test: (text) => /\/embeddings?\//i.test(text) || /\bembedding/i.test(text) },
	{ folder: "loras", test: (text) => /\/loras?\//i.test(text) || /\blora\b/i.test(text) || /lycoris|locon/i.test(text) },
	{
		folder: "vae",
		test: (text) =>
			/\/vae\b/i.test(text) ||
			/sd-vae|vae-ft|[-_]vae[-_.]|^vae[-_.]/i.test(text),
	},
	{ folder: "diffusion_models", test: (text) => /\/unet\/|diffusion_model/i.test(text) },
	{ folder: "gligen", test: (text) => /gligen/i.test(text) },
];

const FOLDER_CHEAT_SHEET_HTML = `
<details class="cmb-import-folder-guide">
	<summary>Which folder? Quick reference</summary>
	<p class="cmb-import-folder-guide-lead">Match the <strong>loader node</strong> you will use, not the download site.</p>
	<table class="cmb-import-folder-guide-table">
		<thead>
			<tr><th>Folder</th><th>Use for</th></tr>
		</thead>
		<tbody>
			<tr><td><code>checkpoints</code></td><td>Full base models (Load Checkpoint)</td></tr>
			<tr><td><code>loras</code></td><td>LoRA / LyCORIS add-ons</td></tr>
			<tr><td><code>vae</code></td><td>Standalone VAE files</td></tr>
			<tr><td><code>vae_approx</code></td><td>TAESD preview decoders</td></tr>
			<tr><td><code>controlnet</code></td><td>ControlNet / T2I-Adapter</td></tr>
			<tr><td><code>clip_vision</code></td><td>CLIP Vision, SigLIP, IPAdapter image encoders</td></tr>
			<tr><td><code>text_encoders</code></td><td>T5, UMT5, standalone text encoders</td></tr>
			<tr><td><code>diffusion_models</code></td><td>UNet / diffusion weights only</td></tr>
			<tr><td><code>embeddings</code></td><td>Textual inversion / small embedding files</td></tr>
			<tr><td><code>upscale_models</code></td><td>ESRGAN / Real-ESRGAN pixel upscalers</td></tr>
			<tr><td><code>latent_upscale_models</code></td><td>Latent upscalers</td></tr>
			<tr><td><code>gligen</code></td><td>GLIGEN models</td></tr>
			<tr><td><code>hypernetworks</code></td><td>Hypernetworks</td></tr>
			<tr><td><code>photomaker</code></td><td>PhotoMaker</td></tr>
		</tbody>
	</table>
	<p class="cmb-import-folder-guide-tip">HF: check page tags and README — <code>model.safetensors</code> alone is not enough. Civitai: use the model type on the page. Extra folders in the list come from your ComfyUI paths.</p>
</details>
`;

const PROVIDERS = {
	huggingface: {
		label: "Hugging Face",
		prefixes: ["https://huggingface.co/"],
		description:
			"Paste a Hugging Face <strong>resolve/download URL</strong> for a model file.",
		placeholder: "https://huggingface.co/user/repo/resolve/main/model.safetensors",
		hint: "Use the direct <code>/resolve/…</code> link. Public models do not need a token.",
		rejectMessage: "Enter a huggingface.co download URL.",
		apiKeyProvider: "huggingface",
		apiKeyLabel: "Hugging Face token",
		apiKeyNote: "Settings → Access Tokens (read access is enough). Stored locally on this machine.",
	},
	civitai: {
		label: "Civitai",
		prefixes: ["https://civitai.com/", "https://civitai.red/"],
		description:
			"Paste the Civitai <strong>download URL</strong> (<code>/api/download/models/…</code>). On the model page: right-click <strong>Download</strong> → <strong>Copy link address</strong> — not the page URL from the address bar.",
		placeholder: "https://civitai.com/api/download/models/12345",
		hint: "The link must contain <code>/api/download/models/</code>. Public models do not need a token.",
		rejectMessage: "Enter a civitai.com download URL (/api/download/models/…).",
		apiKeyProvider: "civitai",
		apiKeyLabel: "Civitai API token",
		apiKeyNote: "Account Settings → API Keys. Stored locally on this machine.",
	},
	github: {
		label: "Download model file",
		prefixes: ["https://github.com/", "https://raw.githubusercontent.com/"],
		description:
			"Paste a GitHub <strong>release download</strong> or <strong>raw file</strong> URL.",
		placeholder:
			"https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
		hint: "Use a direct file link ending in .safetensors, .ckpt, .pt, or .pth — not a .git repo URL.",
		rejectMessage: "Enter a github.com or raw.githubusercontent.com download URL.",
		gitRejectMessage: "Use the section below for custom nodes (.git repo URLs).",
		showTitle: false,
	},
	other: {
		label: "Other URL",
		prefixes: null,
		description:
			"Paste a direct download URL for hosts <strong>not listed above</strong> (mirrors, CDNs, etc.).",
		placeholder: "https://example.com/path/model.safetensors",
		hint: "Use the Hugging Face, Civitai, or GitHub tabs for those hosts. Requires a direct https link ending in a model extension.",
		rejectMessage:
			"Use the Hugging Face, Civitai, or GitHub tabs for those hosts. Other URLs must start with https://.",
	},
};

function hasModelExtension(name) {
	return MODEL_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

function parseFilenameFromUrl(url) {
	try {
		const parsed = new URL(url);
		const segment = parsed.pathname.split("/").pop();
		if (segment && segment.includes(".")) {
			return decodeURIComponent(segment.split("?")[0]);
		}
	} catch {
		// ignore
	}
	return null;
}

function inferFolderFromImport(url, filename = "") {
	const fromUrl = parseFilenameFromUrl(url) || "";
	const text = `${url} ${filename || fromUrl}`.toLowerCase();
	if (!text.trim()) {
		return null;
	}

	for (const rule of FOLDER_INFERENCE_RULES) {
		if (rule.test(text)) {
			return rule.folder;
		}
	}

	return null;
}

async function fetchHeadFilename(url) {
	try {
		const res = await fetch(url, { method: "HEAD" });
		const disposition = res.headers.get("content-disposition");
		if (disposition) {
			const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
			const raw = match?.[1] || match?.[2];
			if (raw) {
				return decodeURIComponent(raw);
			}
		}
	} catch {
		// ignore
	}
	return null;
}

async function fetchBridgeFilename(url) {
	try {
		const res = await api.fetchApi(
			`/v2/manager/bridge/resolve-filename?url=${encodeURIComponent(url)}`
		);
		if (!res.ok) {
			return null;
		}
		const data = await res.json();
		return data.filename || null;
	} catch {
		return null;
	}
}

function guessCivitaiFilename(url) {
	try {
		const parsed = new URL(url);
		const match = parsed.pathname.match(/\/api\/download\/models\/(\d+)/i);
		if (!match) {
			return null;
		}
		const versionId = match[1];
		const fileId = parsed.searchParams.get("fileId");
		const base = fileId ? `civitai-${versionId}-${fileId}` : `civitai-${versionId}`;
		return `${base}.safetensors`;
	} catch {
		return null;
	}
}

export async function fetchModelFolders() {
	const res = await api.fetchApi("/experiment/models");
	if (!res.ok) {
		throw new Error("Could not load model folders.");
	}
	const folders = await res.json();
	return folders
		.map((entry) => entry.name)
		.filter((name) => !["configs", "custom_nodes"].includes(name))
		.sort();
}

function isGitRepoUrl(url) {
	return /\.git(?:[/?#]|$)/i.test(url) || url.endsWith(".git");
}

/** Fix Windows-style pasted paths and stray leading slashes. */
function normalizeImportUrl(raw) {
	let url = `${raw}`.trim().replace(/\\/g, "/");
	url = url.replace(/^\/+/, "");
	return url;
}

function isHuggingFaceResolveUrl(url) {
	return url.startsWith("https://huggingface.co/") && url.includes("/resolve/");
}

function isCivitaiDownloadUrl(url) {
	return (
		(url.startsWith("https://civitai.com/") || url.startsWith("https://civitai.red/")) &&
		url.includes("/api/download/")
	);
}

function isAllowedForProvider(providerId, url) {
	const config = PROVIDERS[providerId];
	if (!config) {
		return false;
	}

	if (providerId === "github" && isGitRepoUrl(url)) {
		return false;
	}

	if (providerId === "other") {
		if (!url.startsWith("https://")) {
			return false;
		}
		return !KNOWN_PROVIDER_PREFIXES.some((prefix) => url.startsWith(prefix));
	}

	if (providerId === "huggingface") {
		return isHuggingFaceResolveUrl(url);
	}

	if (providerId === "civitai") {
		return isCivitaiDownloadUrl(url);
	}

	return config.prefixes.some((prefix) => url.startsWith(prefix));
}

function getImportValidationError(providerId, rawUrl) {
	const url = normalizeImportUrl(rawUrl);
	const config = PROVIDERS[providerId];
	if (!config) {
		return "Unknown provider.";
	}

	if (providerId === "github" && isGitRepoUrl(url)) {
		return config.gitRejectMessage;
	}

	if (providerId === "huggingface") {
		if (url.startsWith("https://huggingface.co/") && !isHuggingFaceResolveUrl(url)) {
			return "Use a direct /resolve/…/filename link — on Hugging Face open Files, pick a file, then copy its download URL.";
		}
	}

	if (providerId === "civitai") {
		if (
			(url.startsWith("https://civitai.com/") || url.startsWith("https://civitai.red/")) &&
			!isCivitaiDownloadUrl(url)
		) {
			return "Use the download URL from Download → Copy link address. It must contain /api/download/models/… — not civitai.com/models/…";
		}
	}

	if (!isAllowedForProvider(providerId, url)) {
		return config.rejectMessage;
	}

	return null;
}

async function fetchApiKeyStatus() {
	const res = await api.fetchApi("/v2/manager/bridge/api-keys");
	if (!res.ok) {
		throw new Error(`HTTP ${res.status}`);
	}
	return res.json();
}

async function saveApiKey(provider, token) {
	const res = await api.fetchApi("/v2/manager/bridge/api-keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ [provider]: token }),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(data.error || `HTTP ${res.status}`);
	}
	return data;
}

async function clearApiKey(provider) {
	const res = await api.fetchApi("/v2/manager/bridge/api-keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ [provider]: "" }),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(data.error || `HTTP ${res.status}`);
	}
	return data;
}

function attachApiKeyControls(root, providerId, config) {
	const apiKeyProvider = config.apiKeyProvider;
	if (!apiKeyProvider) {
		return { onShow: null };
	}

	const tokenSection = document.createElement("div");
	tokenSection.className = "cmb-import-token";
	tokenSection.innerHTML = `
		<label class="cmb-import-label cmb-import-token-label">
			<span>${config.apiKeyLabel} <span class="cmb-import-token-optional">(private or gated only)</span></span>
			<span class="cmb-import-token-status"></span>
		</label>
		<div class="cmb-import-token-row">
			<input type="password" class="cmb-import-token-input p-inputtext p-component" autocomplete="off" spellcheck="false" placeholder="Paste token (leave blank to keep saved)">
			<button type="button" class="cmb-import-token-save comfyui-button">Save</button>
			<button type="button" class="cmb-import-token-clear comfyui-button">Clear</button>
		</div>
		<p class="cmb-import-token-note">${config.apiKeyNote}</p>
	`;

	const descEl = root.querySelector(".cmb-import-desc");
	descEl.insertAdjacentElement("afterend", tokenSection);

	const tokenInput = tokenSection.querySelector(".cmb-import-token-input");
	const statusEl = tokenSection.querySelector(".cmb-import-token-status");
	const saveBtn = tokenSection.querySelector(".cmb-import-token-save");
	const clearBtn = tokenSection.querySelector(".cmb-import-token-clear");

	function renderStatus(status) {
		const configured = Boolean(status?.[apiKeyProvider]?.configured);
		statusEl.textContent = configured ? "Saved" : "Not set";
		statusEl.classList.toggle("cmb-import-token-status-ok", configured);
	}

	async function loadStatus() {
		try {
			renderStatus(await fetchApiKeyStatus());
		} catch (e) {
			console.error("[Manager-Bridge] Failed to load API key status:", e);
			statusEl.textContent = "Restart ComfyUI";
			statusEl.title =
				"API key routes are missing. Run setup_model_manager.bat, then restart ComfyUI and hard-refresh the browser.";
		}
	}

	saveBtn.addEventListener("click", async () => {
		const token = tokenInput.value.trim();
		if (!token) {
			infoToast("Paste a token to save, or use Clear to remove the saved token.");
			return;
		}

		saveBtn.disabled = true;
		try {
			renderStatus(await saveApiKey(apiKeyProvider, token));
			tokenInput.value = "";
			infoToast(`${config.apiKeyLabel} saved.`);
		} catch (e) {
			const hint =
				String(e.message || e).includes("404") || String(e.message || e).includes("HTTP 404")
					? "\n\nRestart ComfyUI after running setup_model_manager.bat."
					: "";
			show_message(`Could not save token: ${e.message || e}${hint}`);
		} finally {
			saveBtn.disabled = false;
		}
	});

	clearBtn.addEventListener("click", async () => {
		if (!confirm(`Remove the saved ${config.apiKeyLabel.toLowerCase()} from this machine?`)) {
			return;
		}

		clearBtn.disabled = true;
		try {
			renderStatus(await clearApiKey(apiKeyProvider));
			tokenInput.value = "";
			infoToast("Saved token cleared.");
		} catch (e) {
			show_message(`Could not clear token: ${e.message || e}`);
		} finally {
			clearBtn.disabled = false;
		}
	});

	return { onShow: loadStatus };
}

export function createImportPanel(providerId) {
	const config = PROVIDERS[providerId];
	if (!config) {
		throw new Error(`Unknown import provider: ${providerId}`);
	}

	const root = document.createElement("div");
	root.className = "cmb-import-url";
	root.dataset.provider = providerId;

	const titleHtml =
		config.showTitle === false
			? ""
			: `<h3 class="cmb-import-title">${config.label}</h3>`;

	root.innerHTML = `
		${titleHtml}
		<p class="cmb-import-desc">${config.description}</p>
		<label class="cmb-import-label">${config.label} URL</label>
		<input type="text" class="cmb-import-input p-inputtext p-component" placeholder="${config.placeholder}" spellcheck="false" autocapitalize="off" autocomplete="off" />
		<label class="cmb-import-label">Install to folder</label>
		<select class="cmb-import-folder p-inputtext p-component"></select>
		<p class="cmb-import-folder-hint">Suggested from the URL/filename when detected. Change anytime.</p>
		${FOLDER_CHEAT_SHEET_HTML}
		<label class="cmb-import-label">Filename (optional)</label>
		<input type="text" class="cmb-import-filename p-inputtext p-component" placeholder="Auto-detected from URL" spellcheck="false" />
		<p class="cmb-import-hint">${config.hint}</p>
		<p class="cmb-import-warning cmb-import-page-warning" hidden></p>
		<div class="cmb-import-actions">
			<button type="button" class="cmb-import-submit comfyui-button primary">Import</button>
			<span class="cmb-import-status"></span>
		</div>
	`;

	const urlInput = root.querySelector(".cmb-import-input");
	const folderSelect = root.querySelector(".cmb-import-folder");
	const filenameInput = root.querySelector(".cmb-import-filename");
	const statusEl = root.querySelector(".cmb-import-status");
	const submitBtn = root.querySelector(".cmb-import-submit");
	const pageWarningEl = root.querySelector(".cmb-import-page-warning");

	let foldersLoaded = false;
	let lastAutoFolder = "checkpoints";
	let folderManuallyChanged = false;

	async function loadFolders() {
		if (foldersLoaded) {
			return;
		}
		folderSelect.innerHTML = "";
		try {
			const folders = await fetchModelFolders();
			for (const name of folders) {
				const opt = document.createElement("option");
				opt.value = name;
				opt.textContent = name;
				if (name === "checkpoints") {
					opt.selected = true;
				}
				folderSelect.appendChild(opt);
			}
			foldersLoaded = true;
			applySuggestedFolder(syncNormalizedUrl(), filenameInput.value.trim());
		} catch (err) {
			statusEl.textContent = err.message || String(err);
		}
	}

	function applySuggestedFolder(url, filename = "") {
		if (!foldersLoaded) {
			return;
		}

		if (!url) {
			folderManuallyChanged = false;
			lastAutoFolder = "checkpoints";
			if (folderSelect.querySelector('option[value="checkpoints"]')) {
				folderSelect.value = "checkpoints";
			}
			return;
		}

		if (folderManuallyChanged) {
			return;
		}

		const suggested = inferFolderFromImport(url, filename);
		if (!suggested) {
			return;
		}

		if (folderSelect.querySelector(`option[value="${suggested}"]`)) {
			folderSelect.value = suggested;
			lastAutoFolder = suggested;
		}
	}

	folderSelect.addEventListener("change", () => {
		if (folderSelect.value !== lastAutoFolder) {
			folderManuallyChanged = true;
		}
	});

	function syncNormalizedUrl() {
		const normalized = normalizeImportUrl(urlInput.value);
		if (normalized !== urlInput.value) {
			urlInput.value = normalized;
		}
		return normalized;
	}

	function updatePageWarning() {
		if (!pageWarningEl) {
			return;
		}

		const url = syncNormalizedUrl();

		if (providerId === "huggingface" && url.startsWith("https://huggingface.co/") && !isHuggingFaceResolveUrl(url)) {
			pageWarningEl.hidden = false;
			pageWarningEl.textContent =
				"This looks like a Hugging Face model page, not a direct download. Open Files on that page, choose a file, then copy the URL containing /resolve/…/filename.safetensors.";
			return;
		}

		if (
			providerId === "civitai" &&
			(url.startsWith("https://civitai.com/") || url.startsWith("https://civitai.red/")) &&
			!isCivitaiDownloadUrl(url)
		) {
			pageWarningEl.hidden = false;
			pageWarningEl.textContent =
				"This is the model page URL, not the download link. Right-click Download → Copy link address. It should contain /api/download/models/…";
			return;
		}

		pageWarningEl.hidden = true;
		pageWarningEl.textContent = "";

		applySuggestedFolder(url, filenameInput.value.trim());
		suggestFilenameFromUrl(url);
	}

	async function resolveFilename(url) {
		const manual = filenameInput.value.trim();
		if (manual) {
			return manual;
		}
		const fromUrl = parseFilenameFromUrl(url);
		if (fromUrl && hasModelExtension(fromUrl)) {
			return fromUrl;
		}

		if (providerId === "civitai" || providerId === "huggingface") {
			const fromBridge = await fetchBridgeFilename(url);
			if (fromBridge && hasModelExtension(fromBridge)) {
				return fromBridge;
			}
		}

		const fromHead = await fetchHeadFilename(url);
		if (fromHead && hasModelExtension(fromHead)) {
			return fromHead;
		}

		if (providerId === "civitai") {
			const guessed = guessCivitaiFilename(url);
			if (guessed) {
				return guessed;
			}
		}

		if (fromUrl) {
			return fromUrl;
		}
		return null;
	}

	let suggestFilenameSeq = 0;

	async function suggestFilenameFromUrl(url) {
		if (filenameInput.value.trim() || !isAllowedForProvider(providerId, url)) {
			return;
		}

		const seq = ++suggestFilenameSeq;
		let suggested = parseFilenameFromUrl(url);
		if (!suggested || !hasModelExtension(suggested)) {
			if (providerId === "civitai" || providerId === "huggingface") {
				suggested = await fetchBridgeFilename(url);
			}
		}
		if (!suggested || !hasModelExtension(suggested)) {
			suggested = await fetchHeadFilename(url);
		}
		if ((!suggested || !hasModelExtension(suggested)) && providerId === "civitai") {
			suggested = guessCivitaiFilename(url);
		}

		if (seq !== suggestFilenameSeq || !suggested || filenameInput.value.trim()) {
			return;
		}

		filenameInput.value = suggested;
		applySuggestedFolder(url, suggested);
	}

	async function submit() {
		const url = syncNormalizedUrl();
		statusEl.textContent = "";

		if (!url) {
			statusEl.textContent = "Enter a download URL.";
			return;
		}

		const validationError = getImportValidationError(providerId, url);
		if (validationError) {
			statusEl.textContent = validationError;
			return;
		}

		const folder = folderSelect.value;
		if (!folder) {
			statusEl.textContent = "Select a target folder.";
			return;
		}

		submitBtn.disabled = true;
		statusEl.textContent = "Queuing download…";

		try {
			const filename = await resolveFilename(url);
			if (!filename) {
				statusEl.textContent = "Could not determine filename — enter one manually.";
				return;
			}
			if (!hasModelExtension(filename)) {
				statusEl.textContent = "Filename must end with .safetensors, .ckpt, .pt, or .pth";
				return;
			}

			const type = FOLDER_TO_TYPE[folder] || "checkpoint";
			const payload = {
				batch_id: generateUUID(),
				install_model: [
					{
						url,
						filename,
						type,
						save_path: folder,
						name: filename,
						ui_id: generateUUID(),
					},
				],
			};

			const res = await api.fetchApi("/v2/manager/queue/batch", {
				method: "POST",
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `Server error (${res.status})`);
			}

			const failed = await res.json();
			if (Array.isArray(failed) && failed.length > 0) {
				throw new Error("Download was rejected by the server queue.");
			}

			filenameInput.value = filename;
			statusEl.textContent = "Download queued — check the manager terminal for progress.";
			infoToast("Import queued", `${filename} → ${folder}`);
		} catch (err) {
			statusEl.textContent = err.message || String(err);
			show_message(`Import failed:\n${err.message || err}`);
		} finally {
			submitBtn.disabled = false;
		}
	}

	submitBtn.addEventListener("click", submit);
	urlInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			submit();
		}
	});
	urlInput.addEventListener("input", updatePageWarning);
	urlInput.addEventListener("paste", () => {
		requestAnimationFrame(updatePageWarning);
	});
	filenameInput.addEventListener("input", () => {
		applySuggestedFolder(syncNormalizedUrl(), filenameInput.value.trim());
	});

	const apiKeyControls = attachApiKeyControls(root, providerId, config);
	const baseOnShow = loadFolders;

	return {
		element: root,
		onShow: async () => {
			await baseOnShow();
			await apiKeyControls.onShow?.();
		},
	};
}

export function createGitHubPanel(stubManager) {
	const root = document.createElement("div");
	root.className = "cmb-github-panel";

	const modelSection = document.createElement("div");
	modelSection.className = "cmb-github-section";
	const modelTitle = document.createElement("h3");
	modelTitle.className = "cmb-github-section-title";
	modelTitle.textContent = "Download model file";
	modelSection.appendChild(modelTitle);

	const modelImport = createImportPanel("github");
	modelSection.appendChild(modelImport.element);

	const nodeSection = document.createElement("div");
	nodeSection.className = "cmb-github-section";
	nodeSection.innerHTML = `
		<h3 class="cmb-github-section-title">Install custom node (Git URL)</h3>
		<p class="cmb-import-desc">Clone a custom node repository into <code>custom_nodes</code>. Requires <code>allow_git_url_install = true</code> in manager config.</p>
		<label class="cmb-import-label">Git repository URL</label>
		<input type="text" class="cmb-github-node-url p-inputtext p-component" placeholder="https://github.com/author/ComfyUI-Custom-Node.git" spellcheck="false" autocapitalize="off" autocomplete="off" />
		<div class="cmb-import-actions">
			<button type="button" class="cmb-github-node-install comfyui-button primary">Install node</button>
			<span class="cmb-github-node-status cmb-import-status"></span>
		</div>
	`;

	const nodeUrlInput = nodeSection.querySelector(".cmb-github-node-url");
	const nodeInstallBtn = nodeSection.querySelector(".cmb-github-node-install");
	const nodeStatusEl = nodeSection.querySelector(".cmb-github-node-status");

	function syncGitNodeUrlInput() {
		const normalized = normalizeImportUrl(nodeUrlInput.value);
		if (normalized !== nodeUrlInput.value) {
			nodeUrlInput.value = normalized;
		}
		return normalized;
	}

	nodeInstallBtn.addEventListener("click", async () => {
		const url = syncGitNodeUrlInput();
		nodeStatusEl.textContent = "";
		if (!url) {
			nodeStatusEl.textContent = "Enter a Git repository URL.";
			return;
		}
		if (!url.startsWith("https://")) {
			nodeStatusEl.textContent = "Enter an https:// Git URL (forward slashes, not backslashes).";
			return;
		}
		if (!isGitRepoUrl(url)) {
			nodeStatusEl.textContent = "Use a .git repository URL, not a file or release link.";
			return;
		}
		nodeInstallBtn.disabled = true;
		nodeStatusEl.textContent = "Installing…";
		try {
			const res = await api.fetchApi("/v2/customnode/install/git_url", {
				method: "POST",
				body: url,
			});

			if (res.status === 403) {
				nodeStatusEl.textContent = "Git URL install disabled in config.ini.";
				show_message(
					"Set allow_git_url_install = true in config.ini ([default] section)."
				);
				return;
			}

			if (res.status === 200) {
				nodeStatusEl.textContent = "Installed — restart ComfyUI to load the node.";
				infoToast("Custom node installed", url);
				return;
			}

			const errText = await res.text();
			throw new Error(errText || `Server error (${res.status})`);
		} catch (err) {
			nodeStatusEl.textContent = err.message || String(err);
			show_message(`Git install failed:\n${err.message || err}`);
		} finally {
			nodeInstallBtn.disabled = false;
		}
	});

	nodeUrlInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			nodeInstallBtn.click();
		}
	});
	nodeUrlInput.addEventListener("input", syncGitNodeUrlInput);
	nodeUrlInput.addEventListener("paste", () => {
		requestAnimationFrame(syncGitNodeUrlInput);
	});

	root.appendChild(modelSection);
	root.appendChild(nodeSection);

	return {
		element: root,
		onShow: modelImport.onShow,
	};
}

/** @deprecated Use createImportPanel("other") */
export function createImportUrlPanel() {
	return createImportPanel("other");
}
