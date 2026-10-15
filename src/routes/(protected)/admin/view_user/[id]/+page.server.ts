import { error } from "@sveltejs/kit";
import {
	CreditSchema,
	StrikeSchema,
	type ExpandedCredit,
	type RecievedStrike,
	type RecievedUser
} from "$lib/db_types.js";
import type { PageServerLoad } from "./$types";
import { isOnCommittee } from "$lib/isOnCommittee";
import { canAccess } from "$lib/adminAccess";
import { fail, superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { getActiveCreditSemester } from "$lib/creditSemesters";
import { CREDIT_CHOICES, createPlannedCredits } from "$lib/server/planCredit";
import { z } from "zod";

const ManualCreditSchema = CreditSchema.pick({
	credits: true,
	manualExplanation: true
})
	.extend({ type: z.enum(CREDIT_CHOICES) })
	.required();

// Get the data, for page load
export const load = (async ({ params, locals }) => {
	const strikeForm = await superValidate(zod(StrikeSchema));
	const creditForm = await superValidate(zod(ManualCreditSchema));
	const user_id = params.id;

	// Unless you throw, always return { form } in load and form actions.

	if (!locals.user) {
		error(401, "You are not logged in.");
	}

	// Tutoring reviewers can open profiles to check who they're reviewing, but
	// only People access can add credits or strikes.
	const canManage = canAccess(locals.user as RecievedUser, "people");
	if (!canManage && !canAccess(locals.user as RecievedUser, "tutoring")) {
		error(401, "You don't have access to this part of the admin area.");
	}

	let user;

	try {
		user = await locals.pb.collection("users").getOne(user_id, { requestKey: null });
		if (!user) {
			error(401, `User with id of "${user_id}" does not exist.`);
		}
	} catch {
		error(401, `User with id of "${user_id}" does not exist.`);
	}

	const [credits, strikes, publicProfile, sessions] = await Promise.all([
		locals.pb.collection("credits").getFullList({
			filter: `user="${user.id}"`,
			expand: "event,session,session.tutoringRequest",
			sort: "-created",
			requestKey: null
		}),
		locals.pb
			.collection("strikes")
			.getFullList({ filter: `strikedUser="${user.id}"`, requestKey: null }),
		// Emails are hidden on the users collection; the public view has them.
		locals.pb
			.collection("publicUsers")
			.getOne(user.id, { fields: "email", requestKey: null })
			.catch(() => undefined),
		// Sessions they tutored or were tutored in, for anyone who can open tutoring review.
		canAccess(locals.user as RecievedUser, "tutoring")
			? locals.pb
					.collection("tutoringSessions")
					.getList(1, 50, {
						filter: `tutor="${user.id}" || tutee="${user.id}"`,
						expand: "tutoringRequest",
						sort: "-created",
						requestKey: null
					})
					.then((result) => result.items)
					.catch(() => [])
			: Promise.resolve(null)
	]);
	const otherIds = [
		...new Set(
			(sessions ?? []).map((session) => (session.tutor === user.id ? session.tutee : session.tutor))
		)
	];
	const others = otherIds.length
		? ((await locals.pb.collection("publicUsers").getFullList({
				filter: otherIds.map((id) => `id="${id}"`).join(" || "),
				fields: "id,name",
				requestKey: null
			})) as unknown as { id: string; name: string }[])
		: [];
	const tutoringSessions = sessions
		? sessions.map((session) => {
				const request = session.expand?.tutoringRequest;
				const role = session.tutor === user.id ? "tutor" : "tutee";
				const otherId = role === "tutor" ? session.tutee : session.tutor;
				return {
					id: session.id as string,
					role,
					otherName: others.find((other) => other.id === otherId)?.name ?? "Unknown",
					label: [request?.class, request?.topic].filter(Boolean).join(": ") || "Tutoring session",
					created: session.created as string,
					isComplete: Boolean(session.isComplete),
					waiting: Boolean(session.tuteeMarkedComplete) && !session.isComplete,
					flagged: Boolean(session.durationWarning),
					fraud: Boolean(session.fraud)
				};
			})
		: null;

	const fullUser = {
		...(user as unknown as RecievedUser),
		email:
			(user as unknown as RecievedUser).email ||
			(publicProfile as { email?: string } | undefined)?.email ||
			"",
		credits: credits as unknown as ExpandedCredit[],
		strikes: strikes as unknown as RecievedStrike[]
	};

	return {
		user: fullUser,
		strikeForm,
		creditForm,
		tutoringSessions,
		canManage,
		isAdmin: isOnCommittee(locals.user as RecievedUser, "admin")
	};
}) satisfies PageServerLoad;

export const actions = {
	set_big_sib: async ({ request, locals, params }) => {
		if (!isOnCommittee(locals.user as RecievedUser, "admin")) {
			return fail(403, { bigSibError: "Only admins can change Big Sib status." });
		}
		const value = (await request.formData()).get("bigSib") === "true";
		try {
			await locals.pb
				.collection("users")
				.update(params.id, { bigSib: value }, { requestKey: null });
		} catch (updateError) {
			console.error(updateError);
			return fail(400, { bigSibError: "Couldn't save Big Sib status. Try again." });
		}
		return { bigSibUpdated: true };
	},
	set_credit_choice: async ({ request, locals, params }) => {
		if (!isOnCommittee(locals.user as RecievedUser, "admin")) {
			return fail(403, { choiceError: "Only admins can change a member's credit focus." });
		}
		const value = (await request.formData()).get("creditChoice");
		if (value !== "true" && value !== "false") {
			return fail(400, { choiceError: "Choose events or tutoring." });
		}
		try {
			await locals.pb.collection("users").update(params.id, { creditChoice: value === "true" });
		} catch (updateError) {
			console.error(updateError);
			return fail(400, { choiceError: "Couldn't save the credit focus. Try again." });
		}
		return { choiceUpdated: true };
	},
	delete_strike: async ({ request, locals, params }) => {
		if (!canAccess(locals.user as RecievedUser, "people")) {
			error(401, "You don't have access to this part of the admin area.");
		}
		const strikeId = String((await request.formData()).get("strikeId") ?? "");
		try {
			const strike = await locals.pb.collection("strikes").getOne(strikeId, { requestKey: null });
			if (strike.strikedUser !== params.id)
				return fail(400, { strikeError: "That strike isn't on this profile." });
			await locals.pb.collection("strikes").delete(strikeId, { requestKey: null });
		} catch (deleteError) {
			console.error(deleteError);
			return fail(400, { strikeError: "Couldn't remove the strike. Try again." });
		}
		return { strikeRemoved: true };
	},
	strike_user: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod(StrikeSchema));
		if (!form.valid) {
			return fail(400, { form });
		}
		const user_id = params.id;

		// Unless you throw, always return { form } in load and form actions.

		if (!locals.user) {
			error(401, "You are not logged in.");
		}

		if (!canAccess(locals.user as RecievedUser, "people")) {
			error(401, "You don't have access to this part of the admin area.");
		}

		let user;

		try {
			user = await locals.pb.collection("users").getOne(user_id, { requestKey: null });
			if (!user) {
				error(401, `User with id of "${user_id}" does not exist.`);
			}
		} catch {
			error(401, `User with id of "${user_id}" does not exist.`);
		}

		const created_strike = await locals.pb.collection("strikes").create(
			{
				strikedUser: user.id,
				reason: form.data.reason,
				weight: form.data.weight
			},
			{ requestKey: null } // requestKey is null here to avoid cancelled requests when successive requests are ran
		);

		return {
			user: user,
			form
		};
	},
	credit_user: async ({ request, locals, params }) => {
		const form = await superValidate(request, zod(ManualCreditSchema));
		if (!form.valid) {
			return fail(400, { form });
		}
		const user_id = params.id;

		// Unless you throw, always return { form } in load and form actions.

		if (!locals.user) {
			error(401, "You are not logged in.");
		}

		if (!canAccess(locals.user as RecievedUser, "people")) {
			error(401, "You don't have access to this part of the admin area.");
		}

		let user;

		try {
			user = await locals.pb.collection("users").getOne(user_id, { requestKey: null });
			if (!user) {
				error(401, `User with id of "${user_id}" does not exist.`);
			}
		} catch {
			error(401, `User with id of "${user_id}" does not exist.`);
		}

		const activeSemester = await getActiveCreditSemester(locals.pb);
		const creditedParts = await createPlannedCredits(
			locals.pb,
			user.id,
			parseFloat(String(form.data.credits)),
			form.data.type,
			form.data.manualExplanation,
			activeSemester.id
		);

		return {
			user: user,
			form,
			creditedParts
		};
	}
};
