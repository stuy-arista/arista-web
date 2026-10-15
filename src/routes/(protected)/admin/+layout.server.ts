import type {
	ExpandedCredit,
	OpenUser,
	RecievedCreditRequirement,
	RecievedCreditSemester,
	RecievedPublicUserData,
	RecievedStrike,
	RecievedUser
} from "$lib/db_types.js";
import { activeSemesterCreditTotals } from "$lib/creditSemesters";
import calculateTotalStrikeWeight from "$lib/calculateTotalStrikeWeight";
import type { LayoutServerLoad } from "./$types";

const DIRECTORY_PAGE_SIZES = [25, 50, 100, 150] as const;
const DEFAULT_DIRECTORY_PAGE_SIZE = DIRECTORY_PAGE_SIZES[0];

function quoteFilter(value: string) {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function positiveInteger(value: string | null, fallback: number) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function directoryPageSize(value: string | null) {
	const parsed = positiveInteger(value, DEFAULT_DIRECTORY_PAGE_SIZE);
	return DIRECTORY_PAGE_SIZES.includes(parsed as (typeof DIRECTORY_PAGE_SIZES)[number])
		? parsed
		: DEFAULT_DIRECTORY_PAGE_SIZE;
}

// Columns the People table can sort by. These map straight to user fields;
// the computed ones are worked out from credits, strikes, and emails.
const DATABASE_SORTS: Record<string, string> = {
	name: "name",
	type: "member",
	committees: "committees",
	homeroom: "homeroom",
	class: "graduationYear",
	osis: "osis"
};
const COMPUTED_SORTS = ["email", "event", "tutoring", "other", "strikes"] as const;
type ComputedSort = (typeof COMPUTED_SORTS)[number];

function chunks<T>(items: T[], size: number) {
	return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
		items.slice(index * size, index * size + size)
	);
}

