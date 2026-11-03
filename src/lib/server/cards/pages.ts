import {
	clamp,
	CREAM,
	FLAME,
	FLAME_LIGHT,
	FLAME_TEXT,
	h,
	HEIGHT,
	masthead,
	MIST,
	NAVY,
	NAVY_GLOW,
	NIGHT,
	PAPER,
	seal,
	SEAL,
	SLATE,
	text,
	WIDTH,
	type Node
} from "./kit";

// One link preview card per shareable page, each built around something from
// that page's world: a chat for tutoring, a certificate for applying, a name
// tag for signing up, an answer sheet for exam prep, and so on.

const frame = (style: Record<string, unknown>, children: unknown) =>
	h(
		"div",
		{ width: WIDTH, height: HEIGHT, position: "relative", overflow: "hidden", ...style },
		children
	);

/** Headline and supporting line, the left half of most cards. */
function headline(
	title: string,
	sub: string,
	{ color = "#fff", subColor = MIST, size = 84, width = 600 } = {}
) {
	return h("div", { flexDirection: "column", gap: 22, width }, [
		clamp(title, 3, { size, serif: true, lineHeight: 1.02, color }),
		clamp(sub, 3, { size: 30, lineHeight: 1.35, color: subColor })
	]);
}

// Peer tutoring: a request and a reply, like the chat members use with tutees.
function tutoring() {
	const bubble = (message: string, fromTutor: boolean) =>
		h(
			"div",
			{
				alignSelf: fromTutor ? "flex-end" : "flex-start",
				maxWidth: 380,
				padding: "20px 26px",
				borderRadius: 28,
				...(fromTutor ? { borderBottomRightRadius: 8 } : { borderBottomLeftRadius: 8 }),
				backgroundColor: fromTutor ? SEAL : "#fff",
				boxShadow: "0 10px 30px rgba(22,39,90,0.16)"
			},
			[
				clamp(message, 3, {
					size: 29,
					lineHeight: 1.3,
					color: fromTutor ? "#fff" : NAVY
				})
			]
		);
	return frame(
		{
			padding: "56px 64px",
			backgroundColor: PAPER,
			backgroundImage:
				"linear-gradient(rgba(34,57,125,0.07) 2px, transparent 2px), linear-gradient(90deg, rgba(34,57,125,0.07) 2px, transparent 2px)",
			backgroundSize: "40px 40px",
			justifyContent: "space-between"
		},
		[
			h("div", { flexDirection: "column", justifyContent: "space-between", width: 600 }, [
				masthead("ARISTA peer tutoring", FLAME_TEXT),
				headline(
					"Get a free tutor from a classmate",
					"Ask for help with a class or an upcoming test, and an ARISTA member takes it from there.",
					{
						color: NAVY,
						subColor: SLATE,
						size: 78
					}
				),
				text("stuyarista.org/tutoring", { size: 26, weight: 700, color: SEAL })
			]),
			h("div", { flexDirection: "column", justifyContent: "center", gap: 22, width: 420 }, [
				bubble("Can someone help me with stoichiometry before Friday's test?", false),
				bubble("I can! Want to meet in the library after 10th period?", true)
			])
		]
	);
}

// Applying: an honor society certificate.
function apply() {
	const diamond = h("div", {
		width: 14,
		height: 14,
		backgroundColor: FLAME,
		transform: "rotate(45deg)"
	});
	const rule = h("div", { width: 120, height: 2, backgroundColor: FLAME });
	return frame({ padding: 26, backgroundColor: CREAM }, [
		h(
			"div",
			{
				flexGrow: 1,
				padding: 10,
				border: `3px solid ${FLAME}`,
				borderRadius: 6
			},
			[
				h(
					"div",
					{
						flexGrow: 1,
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: 18,
						border: `1.5px solid rgba(138,83,0,0.45)`,
						borderRadius: 3,
						color: NAVY
					},
					[
						seal(112, 4),
						text("Stuyvesant High School Honor Society", {
							size: 26,
							weight: 700,
							color: FLAME_TEXT,
							marginTop: 6
						}),
						text("Apply to ARISTA", { size: 104, serif: true, lineHeight: 1 }),
						h("div", { alignItems: "center", gap: 18 }, [rule, diamond, rule]),
						text(
							"For current freshmen, sophomores and juniors with a 92 or higher overall average",
							{
								size: 28,
								color: SLATE,
								maxWidth: 820,
								textAlign: "center",
								lineHeight: 1.35
							}
						)
					]
				)
			]
		)
	]);
}

