/** Access ComfyUI frontend UI helpers without deprecated scripts/ui.js imports. */
export function $el(tag, props, ...children) {
	return window.comfyAPI.ui.$el(tag, props, ...children);
}

export const ComfyDialog = window.comfyAPI.ui.ComfyDialog;
