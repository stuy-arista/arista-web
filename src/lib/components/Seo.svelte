<script lang="ts">
	import { getPageSeo, organizationSchema, publicPages, SITE_NAME } from "$lib/seo";

	type LinkPreview = {
		title: string;
		description: string;
		image: string;
		imageAlt: string;
		url: string;
	};

	let {
		url,
		status = 200,
		signedIn = false,
		linkPreview = null
	}: { url: URL; status?: number; signedIn?: boolean; linkPreview?: LinkPreview | null } = $props();
	const seo = $derived(getPageSeo(url, status, signedIn));
	// A page can describe something else in link previews (a shared event link
	// lands on sign-in, but the preview should show the event).
	const share = $derived(
		linkPreview ?? {
			title: seo.title,
			description: seo.description,
			image: seo.image,
			imageAlt: seo.imageAlt,
			url: seo.canonical
		}
	);
	// Escape '<' even if future metadata includes user-supplied text.
	const structuredData = JSON.stringify(organizationSchema).replaceAll("<", "\\u003c");
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	<meta
		name="robots"
		content={seo.indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow"}
	/>
	{#if (url.pathname === "/" || url.pathname === "/about") && !(url.pathname === "/" && signedIn) && status === 200}
		{@html `<script type="application/ld+json">${structuredData}</script>`}
	{/if}
	{#if Object.hasOwn(publicPages, url.pathname) && status === 200 && !(url.pathname === "/" && signedIn)}
		<link rel="canonical" href={seo.canonical} />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:title" content={share.title} />
	<meta property="og:description" content={share.description} />
	<meta property="og:url" content={share.url} />
	<meta property="og:image" content={share.image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={share.imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={share.title} />
	<meta name="twitter:description" content={share.description} />
	<meta name="twitter:image" content={share.image} />
	<meta name="twitter:image:alt" content={share.imageAlt} />
</svelte:head>
