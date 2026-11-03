import type { RecievedEvent } from "$lib/db_types.js";
import type { LayoutServerLoad } from "./$types";

// Every event, newest first, for the calendar and directory.
export const load: LayoutServerLoad = async ({ locals }) => {
	const events = (await locals.pb
		.collection("events")
		.getFullList({ sort: "-created", requestKey: null })) as unknown as RecievedEvent[];

	return {
		events: events.map((event) => ({
			...event,
			start_time: new Date(event.start_time),
			end_time: new Date(event.end_time)
		}))
	};
};
