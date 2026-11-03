export const SITE_ORIGIN = "https://www.stuyarista.org";
export const SITE_NAME = "Stuyvesant ARISTA";
export const SOCIAL_IMAGE = `${SITE_ORIGIN}/images/social-card-2026.jpg`;

type PageMetadata = { title: string; description: string };

// Each page's own link preview card (drawn by /og/page/[slug].png). Pages not
// listed use the general seal card.
const pageCards: Record<string, string> = {
	"/about": "about",
	"/resources": "resources",
	"/faq": "faq",
	"/annual-report": "annual-report",
	"/install": "install",
	"/register": "register"
};
const sectionCards: Record<string, string> = { cram: "cram", freshman: "freshman" };

// Public pages that aren't search results but still get shared.
const sharedPages: Record<string, PageMetadata> = {
	"/register": {
		title: "Create an account | Stuyvesant ARISTA",
		description:
			"Create a free Stuyvesant ARISTA account to request a peer tutor, apply to join, and keep track of everything in one place."
	}
};

export const publicPages: Record<string, PageMetadata> = {
	"/": {
		title: "ARISTA | Stuyvesant High School",
		description:
			"Stuyvesant ARISTA is the school's honor society. Since 1921, members have tutored classmates, served New York City, and looked out for each other."
	},
	"/about": {
		title: "About ARISTA | Stuyvesant High School",
		description:
			"Learn about Stuyvesant ARISTA's peer tutoring, community service, and study resources. Meet the 2026–27 executive council and read the annual report."
	},
	"/resources": {
		title: "Resources | Stuyvesant ARISTA",
		description:
			"Free study guides, Cram Central exam preparation, and freshman resources from Stuyvesant ARISTA, made by students for students."
	},
	"/faq": {
		title: "FAQ | Stuyvesant ARISTA",
		description:
			"Answers to common questions about Stuyvesant ARISTA membership, peer tutoring, volunteering, event sign-ups, and member credits."
	},
	"/annual-report": {
		title: "Annual report | Stuyvesant ARISTA",
		description:
			"Read Stuyvesant ARISTA's 2024–25 annual report, covering a year of peer tutoring, community service, and student-led programs."
	},
	"/install": {
		title: "Add ARISTA to your home screen",
		description:
			"Add Stuyvesant ARISTA to your iPhone, iPad, or Android home screen for quick access to tutoring, events, and member credits."
	}
};

const resourceSections: Record<string, PageMetadata> = {
	cram: {
		title: "Cram Central | Stuyvesant ARISTA",
		description:
			"Prepare for AP exams, finals, and Regents with ARISTA Cram Central, Stuyvesant's student-created exam preparation and review library."
	},
	freshman: {
		title: "Freshman resources | Stuyvesant ARISTA",
		description:
			"Get ready for Stuyvesant with ARISTA's freshman orientation slides and practical resources, including tips for organizing your school email."
	}
};

export function isProductionSite(url: URL) {
	return (
		url.protocol === "https:" && ["www.stuyarista.org", "stuyarista.org"].includes(url.hostname)
	);
}

export function isIndexablePage(url: URL, status = 200, signedIn = false) {
	return (
		isProductionSite(url) &&
		status === 200 &&
		Object.hasOwn(publicPages, url.pathname) &&
		!(url.pathname === "/" && signedIn)
	);
}

export function getPageSeo(url: URL, status = 200, signedIn = false) {
	const section = url.pathname === "/resources" ? url.searchParams.get("section") : null;
	const resource =
		section && Object.hasOwn(resourceSections, section) ? resourceSections[section] : null;
	const metadata = resource ??
		publicPages[url.pathname] ??
		(Object.hasOwn(sharedPages, url.pathname) ? sharedPages[url.pathname] : null) ?? {
			title: SITE_NAME,
			description: "Sign in to Stuyvesant ARISTA to manage tutoring, events, and your account."
		};
	const canonical = new URL(
		Object.hasOwn(publicPages, url.pathname) ? url.pathname : "/",
		SITE_ORIGIN
	);
	if (resource && section) canonical.searchParams.set("section", section);
	const card =
		status === 200
			? section && Object.hasOwn(sectionCards, section)
				? sectionCards[section]
				: Object.hasOwn(pageCards, url.pathname)
					? pageCards[url.pathname]
					: null
			: null;
	return {
		...metadata,
		image: card ? `${SITE_ORIGIN}/og/page/${card}.png` : SOCIAL_IMAGE,
		imageAlt: card
			? `${metadata.title.split(" | ")[0]}, Stuyvesant ARISTA.`
			: "The ARISTA seal and name: Stuyvesant High School Honor Society.",
		canonical: canonical.href,
		indexable: isIndexablePage(url, status, signedIn)
	};
}

export const sitemapUrls = [
	...Object.keys(publicPages).map((path) => new URL(path, SITE_ORIGIN).href),
	`${SITE_ORIGIN}/resources?section=cram`,
	`${SITE_ORIGIN}/resources?section=freshman`
];

export function renderSitemap() {
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url.replaceAll("&", "&amp;")}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export function renderRobots(url: URL) {
	return isProductionSite(url)
		? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
		: "User-agent: *\nDisallow: /\n";
}

export const organizationSchema = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			"@id": `${SITE_ORIGIN}/#organization`,
			name: SITE_NAME,
			url: SITE_ORIGIN,
			logo: `${SITE_ORIGIN}/favicon.png`,
			description: publicPages["/"].description,
			email: "stuyaristanyc@gmail.com",
			address: {
				"@type": "PostalAddress",
				streetAddress: "345 Chambers Street",
				addressLocality: "New York",
				addressRegion: "NY",
				addressCountry: "US"
			}
		},
		{
			"@type": "WebSite",
			"@id": `${SITE_ORIGIN}/#website`,
			name: SITE_NAME,
			alternateName: "ARISTA",
			url: SITE_ORIGIN,
			inLanguage: "en-US",
			publisher: { "@id": `${SITE_ORIGIN}/#organization` }
		}
	]
};
