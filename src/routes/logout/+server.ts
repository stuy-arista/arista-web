import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals }) => {
	locals.pb.authStore.clear();
	return new Response(null, { status: 204 });
};
