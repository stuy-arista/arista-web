import { error, redirect } from "@sveltejs/kit";
import {
	EventSchema,
	type ExpandedEvent,
	type RecievedCredit,
	type RecievedEvent,
	type RecievedPublicUserData,
	type RecievedUser
} from "$lib/db_types.js";
import type { PageServerLoad } from "./$types";
import { isOnCommittee } from "$lib/isOnCommittee";
import { getActiveCreditSemester } from "$lib/creditSemesters";
import { fail, superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import handleError, { handleGenericError } from "$lib/handleError";

function parseCreditAmount(value: unknown) {
	const amount = typeof value === "number" ? value : Number(value);
	// At most two decimal places, like every other credit amount.
	return Number.isFinite(amount) &&
		amount > 0 &&
		amount <= 100 &&
		Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9
		? amount
		: null;
}

async function ensureEventCommitteeMember(locals: App.Locals) {
	if (!locals.user) error(401, "User not logged in.");
	if (!isOnCommittee(locals.user as RecievedUser, "events")) {
		error(403, "User is not a member of the events committee.");
	}
}

// Get the data, for page load
export const load = (async ({ params, locals }) => {
	const event_id = params.id;

	// Only the events committee sees who signed up. Load just those people's
	// names and emails from the public view instead of every user record.
	const event = await locals.pb.collection("events").getOne(event_id, { requestKey: null });
	if (isOnCommittee(locals.user as RecievedUser, "events") && event.signed_up.length > 0) {
		const filter = event.signed_up.map((id: string) => `id="${id}"`).join(" || ");
		const signedUpUsers = (await locals.pb.collection("publicUsers").getFullList({
			filter,
			fields: "id,name,email,preferredName",
			requestKey: null
		})) as unknown as RecievedPublicUserData[];
		event.expand = { signed_up: signedUpUsers };
	}

	const serialized_event = structuredClone(event as unknown) as ExpandedEvent;
	const serialized_event_with_time = {
		...serialized_event,
		start_time: new Date(serialized_event.start_time),
		end_time: new Date(serialized_event.end_time)
	};

	let is_current_user_signed_up = serialized_event_with_time.signed_up.includes(
		locals?.user?.id as any as string
	);

	// this will only return something for event committee members
	const filterstr = `event="${event_id}"`;
	const credited_users = (await locals.pb
		.collection("credits")
		.getFullList({ filter: filterstr })) as RecievedCredit[];
	const credited_user_ids = credited_users.map((v) => v.user);
	// How much each volunteer got, shown next to "Credited".
	const credited_amounts: Record<string, number> = Object.fromEntries(
		credited_users.map((credit) => [credit.user, credit.credits])
	);

	// Server API:
	const update_form = await superValidate(serialized_event_with_time, zod(EventSchema));

	return {
		event: serialized_event_with_time,
		is_current_user_signed_up,
		credited_user_ids,
		credited_amounts,
		update_form: update_form
	};
}) satisfies PageServerLoad;

export const actions = {
	event_sign_up: async ({ request, locals, params }) => {
		const event_id = params.id;

		if (!locals.user) {
			error(401, "User not logged in.");
		}

		const event = await locals.pb.collection("events").getOne(event_id, { requestKey: null });

		const serialized_event = structuredClone(event as unknown) as RecievedEvent;

		if (serialized_event.isComplete) {
			error(401, "Can't sign up for an already completed event.");
		}

		await locals.pb.send(`/api/arista/events/${event_id}/signup`, {
			method: "POST",
			body: { operation: "signup" },
			requestKey: null
		});
	},
	event_unsign_up: async ({ request, locals, params }) => {
		const event_id = params.id;

		if (!locals.user) {
			error(401, "User not logged in.");
		}

		const event = await locals.pb.collection("events").getOne(event_id, { requestKey: null });

		const serialized_event = structuredClone(event as unknown) as RecievedEvent;

		if (serialized_event.isComplete) {
			error(401, "Can't unsign up from an already completed event.");
		}

		await locals.pb.send(`/api/arista/events/${event_id}/signup`, {
			method: "POST",
			body: { operation: "withdraw" },
			requestKey: null
		});
	},
	giveCreditToUser: async ({ request, locals, params }) => {
		await ensureEventCommitteeMember(locals);
		const json = await request.json().catch(() => ({}));
		const user_id = typeof json.user_id === "string" ? json.user_id : "";
		const credits = parseCreditAmount(json.credits);
		const event_id = params.id;
		if (!user_id || credits === null)
			return fail(400, { message: "Enter a credit amount from 0.01 to 100." });

		const event = await locals.pb.collection<RecievedEvent>("events").getOne(event_id, {
			requestKey: null
		});
		if (!event.signed_up.includes(user_id)) {
			return fail(400, { message: "That person is not signed up for this event." });
		}

		const existing = await locals.pb.collection("credits").getFullList({
			filter: `event="${event_id}" && user="${user_id}"`,
			requestKey: null
		});
		if (existing.length) return fail(409, { message: "This volunteer has already been credited." });

		const activeSemester = await getActiveCreditSemester(locals.pb);
		await locals.pb.collection("credits").create(
			{
				credits: credits,
				user_id: user_id,
				event: event_id,
				user: user_id,
				type: "event",
				semester: activeSemester.id
			},
			{ requestKey: null } // requestKey is null here to avoid cancelled requests when successive requests are ran
		);
		return { credited: 1 };
	},
	creditAllVolunteers: async ({ request, locals, params }) => {
		await ensureEventCommitteeMember(locals);
		const json = await request.json().catch(() => ({}));
		const credits = parseCreditAmount(json.credits);
		if (credits === null) return fail(400, { message: "Enter a credit amount from 0.01 to 100." });

		const event_id = params.id;
		const event = await locals.pb.collection<RecievedEvent>("events").getOne(event_id, {
			requestKey: null
		});

		const existingCredits = (await locals.pb.collection("credits").getFullList({
			filter: `event="${event_id}"`,
			requestKey: null
		})) as RecievedCredit[];
		const creditedUserIds = new Set(existingCredits.map((credit) => credit.user));
		const uncreditedVolunteerIds = event.signed_up.filter((userId) => !creditedUserIds.has(userId));
		if (!uncreditedVolunteerIds.length) {
			return { credited: 0, skipped: event.signed_up.length };
		}

		const activeSemester = await getActiveCreditSemester(locals.pb);
		for (const user_id of uncreditedVolunteerIds) {
			await locals.pb.collection("credits").create(
				{
					credits,
					user_id,
					event: event_id,
					user: user_id,
					type: "event",
					semester: activeSemester.id
				},
				{ requestKey: null }
			);
		}

		return { credited: uncreditedVolunteerIds.length, skipped: creditedUserIds.size };
	},
	mark_event_as_completed: async ({ request, locals, params }) => {
		const event_id = params.id;

		if (!locals.user) {
			error(401, "User not logged in.");
		}

		if (!isOnCommittee(locals.user as RecievedUser, "events")) {
			error(401, "User is not a member of the events committee.");
		}

		await locals.pb.collection<RecievedEvent>("events").update(
			event_id,
			{
				isComplete: true
			},
			{ requestKey: null }
		);
	},
	update_event: async ({ request, locals, params }) => {
		const event_id = params.id;

		if (!locals.user) {
			error(401, "User not logged in.");
		}

		if (!isOnCommittee(locals.user as RecievedUser, "events")) {
			error(401, "User is not a member of the events committee.");
		}

		const form = await superValidate(request, zod(EventSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			form.data.end_time.setSeconds(0); // remove any issues with seconds causing credits to be inaccurate
			form.data.start_time.setSeconds(0); // remove any issues with seconds causing credits to be inaccurate
			const updated_event = await locals.pb.collection("events").update(event_id, form.data);

			return { update_form: form }; // i am struggling to have superform update, so use:enhance is turned off in the form
		} catch (error: unknown) {
			console.error(error);
			return handleError(error, form);
		}
	},
	delete_event: async ({ request, locals, params }) => {
		const event_id = params.id;

		if (!locals.user) {
			error(401, "User not logged in.");
		}

		if (!isOnCommittee(locals.user as RecievedUser, "events")) {
			error(401, "User is not a member of the events committee.");
		}

		try {
			const event = structuredClone(
				await locals.pb.collection("events").getOne(event_id)
			) as RecievedEvent;
			if (String(event.event_owner) !== String(locals.user.id)) {
				error(401, "User must be the event creator to delete it.");
			}

			await locals.pb.collection("events").delete(event_id);
		} catch (error: unknown) {
			console.error(error);
			handleGenericError(error);
		}
		throw redirect(303, "/events");
	}
};
