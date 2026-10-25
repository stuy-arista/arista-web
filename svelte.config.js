import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: [".svelte"],
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: [vitePreprocess()],

	kit: {
		// Vercel's adapter produces the serverless build output used by this project.
		adapter: adapter({ runtime: "nodejs24.x" }),
		// Check for a new deploy every minute; the root layout then makes the next
		// navigation a full page load, so open tabs don't keep running old code.
		version: { pollInterval: 60_000 }
	}
};
export default config;
