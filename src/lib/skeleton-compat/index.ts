import { writable } from "svelte/store";
import Accordion from "./Accordion.svelte";
import AccordionItem from "./AccordionItem.svelte";
import AppShell from "./AppShell.svelte";
import Modal from "./Modal.svelte";
import RadioGroup from "./RadioGroup.svelte";
import RadioItem from "./RadioItem.svelte";
import SlideToggle from "./SlideToggle.svelte";

export interface ModalSettings {
	type?: string;
	title?: string;
	body?: string;
	/** Label for the confirming button. Defaults to "Confirm". */
	confirmLabel?: string;
	/** Style the confirming button as destructive. */
	danger?: boolean;
	response?: (result: boolean) => void;
	[key: string]: unknown;
}

export function initializeStores() {
	if (typeof document === "undefined") return;
	document.body.dataset.theme ||= "wintry";
}

/** The confirmation currently on screen, rendered by Modal.svelte in the root layout. */
export const activeModal = writable<ModalSettings | null>(null);

export function getModalStore() {
	return {
		trigger(settings: ModalSettings) {
			if (typeof document === "undefined") {
				settings.response?.(false);
				return;
			}
			activeModal.set(settings);
		}
	};
}

/**
 * Ask in the site's own dialog (never the browser's confirm()) and wait for the
 * answer. Use inside an async enhance callback: `if (!(await confirmDialog({...}))) cancel();`
 */
export function confirmDialog(settings: Omit<ModalSettings, "response">) {
	return new Promise<boolean>((resolve) =>
		getModalStore().trigger({ ...settings, response: resolve })
	);
}

export { Accordion, AccordionItem, AppShell, Modal, RadioGroup, RadioItem, SlideToggle };
