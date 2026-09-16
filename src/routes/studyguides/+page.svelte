<script lang="ts">
	import { currentUser } from "$lib/pocketbase";
</script>

<main class="container mx-auto p-8 space-y-8">
	<hgroup>
		<h1 class="h1">Study Guides</h1>
		<p>Explore our collection of study guides and study smarter. Access is available using your stuy.edu email.</p>
	</hgroup>

	<section>
		<a
			href="https://drive.google.com/drive/folders/1be4chwo7CKO5FMtIEnk-M9HyczaV9zUb"
			type="button"
			class="btn variant-filled"
		>
			View the Study Guides
		</a>
	</section>
	{#if $currentUser && !$currentUser.is_tutee}
		<section class="card p-4 w-full text-token space-y-4">
			<p class="">
				Please submit any study guides you have created to receive "other" credits. Each study guide
				can receive up to 1 credit, depending on the quality. Please note that this year, we are
				encouraging submissions of all formats, including Quizlets, Kahoots, handwritten notes, and
				more. We hope that offering a wider range of formats will support all students with varying
				learning styles.
			</p>
			<a
				href="https://docs.google.com/forms/d/e/1FAIpQLScUyFV_Z2pCaSeNtmSIG4_pucW76iCUpqJywjdWoPVlKKXJSA/viewform?usp=sharing&ouid=110815166448053536110"
				type="button"
				class="btn variant-filled-tertiary"
			>
				Submit a Study Guide!
			</a>
		</section>
	{/if}
</main>