// Creating an account: a "Hello, my name is" name tag on gold.
function register() {
	const tagCard = h(
		"div",
		{
			flexDirection: "column",
			width: 430,
			height: 330,
			borderRadius: 26,
			overflow: "hidden",
			backgroundColor: "#fff",
			transform: "rotate(-5deg)",
			boxShadow: "0 24px 50px rgba(22,39,90,0.35)"
		},
		[
			h(
				"div",
				{
					flexDirection: "column",
					alignItems: "center",
					padding: "22px 0 18px",
					backgroundColor: SEAL,
					color: "#fff"
				},
				[
					text("Hello", { size: 76, serif: true, lineHeight: 1 }),
					text("my name is", { size: 26, weight: 700, color: FLAME_LIGHT, marginTop: 6 })
				]
			),
			h(
				"div",
				{ flexGrow: 1, alignItems: "flex-end", justifyContent: "center", padding: "0 44px 52px" },
				[h("div", { flexGrow: 1, height: 3, backgroundColor: "rgba(22,39,90,0.25)" })]
			)
		]
	);
	return frame(
		{
			padding: "56px 70px",
			backgroundColor: FLAME,
			backgroundImage: "radial-gradient(ellipse 80% 90% at 75% 50%, #f8c978 0%, #f2a93b 70%)",
			alignItems: "center",
			justifyContent: "space-between"
		},
		[
			h(
				"div",
				{ flexDirection: "column", height: "100%", justifyContent: "space-between", width: 580 },
				[
					masthead("Stuyvesant ARISTA", NAVY),
					headline(
						"Create your ARISTA account",
						"Request a tutor, apply to join, and keep everything in one place. It's free.",
						{
							color: NAVY,
							subColor: "#3a2a0a",
							size: 80,
							width: 580
						}
					),
					text("stuyarista.org/register", { size: 26, weight: 700, color: NAVY })
				]
			),
			h("div", { width: 470, justifyContent: "center" }, [tagCard])
		]
	);
}

// About: the founding year, huge and quiet behind the name.
function about() {
	return frame({ backgroundColor: NAVY, backgroundImage: NAVY_GLOW, padding: "56px 70px" }, [
		text("1921", {
			position: "absolute",
			right: -24,
			top: -96,
			size: 330,
			serif: true,
			letterSpacing: -14,
			color: "rgba(248,201,120,0.09)",
			lineHeight: 1
		}),
		h("div", { flexDirection: "column", justifyContent: "space-between", height: "100%" }, [
			masthead("Since 1921"),
			headline(
				"About ARISTA",
				"Stuyvesant's honor society: peer tutoring, community service and the people who make it happen.",
				{
					size: 104,
					width: 760
				}
			),
			text("stuyarista.org/about", { size: 26, weight: 700, color: FLAME_LIGHT })
		])
	]);
}

