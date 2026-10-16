import type {
	RecievedCredit,
	ExpandedCredit,
	RecievedCreditRequirement,
	RecievedEvent
} from "$lib/db_types";

// Adding decimals like 2 + 4.4 + 0.9 gives 7.300000000000001 in floating
// point, so credit totals are rounded to the hundredths place.
export function roundCredits(value: number): number {
	return Math.round(value * 100) / 100;
}

export function calculateCredits(
	credits: RecievedCredit[] | ExpandedCredit[] | undefined,
	type: RecievedCredit["type"]
): number {
	let total = 0;
	if (!credits) {
		return 0;
	}
	for (const credit of credits) {
		if (type == credit.type) {
			total += credit.credits;
		}
	}
	return roundCredits(total);
}

export function calculateCreditsByDate(
	credits: RecievedCredit[] | ExpandedCredit[] | undefined,
	type: RecievedCredit["type"],
	sinceDate: Date
): number {
	if (!credits) return 0;

	return credits
		.filter((c) => {
			const createdDate = new Date(c.created);
			return c.type === type && createdDate >= sinceDate;
		})
		.reduce((sum, c) => roundCredits(sum + c.credits), 0);
}

function defaultCreditMap(user: any): Record<RecievedCredit["type"], number> {
	let creditMap: Record<RecievedCredit["type"], number> = {
		event: 0,
		tutoring: 0,
		other: 0
	};

	if (user.graduationYear == 2027) {
		creditMap = { event: 22, tutoring: 6, other: 6 };
		if (user.committees.includes("events")) creditMap = { event: 0, tutoring: 6, other: 4 };
		if (user.committees.includes("operations")) creditMap = { event: 16, tutoring: 6, other: 4 };
		if (user.committees.includes("web")) creditMap = { event: 18, tutoring: 6, other: 4 };
	} else if (user.graduationYear == 2028) {
		creditMap = { event: 18, tutoring: 5, other: 6 };
		if (user.committees.includes("events")) creditMap = { event: 0, tutoring: 5, other: 4 };
		if (user.committees.includes("operations")) creditMap = { event: 12, tutoring: 5, other: 4 };
		if (user.committees.includes("web")) creditMap = { event: 14, tutoring: 5, other: 4 };
	} else if (user.graduationYear == 2029) {
		creditMap = { event: 22, tutoring: 5, other: 6 };
		if (user.committees.includes("events")) creditMap = { event: 0, tutoring: 5, other: 4 };
		if (user.committees.includes("operations")) creditMap = { event: 16, tutoring: 5, other: 4 };
		if (user.committees.includes("web")) creditMap = { event: 18, tutoring: 5, other: 4 };
	}

	return creditMap;
}

export function calculateRequiredCredits(
	user: any,
	type: RecievedCredit["type"],
	requirements?: RecievedCreditRequirement[],
	semesterId?: string
): number {
	if (!user.member) {
		throw new Error("Cannot calculate required credits for a user who is not an ARISTA member.");
	}

	const semesterRequirements = semesterId
		? requirements?.filter(
				(requirement) =>
					requirement.semester === semesterId && requirement.graduationYear === user.graduationYear
			)
		: undefined;
	const matchingCommittee = ["web", "operations", "events"].find((committee) =>
		user.committees.includes(committee)
	);
	const savedRequirement =
		semesterRequirements?.find((requirement) => requirement.committee === matchingCommittee) ??
		semesterRequirements?.find((requirement) => requirement.committee === "general");
	let creditMap = savedRequirement
		? {
				event: savedRequirement.eventCredits,
				tutoring: savedRequirement.tutoringCredits,
				other: savedRequirement.otherCredits
			}
		: defaultCreditMap(user);

	const usesChoiceMode = user?.creditChoice === true;
	if (usesChoiceMode) {
		const oldEvent = creditMap.event;
		creditMap.event = creditMap.tutoring;
		creditMap.tutoring = oldEvent;
	}

	return creditMap[type];
}

export function calculateEventCredits(event: RecievedEvent): number {
	const end_time = new Date(event.end_time.valueOf());
	const start_time = new Date(event.start_time.valueOf());
	end_time.setSeconds(0); // prevent issues with old events having non zero seconds
	start_time.setSeconds(0); // prevent issues with old events having non zero seconds

	const diff_in_ms = Number(end_time) - Number(start_time);
	const half_hours = Math.floor(diff_in_ms / 1000 / 60 / 30);
	const credits = (half_hours / 2) * event.multiplier; // halves are possible here
	return credits;
}
