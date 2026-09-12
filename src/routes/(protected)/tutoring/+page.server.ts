import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { setError, superValidate } from "sveltekit-superforms";
import {
	TutoringRequestSchema,
	type RecievedTutoringRequest,
	type RecievedTutoringSession,
	type ExpandedTutoringSession,
	type RecievedPublicUserData,
	type RecievedUser,
	TutoringSessionSchema
} from "$lib/db_types";
import handleError from "$lib/handleError";
import { isOnCommittee } from "$lib/isOnCommittee";
import { z } from "zod";
import { zod } from 'sveltekit-superforms/adapters';

let RequestTutoringSchema = TutoringRequestSchema.omit({ tutee: true }); // don't include tutee in form;
let FinishTutoringSessionSchema = z.object({
	durationInHours: z.string().refine(v => { let n = Number(v); return !isNaN(n) && v?.length > 0; }, { message: "Invalid number. Please enter something similar to: 1, 2, 3, etc." })
});
const claimLocks = new Set<string>();

function canDeleteTutoringRequest(user: RecievedUser | undefined): boolean {
	return isOnCommittee(user, "operations") || isOnCommittee(user, "admin");
}

export const load = async ({ locals, request }) => {
	// Server API:
	const requestTutoringForm = await superValidate(zod(RequestTutoringSchema));
	const finishTutoringSessionForm = await superValidate(zod(FinishTutoringSessionSchema));

	if (!locals?.user?.id) {
		error(401, "User not logged in.");
	}
	const currentUser = locals.user;
	const requestFilter = currentUser.is_tutee
		? `isClaimed=false && tutee="${currentUser.id}"`
		: "isClaimed=false";

	const requests = structuredClone(
		(await locals.pb
			.collection("tutoringRequests")
			.getFullList({ sort: "-created", filter: requestFilter, requestKey: null })) as unknown
	) as RecievedTutoringRequest[];

	const sessions = structuredClone(
		(await locals.pb
			.collection("tutoringSessions")
			.getFullList({ sort: "-created", expand: "tutoringRequest", filter: "isComplete=false", requestKey: null })) as unknown
	) as ExpandedTutoringSession[];

	// only gets rows where tutor or tutee is matching an active session for this user
	// use a viewCollection as to not leak ALL user's names
	const names = (await locals.pb.collection("publicUsers").getFullList()) as unknown as RecievedPublicUserData[];

	const expanded_sessions: ExpandedTutoringSession[] = sessions.map((session) => {
		const tutor_name = names.find((j) => j.id === session.tutor)?.name;
		const tutor_email = names.find((j) => j.id === session.tutor)?.email;
		const tutee_name = names.find((j) => j.id === session.tutee)?.name;
		const tutee_email = names.find((j) => j.id === session.tutee)?.email;

		return { ...session, tutor_name, tutee_name, tutor_email, tutee_email };
	});

	return { requestTutoringForm, finishTutoringSessionForm, tutoringRequests: requests, tutoringSessions: expanded_sessions }; // Unless you throw, always return { form } in load and form actions.
};