// Resources: a fan of index cards, one for each kind of resource.
function resources() {
	const card = (label: string, rotate: number, left: number, top: number, color: string) =>
		h(
			"div",
			{
				position: "absolute",
				left,
				top,
				flexDirection: "column",
				width: 340,
				height: 220,
				padding: "22px 26px",
				borderRadius: 14,
				backgroundColor: "#fff",
				transform: `rotate(${rotate}deg)`,
				boxShadow: "0 18px 40px rgba(8,16,44,0.4)",
				borderTop: `14px solid ${color}`
			},
			[
				text(label, { size: 34, serif: true, color: NAVY }),
				...[0, 1, 2, 3].map(() =>
					h("div", { height: 2, marginTop: 30, backgroundColor: "rgba(34,57,125,0.15)" })
				)
			]
		);
	return frame({ backgroundColor: NAVY, backgroundImage: NAVY_GLOW, padding: "56px 70px" }, [
		h(
			"div",
			{ flexDirection: "column", justifyContent: "space-between", height: "100%", width: 560 },
			[
				masthead("Stuyvesant ARISTA"),
				headline(
					"Resources",
					"Free study guides, Cram Central exam prep and freshman tips, made by students for students.",
					{
						size: 100,
						width: 560
					}
				),
				text("stuyarista.org/resources", { size: 26, weight: 700, color: FLAME_LIGHT })
			]
		),
		// Lower cards sit on top so every card's label shows.
		card("Study guides", -11, 690, 60, "#2e7d57"),
		card("Cram Central", -4, 740, 200, FLAME),
		card("Freshman", 7, 790, 340, "#7f9cf5")
	]);
}

// Cram Central: an answer sheet with bubbles filled in.
function cram() {
	const answers = [1, 3, 0, 2, 4, 1];
	const sheet = h(
		"div",
		{
			flexDirection: "column",
			gap: 20,
			width: 430,
			padding: "34px 40px",
			borderRadius: 14,
			backgroundColor: "#fff",
			transform: "rotate(3deg)",
			boxShadow: "0 22px 50px rgba(8,16,44,0.45)",
			borderLeft: `14px solid ${FLAME}`
		},
		answers.map((filled, row) =>
			h("div", { alignItems: "center", gap: 18 }, [
				text(String(row + 1), { size: 24, weight: 700, color: SLATE, width: 26 }),
				...["A", "B", "C", "D", "E"].map((letter, column) =>
					h(
						"div",
						{
							width: 40,
							height: 40,
							borderRadius: 20,
							alignItems: "center",
							justifyContent: "center",
							border: `2.5px solid ${column === filled ? SEAL : "rgba(34,57,125,0.35)"}`,
							backgroundColor: column === filled ? SEAL : "transparent"
						},
						[
							text(letter, {
								size: 18,
								weight: 700,
								color: column === filled ? SEAL : "rgba(34,57,125,0.55)"
							})
						]
					)
				)
			])
		)
	);
	return frame(
		{
			backgroundColor: NAVY,
			backgroundImage: NAVY_GLOW,
			padding: "56px 70px",
			justifyContent: "space-between",
			alignItems: "center"
		},
		[
			h(
				"div",
				{ flexDirection: "column", justifyContent: "space-between", height: "100%", width: 560 },
				[
					masthead("Stuyvesant ARISTA"),
					headline(
						"Cram Central",
						"Review for AP exams, finals and Regents with study material made by Stuyvesant students.",
						{
							size: 100,
							width: 560
						}
					),
					text("stuyarista.org/resources", { size: 26, weight: 700, color: FLAME_LIGHT })
				]
			),
			sheet
		]
	);
}

