<script lang="ts">
    import { calculateCreditsByDate } from "$lib/calculateCredits";
    import type { RecievedUser, RecievedCredit } from "$lib/db_types";

    export let data: { users: RecievedUser[]; allCredits: RecievedCredit[] };

    const SEMESTER_START = new Date("2026-02-07T00:00:00");

    let creditType: "event" | "tutoring" = "tutoring";

    $: leaderboard = data.users
        .map((user) => {
            const userCredits = data.allCredits.filter((c) => c.user === user.id);
            
            const total = calculateCreditsByDate(userCredits, creditType, SEMESTER_START);

            return {
                name: user.name,
                value: total
            };
        })
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
		.slice(0, 20); // Show top 20
</script>

<main class="container mx-auto p-8 space-y-8">
    <div class="text-center space-y-4">
        <div class="space-y-1">
            <h1 class="h1 text-primary-500">
                {creditType === 'tutoring' ? 'Top Tutors' : 'Top Volunteers'}
            </h1>
        </div>

        <div class="radio-group p-1 bg-surface-200-700-token inline-flex rounded-container-token">
            <button
                class="btn btn-sm {creditType === 'tutoring' ? 'variant-filled-primary' : 'hover:variant-soft'}"
                on:click={() => creditType = 'tutoring'}
            >
                Tutors
            </button>
            <button
                class="btn btn-sm {creditType === 'event' ? 'variant-filled-primary' : 'hover:variant-soft'}"
                on:click={() => creditType = 'event'}
            >
                Volunteers
            </button>
        </div>
    </div>

    {#if leaderboard.length === 0}
        <div class="card p-8 text-center max-w-3xl mx-auto">
            <p class="text-lg text-surface-600 dark:text-surface-400">
                No data recorded for this semester yet.
            </p>
        </div>
    {:else}
        <div class="max-w-3xl mx-auto space-y-3">
            {#each leaderboard as entry, i}
                <div class="card p-4 flex items-center justify-between hover:variant-soft-primary transition-all">
                    <div class="flex items-center gap-4">
                        <span class="text-primary-500 font-bold text-lg w-8">#{i + 1}</span>
                        <span class="text-lg">{entry.name}</span>
                    </div>
                    <span class="text-primary-500 font-semibold text-lg">
                        {entry.value}{creditType === 'tutoring' ? ' hours tutored' : ' hours volunteered'}
                    </span>
                </div>
            {/each}
        </div>
    {/if}
</main>

<style>
    .card:hover {
        transform: translateY(-2px);
    }
</style>
