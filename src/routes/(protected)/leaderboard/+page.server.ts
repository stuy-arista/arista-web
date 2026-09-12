import type { PageServerLoad } from './$types';
import type { RecievedCredit, RecievedPublicUserData } from '$lib/db_types';

export const load = (async ({ locals }) => {
    const users = await locals.pb.collection('publicUsers').getFullList({
        sort: '-created',
        fields: 'id,name' 
    }) as unknown as RecievedPublicUserData[];

    const allCredits = await locals.pb.collection('credits').getFullList() as unknown as RecievedCredit[];

    return {
        users,
        allCredits
    };
}) satisfies PageServerLoad;