// Freshman resources: a row of school lockers, one with an ARISTA sticker.
function freshman() {
	const locker = (withSticker: boolean) =>
		h(
			"div",
			{
				flexDirection: "column",
				alignItems: "center",
				width: 150,
				height: 520,
				padding: "26px 0",
				borderRadius: 8,
				backgroundColor: "#2b4a9c",
				border: "3px solid #3a5cb5",
				position: "relative"
			},
			[
				...[0, 1, 2, 3, 4].map(() =>
					h("div", {
						width: 86,
						height: 7,
						borderRadius: 4,
						marginBottom: 10,
						backgroundColor: "#1d3272"
					})
				),
				h("div", {
					position: "absolute",
					right: 22,
					top: 250,
					width: 14,
					height: 60,
					borderRadius: 7,
					backgroundColor: "#c9d3ee"
				}),
				...(withSticker
					? [
							h("div", { position: "absolute", top: 330, left: 34, transform: "rotate(-8deg)" }, [
								seal(80, 4)
							])
						]
					: [])
			]
		);
	return frame(
		{
			backgroundColor: NIGHT,
			padding: "56px 70px",
			justifyContent: "space-between",
			alignItems: "center"
		},
		[
			h(
				"div",
				{ flexDirection: "column", justifyContent: "space-between", height: "100%", width: 580 },
				[
					masthead("Stuyvesant ARISTA"),
					headline(
						"Freshman resources",
						"New to Stuyvesant? Orientation slides and practical tips for your first year.",
						{
							size: 92,
							width: 580
						}
					),
					text("stuyarista.org/resources", { size: 26, weight: 700, color: FLAME_LIGHT })
				]
			),
			h("div", { gap: 14, marginRight: -10 }, [locker(false), locker(true), locker(false)])
		]
	);
}

// FAQ: real questions from the page, under a big question mark.
function faq() {
	const questions = [
		"What is ARISTA?",
		"How do I apply to join ARISTA?",
		"Where are tutoring sessions held?"
	];
	return frame({ backgroundColor: PAPER, padding: "56px 70px", justifyContent: "space-between" }, [
		text("?", {
			position: "absolute",
			right: 40,
			top: -150,
			size: 720,
			serif: true,
			color: "rgba(242,169,59,0.22)",
			lineHeight: 1
		}),
		h(
			"div",
			{ flexDirection: "column", justifyContent: "space-between", height: "100%", width: 760 },
			[
				masthead("Stuyvesant ARISTA", FLAME_TEXT),
				text("Questions, answered.", { size: 92, serif: true, color: NAVY, lineHeight: 1 }),
				h(
					"div",
					{ flexDirection: "column", gap: 14 },
					questions.map((question) =>
						h("div", { alignItems: "center", gap: 18 }, [
							h(
								"div",
								{
									width: 40,
									height: 40,
									borderRadius: 20,
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: SEAL
								},
								[text("Q", { size: 22, weight: 700, color: "#fff" })]
							),
							text(question, { size: 30, weight: 700, color: NAVY })
						])
					)
				)
			]
		)
	]);
}

// Annual report: a report cover with a gold spine.
function annualReport() {
	return frame({ backgroundColor: NIGHT, padding: "40px 0 40px 160px" }, [
		h(
			"div",
			{
				width: 880,
				height: "100%",
				borderRadius: 10,
				overflow: "hidden",
				boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
				transform: "rotate(-2deg)"
			},
			[
				h("div", { width: 46, height: "100%", backgroundColor: FLAME }),
				h("div", { width: 6, height: "100%", backgroundColor: FLAME_TEXT }),
				h(
					"div",
					{
						flexGrow: 1,
						flexDirection: "column",
						justifyContent: "space-between",
						padding: "50px 60px",
						backgroundColor: CREAM,
						color: NAVY
					},
					[
						h("div", { alignItems: "center", gap: 18 }, [
							seal(64),
							text("Stuyvesant ARISTA", { size: 28, weight: 700, color: FLAME_TEXT })
						]),
						h("div", { flexDirection: "column" }, [
							text("Annual report", { size: 96, serif: true, lineHeight: 1 }),
							text("2024–25", {
								size: 150,
								serif: true,
								lineHeight: 1,
								color: SEAL,
								letterSpacing: -4
							})
						]),
						text("A year of peer tutoring, community service and student-led programs", {
							size: 26,
							color: SLATE
						})
					]
				)
			]
		)
	]);
}