export const actions: Actions = {
	request_tutoring: async ({ locals, request }) => {
		const requestTutoringForm = await superValidate(request, zod(RequestTutoringSchema));

		if (!locals?.user?.id) {
			error(401, "User not logged in.");
		}

		if (!locals?.user?.is_tutee) {
			error(401, "User is not a tutee.");
		}
		if (!requestTutoringForm.valid) {
			return fail(400, { requestTutoringForm });
		}

		try {
			await locals.pb
				.collection("tutoringRequests")
				.create({ ...requestTutoringForm.data, tutee: locals.user.id });
		} catch (caught: unknown) {
			console.error(caught);
			return handleError(caught, requestTutoringForm);
		}

		return { requestTutoringForm };
	},
	delete_tutoring_request: async ({ locals, url }) => {
		if (!locals?.user?.id) {
			error(401, "User not logged in.");
		}

		const tutoring_request_id = url.searchParams.get("id");
		if (!tutoring_request_id) {
			error(400, "A tutoring request ID must be passed in as a parameter to delete it.");
		}

		try {
			const tutoringRequest = structuredClone(
				(await locals.pb.collection("tutoringRequests").getOne(tutoring_request_id)) as unknown
			) as RecievedTutoringRequest;

			const user = locals.user as RecievedUser;
			const isRequestOwner =
				Boolean(user?.is_tutee) && String(tutoringRequest.tutee) === String(user.id);
			const canCommitteeDelete = canDeleteTutoringRequest(user);

			if (!isRequestOwner && !canCommitteeDelete) {
				error(401, "Only the request owner, operations, or admin members can delete tutoring requests.");
			}

			if (tutoringRequest.isClaimed) {
				error(400, "This tutoring request has already been claimed.");
			}

			await locals.pb.collection("tutoringRequests").delete(tutoring_request_id);
		} catch (caught: unknown) {
			console.error(caught);
			throw caught;
		}
	},
	claim_tutoring_request: async ({ locals, request, params, url }) => {
		console.log(request, params, url);
		if (!locals?.user?.id) {
			error(401, "User not logged in.");
		}

		if (locals?.user?.is_tutee) {
			error(401, "A tutee cannot claim a request.");
		}

		const searchParams = url.searchParams;
		const tutoring_request_id = searchParams.get("id");
		if (!tutoring_request_id) {
			error(400, "A tutoring request ID must be passed in as a parameter to claim it.");
		}

		if (claimLocks.has(tutoring_request_id)) {
			error(429, "This tutoring request is currently being claimed. Please try again.");
		}

		claimLocks.add(tutoring_request_id);
		try {
			let tutoringRequest: RecievedTutoringRequest;
			try {
				tutoringRequest = structuredClone(
					(await locals.pb.collection("tutoringRequests").getOne(tutoring_request_id)) as unknown
				) as RecievedTutoringRequest;
			} catch (caught: unknown) {
				console.error(caught);
				throw caught;
			}

			if (tutoringRequest.isClaimed) {
				error(400, "This tutoring request has already been claimed.");
			}

			let existingSession: RecievedTutoringSession | null = null;
			try {
				existingSession = structuredClone(
					(await locals.pb
						.collection("tutoringSessions")
						.getFirstListItem(
							`tutoringRequest="${tutoring_request_id}" && isComplete=false`,
							{ requestKey: null }
						)) as unknown
				) as RecievedTutoringSession;
			} catch (caught: unknown) {
				const status = (caught as { status?: number })?.status;
				if (status !== 404) {
					console.error(caught);
					throw caught;
				}
			}

			if (existingSession) {
				error(400, "This tutoring request has already been claimed.");
			}

			try {
				// create the tutoringSession
				await locals.pb.collection("tutoringSessions").create({
					tutee: tutoringRequest.tutee,
					tutor: locals.user.id,
					tutoringRequest: tutoring_request_id,
					isComplete: false
				});

				// update the tutoring request
				await locals.pb.collection("tutoringRequests").update(tutoring_request_id, { isClaimed: true });
			} catch (caught: unknown) {
				console.error(caught);
				throw caught;
			}
		} finally {
			claimLocks.delete(tutoring_request_id);
		}
	},
	cancel_tutoring_session: async ({ locals, url }) => {
		if (!locals?.user?.id) {
			error(401, "User not logged in.");
		}

		const tutoring_session_id = url.searchParams.get("id");
		if (!tutoring_session_id) {
			error(400, "A tutoring session ID must be passed in as a parameter to cancel it.");
		}

		try {
			const tutoringSession = structuredClone(
				(await locals.pb.collection("tutoringSessions").getOne(tutoring_session_id)) as unknown
			) as RecievedTutoringSession;

			const isTutee = String(tutoringSession.tutee) === String(locals.user.id);
			const isTutor = String(tutoringSession.tutor) === String(locals.user.id);

			if (!isTutee && !isTutor) {
				error(401, "Only the tutor or tutee can cancel this tutoring session.");
			}

			if (tutoringSession.isComplete) {
				error(400, "Completed sessions cannot be cancelled.");
			}

			await locals.pb.collection("tutoringSessions").delete(tutoring_session_id);

			if (tutoringSession.tutoringRequest) {
				if (isTutor) {
					await locals.pb
						.collection("tutoringRequests")
						.update(tutoringSession.tutoringRequest, { isClaimed: false });
				} else {
					await locals.pb.collection("tutoringRequests").delete(tutoringSession.tutoringRequest);
				}
			}
		} catch (caught: unknown) {
			console.error(caught);
			throw caught;
		}
	},
	finish_tutoring_session: async ({ locals, request, params, url }) => {
		if (!locals?.user?.id) {
			error(401, "User not logged in.");
		}

		if (!locals?.user?.is_tutee) {
			error(401, "A non-tutee cannot finish a request.");
		}

		const finishTutoringForm = await superValidate(request, zod(FinishTutoringSessionSchema));

		if (!finishTutoringForm.valid) {
			return fail(400, { finishTutoringForm });
		}

		console.log("Tutoring form is valid: ", finishTutoringForm.data);

		const searchParams = url.searchParams;
		const tutoring_session_id = searchParams.get("id");
		if (!tutoring_session_id) {
			error(400, "A tutoring session ID must be passed in as a parameter to finish it.");
		}

		try {
			// get the tutoring request
			const tutoringSession = structuredClone(
				(await locals.pb.collection("tutoringSessions").getOne(tutoring_session_id)) as unknown
			) as RecievedTutoringSession;
			if (String(tutoringSession.tutee) !== String(locals.user.id)) {
				error(401, "Only the tutee in this session can mark it complete.");
			}

			const durationInHours = Number(finishTutoringForm.data.durationInHours);
			if (Number.isNaN(durationInHours)) {
				error(400, "Duration in hours of a tutoring session cannot be NaN");
			}
			if (durationInHours > 10 || durationInHours <= 0) {
				// checking range here because using the pocketbase schema above is weird
				error(400, "Duration in hours of a tutoring session cannot be <= 0 or > 10");
			}

			await locals.pb.collection("tutoringSessions").update(tutoring_session_id, { isComplete: true, dateCompleted: new Date().toISOString(), durationInHours: finishTutoringForm.data.durationInHours });
		} catch (caught: unknown) {
			console.error(caught);
			throw caught;
		}
		return { finishTutoringForm };
	}
};