// Get the data needed by the admin route. The directory is deliberately paged:
// sending every account, credit, and strike to the browser becomes expensive quickly.
export const load: LayoutServerLoad = async ({ url, locals }) => {
	const [creditSemesters, creditRequirements] = await Promise.all([
		locals.pb.collection("creditSemesters").getFullList({ sort: "key", requestKey: null }),
		locals.pb.collection("creditRequirements").getFullList({ requestKey: null })
	]);
	const serializedSemesters = structuredClone(
		creditSemesters as unknown
	) as RecievedCreditSemester[];
	const serializedRequirements = structuredClone(
		creditRequirements as unknown
	) as RecievedCreditRequirement[];

	if (url.pathname !== "/admin") {
		return {
			creditSemesters: serializedSemesters,
			creditRequirements: serializedRequirements
		};
	}

	const search = url.searchParams.get("search")?.trim() ?? "";
	const membersOnly = url.searchParams.get("members") === "true";
	const insufficientOnly = url.searchParams.get("insufficient") === "true";
	const bigSibOnly = url.searchParams.get("bigsib") === "true";
	const graduationYears = url.searchParams
		.getAll("year")
		.map(Number)
		.filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100);
	const page = positiveInteger(url.searchParams.get("page"), 1);
	const perPage = directoryPageSize(url.searchParams.get("limit"));
	const filters: string[] = [];
	if (membersOnly || insufficientOnly) filters.push("member=true");
	if (bigSibOnly) filters.push("bigSib=true");
	if (graduationYears.length)
		filters.push(`(${graduationYears.map((year) => `graduationYear=${year}`).join(" || ")})`);

	if (search) {
		const emailMatches = (await locals.pb.collection("publicUsers").getList(1, 100, {
			filter: `email~"${quoteFilter(search)}"`,
			fields: "id",
			requestKey: null
		})) as unknown as { items: Array<{ id: string }> };
		const searchTerms = [
			`name~"${quoteFilter(search)}"`,
			...emailMatches.items.map((user) => `id="${user.id}"`)
		];
		filters.push(`(${searchTerms.join(" || ")})`);
	}

	// Sorting: plain fields sort in the database; credit totals, strikes, and
	// email are computed here, so those sorts load the whole filtered list first.
	const sortKey = url.searchParams.get("sort") ?? "";
	const sortDir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
	const databaseSort = DATABASE_SORTS[sortKey];
	const computedSort = COMPUTED_SORTS.includes(sortKey as ComputedSort)
		? (sortKey as ComputedSort)
		: undefined;
	const sort = databaseSort ? `${sortDir === "desc" ? "-" : ""}${databaseSort},name` : "-created";
	const loadEveryone = insufficientOnly || Boolean(computedSort);

	const userQuery = { sort, filter: filters.join(" && "), requestKey: null };
	let userPage = loadEveryone
		? undefined
		: await locals.pb.collection("users").getList(page, perPage, userQuery);
	// A page past the end (from an old or edited link) shows the real last page.
	if (userPage && page > userPage.totalPages && userPage.totalPages > 0) {
		userPage = await locals.pb.collection("users").getList(userPage.totalPages, perPage, userQuery);
	}
	const candidateUsers = loadEveryone
		? (structuredClone(
				(await locals.pb.collection("users").getFullList(userQuery)) as unknown
			) as RecievedUser[])
		: (structuredClone(userPage?.items as unknown) as RecievedUser[]);

	const candidateIds = candidateUsers.map((user) => user.id);
	const fetchFor = (collection: string, field: string, fields: string) =>
		candidateIds.length
			? Promise.all(
					chunks(candidateIds, 50).map((ids) =>
						locals.pb.collection(collection).getFullList({
							filter: ids.map((id) => `${field}="${id}"`).join(" || "),
							fields,
							requestKey: null
						})
					)
				).then((groups) => groups.flat())
			: Promise.resolve([]);
	const [credits, strikes, publicUsers] = await Promise.all([
		fetchFor("credits", "user", "user,type,credits,semester,created"),
		fetchFor("strikes", "strikedUser", "strikedUser,weight"),
		fetchFor("publicUsers", "id", "id,email")
	]);
	const creditsByUser = new Map<string, ExpandedCredit[]>();
	for (const credit of credits as unknown as ExpandedCredit[]) {
		creditsByUser.set(credit.user, [...(creditsByUser.get(credit.user) ?? []), credit]);
	}
	const strikesByUser = new Map<string, RecievedStrike[]>();
	for (const strike of strikes as unknown as RecievedStrike[]) {
		strikesByUser.set(strike.strikedUser, [
			...(strikesByUser.get(strike.strikedUser) ?? []),
			strike
		]);
	}
	const emailByUser = new Map(
		(publicUsers as unknown as RecievedPublicUserData[]).map((user) => [user.id, user.email])
	);

	const totalsFor = (user: RecievedUser) =>
		activeSemesterCreditTotals(
			creditsByUser.get(user.id) ?? [],
			user,
			serializedSemesters,
			serializedRequirements
		);
	let matchingUsers = insufficientOnly
		? candidateUsers.filter((user) =>
				Object.values(totalsFor(user)).some((total) => total.have < total.required)
			)
		: candidateUsers;
	if (computedSort) {
		const valueOf = (user: RecievedUser): string | number =>
			computedSort === "email"
				? (emailByUser.get(user.id) ?? "").toLowerCase()
				: computedSort === "strikes"
					? calculateTotalStrikeWeight(strikesByUser.get(user.id) ?? [])
					: totalsFor(user)[computedSort].have;
		const direction = sortDir === "desc" ? -1 : 1;
		matchingUsers = [...matchingUsers].sort((a, b) => {
			const left = valueOf(a);
			const right = valueOf(b);
			const order =
				typeof left === "number" && typeof right === "number"
					? left - right
					: String(left).localeCompare(String(right));
			return order * direction || a.name.localeCompare(b.name);
		});
	}
	const totalItems = loadEveryone ? matchingUsers.length : (userPage?.totalItems ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
	const shownPage = Math.min(page, totalPages);
	const users = loadEveryone
		? matchingUsers.slice((shownPage - 1) * perPage, shownPage * perPage)
		: matchingUsers;

	const directoryUsers = users.map(
		(user) =>
			({
				...user,
				email: emailByUser.get(user.id) ?? "",
				credits: creditsByUser.get(user.id) ?? [],
				semesterTotals: totalsFor(user),
				strikes: strikesByUser.get(user.id) ?? []
			}) as OpenUser
	);

	return {
		users: directoryUsers,
		creditSemesters: serializedSemesters,
		creditRequirements: serializedRequirements,
		pagination: {
			page: shownPage,
			perPage,
			totalItems,
			totalPages
		},
		filters: { search, membersOnly, insufficientOnly, bigSibOnly, graduationYears },
		sorting: { key: databaseSort || computedSort ? sortKey : "", dir: sortDir }
	};
};