// Install: a phone home screen with the ARISTA icon among the apps.
function install() {
	const icons = Array.from({ length: 15 }, (_, index) => index);
	const phone = h(
		"div",
		{
			flexDirection: "column",
			width: 330,
			height: 640,
			marginTop: 70,
			padding: "70px 30px 0",
			borderRadius: 54,
			backgroundColor: "#1d3272",
			backgroundImage: "linear-gradient(160deg, #2a4590 0%, #16275a 70%)",
			border: "10px solid #0a1230",
			boxShadow: "0 30px 60px rgba(0,0,0,0.45)"
		},
		[
			h(
				"div",
				{ flexWrap: "wrap", gap: 22, justifyContent: "center" },
				icons.map((index) =>
					index === 5
						? h("div", { flexDirection: "column", alignItems: "center", gap: 6, width: 56 }, [
								h("div", { borderRadius: 14, boxShadow: `0 0 0 4px ${FLAME_LIGHT}` }, [
									h("div", { borderRadius: 14, overflow: "hidden" }, [seal(56, 0)])
								])
							])
						: h("div", {
								width: 56,
								height: 56,
								borderRadius: 14,
								backgroundColor: "rgba(255,255,255,0.12)"
							})
				)
			)
		]
	);
	return frame(
		{
			backgroundColor: NAVY,
			backgroundImage: NAVY_GLOW,
			padding: "56px 90px 0 70px",
			justifyContent: "space-between"
		},
		[
			h(
				"div",
				{ flexDirection: "column", justifyContent: "space-between", height: 518, width: 620 },
				[
					masthead("Stuyvesant ARISTA"),
					headline(
						"Add ARISTA to your home screen",
						"One tap to tutoring, events and your credits, on iPhone or Android.",
						{
							size: 80,
							width: 620
						}
					),
					text("stuyarista.org/install", { size: 26, weight: 700, color: FLAME_LIGHT })
				]
			),
			phone
		]
	);
}

const STAR = `data:image/svg+xml;base64,${Buffer.from(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${FLAME_TEXT}" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>`
).toString("base64")}`;

// Leaderboard: a podium, no names.
function leaderboard() {
	const step = (place: number, height: number, color: string, numberColor: string) =>
		h(
			"div",
			{
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "flex-start",
				width: 170,
				height,
				paddingTop: 22,
				borderRadius: "14px 14px 0 0",
				backgroundColor: color
			},
			[text(String(place), { size: 96, serif: true, lineHeight: 1, color: numberColor })]
		);
	const medal = h(
		"div",
		{
			width: 92,
			height: 92,
			borderRadius: 46,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: FLAME,
			border: `6px solid ${FLAME_LIGHT}`,
			boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
			marginBottom: 22
		},
		[h("img", {}, undefined, { src: STAR, width: 46, height: 46 })]
	);
	return frame(
		{
			backgroundColor: NAVY,
			backgroundImage: NAVY_GLOW,
			padding: "56px 70px 0",
			justifyContent: "space-between"
		},
		[
			h(
				"div",
				{ flexDirection: "column", justifyContent: "space-between", height: 518, width: 560 },
				[
					masthead("Stuyvesant ARISTA"),
					headline(
						"Leaderboard",
						"The members who've tutored and volunteered the most this semester.",
						{
							size: 100,
							width: 560
						}
					),
					text("For ARISTA members", { size: 26, weight: 700, color: FLAME_LIGHT })
				]
			),
			h("div", { alignItems: "flex-end", gap: 10, alignSelf: "flex-end" }, [
				step(2, 250, "#c9d3ee", NAVY),
				h("div", { flexDirection: "column", alignItems: "center" }, [
					medal,
					step(1, 340, FLAME, NAVY)
				]),
				step(3, 180, "#7f9cf5", NAVY)
			])
		]
	);
}

// Settings: the real settings, as switches and a field.
function settings() {
	const toggle = (on: boolean) =>
		h(
			"div",
			{
				width: 76,
				height: 42,
				padding: 5,
				borderRadius: 21,
				backgroundColor: on ? SEAL : "rgba(34,57,125,0.2)",
				justifyContent: on ? "flex-end" : "flex-start"
			},
			[h("div", { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff" })]
		);
	const row = (label: string, control: Node, last = false) =>
		h(
			"div",
			{
				alignItems: "center",
				justifyContent: "space-between",
				padding: "24px 0",
				borderBottom: last ? "none" : "2px solid rgba(34,57,125,0.1)"
			},
			[text(label, { size: 28, weight: 700, color: NAVY }), control]
		);
	const field = h(
		"div",
		{
			width: 190,
			padding: "8px 18px",
			borderRadius: 12,
			border: "2px solid rgba(34,57,125,0.25)",
			alignItems: "center"
		},
		[
			text("Liz", { size: 26, color: NAVY }),
			h("div", { width: 3, height: 30, marginLeft: 4, backgroundColor: FLAME })
		]
	);
	const panel = h(
		"div",
		{
			flexDirection: "column",
			width: 500,
			padding: "16px 40px",
			borderRadius: 26,
			backgroundColor: "#fff",
			boxShadow: "0 24px 50px rgba(22,39,90,0.18)"
		},
		[
			row("Preferred name", field),
			row("Dark mode", toggle(true)),
			row("Message emails", toggle(false), true)
		]
	);
	return frame(
		{
			backgroundColor: CREAM,
			padding: "56px 70px",
			justifyContent: "space-between",
			alignItems: "center"
		},
		[
			h(
				"div",
				{ flexDirection: "column", justifyContent: "space-between", height: "100%", width: 520 },
				[
					masthead("Stuyvesant ARISTA", FLAME_TEXT),
					headline(
						"Your settings",
						"Your name, theme and which emails you get, all in one place.",
						{
							color: NAVY,
							subColor: SLATE,
							size: 92,
							width: 520
						}
					),
					text("stuyarista.org/settings", { size: 26, weight: 700, color: SEAL })
				]
			),
			panel
		]
	);
}

// Admin: the officer sections as a grid of tiles.
function admin() {
	const sections = [
		"People",
		"Crediting",
		"Tutoring review",
		"Credits & semesters",
		"Attendance",
		"Permissions"
	];
	const tile = (label: string, index: number) =>
		h(
			"div",
			{
				flexDirection: "column",
				justifyContent: "space-between",
				width: 236,
				height: 150,
				padding: "20px 22px",
				borderRadius: 18,
				backgroundColor: index === 0 ? FLAME : "rgba(255,255,255,0.07)",
				border: index === 0 ? "none" : "2px solid rgba(201,211,238,0.18)"
			},
			[
				h("div", {
					width: 40,
					height: 6,
					borderRadius: 3,
					backgroundColor: index === 0 ? NAVY : FLAME_LIGHT
				}),
				clamp(label, 2, {
					size: 27,
					weight: 700,
					lineHeight: 1.15,
					color: index === 0 ? NAVY : "#fff"
				})
			]
		);
	return frame(
		{
			backgroundColor: NIGHT,
			padding: "56px 70px",
			justifyContent: "space-between",
			alignItems: "center"
		},
		[
			h(
				"div",
				{ flexDirection: "column", justifyContent: "space-between", height: "100%", width: 420 },
				[
					masthead("Stuyvesant ARISTA"),
					headline(
						"Admin",
						"People, credits, tutoring review and attendance, for ARISTA officers.",
						{
							size: 104,
							width: 420
						}
					),
					text("Officers only", { size: 26, weight: 700, color: FLAME_LIGHT })
				]
			),
			h("div", { flexWrap: "wrap", gap: 16, width: 504 }, sections.map(tile))
		]
	);
}

export const pageCards: Record<string, () => Node> = {
	tutoring,
	apply,
	register,
	about,
	resources,
	cram,
	freshman,
	faq,
	"annual-report": annualReport,
	install,
	leaderboard,
	settings,
	admin
};
