<script lang="ts">
	import { tick, untrack } from "svelte";
	import { run } from "svelte/legacy";

	import { enhance } from "$app/forms";
	import { invalidateAll, replaceState } from "$app/navigation";
	import { page } from "$app/state";
	import ErrorComponent from "$lib/components/ErrorComponent.svelte";
	import InputField from "$lib/components/InputField.svelte";
	import type {
		ExpandedTutoringMessage,
		ExpandedTutoringSession,
		RecievedTutoringRequest
	} from "$lib/db_types";
	import { isOnCommittee } from "$lib/isOnCommittee";
	import { currentUser, pb } from "$lib/pocketbase";
	import type { PageData } from "./$types";
	import { superForm } from "sveltekit-superforms";
	import { getModalStore, type ModalSettings } from "$lib/skeleton-compat";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	let tutoringSessions: ExpandedTutoringSession[] = $state([]);
	let myTutoringRequests: RecievedTutoringRequest[] = $derived(
		data.tutoringRequests.filter((v) => v.tutee == $currentUser?.id && !v.isClaimed)
	);

	let selectedSubject = $state("All");
	type TutoringTab = "sessions" | "request" | "queue";
	let activeTutoringTab = $state<TutoringTab>("sessions");
	let initialTutoringTabResolved = $state(false);

	// Separate requests into priority (2+ days old) and recent
	let priorityRequests: RecievedTutoringRequest[] = $state([]);
	let recentRequests: RecievedTutoringRequest[] = $state([]);
	let canDeleteTutoringRequests = $state(false);
	let claimingIds = $state(new Set<string>());
	let deletingRequestIds = $state(new Set<string>());
	let cancelingSessionIds = $state(new Set<string>());
	let sendingMessageSessionIds = $state(new Set<string>());
	let uploadingVerificationSessionIds = $state(new Set<string>());
	let tutoringSessionSubscriptionKey = $derived(
		data.tutoringSessions
			.map((session) => session.id)
			.sort()
			.join(",")
	);

	run(() => {
		const twoDaysAgo = new Date();
		twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

		priorityRequests = data.tutoringRequests.filter(
			(request) =>
				new Date(request.created) <= twoDaysAgo &&
				(selectedSubject === "All" || request.subject === selectedSubject)
		);
		recentRequests = data.tutoringRequests.filter(
			(request) =>
				new Date(request.created) > twoDaysAgo &&
				(selectedSubject === "All" || request.subject === selectedSubject)
		);
	});

	run(() => {
		canDeleteTutoringRequests =
			isOnCommittee($currentUser, "operations") || isOnCommittee($currentUser, "admin");
	});

	$effect(() => {
		tutoringSessions = data.tutoringSessions.map((session) => ({
			...session,
			messages: [...(session.messages ?? [])].sort(compareMessages)
		}));
	});

	$effect(() => {
		if (initialTutoringTabResolved || !$currentUser) return;
		const requested = page.url.searchParams.get("tab");
		const allowed: TutoringTab[] = $currentUser.member
			? ["sessions", "request", "queue"]
			: ["sessions", "request"];
		activeTutoringTab = allowed.includes(requested as TutoringTab)
			? (requested as TutoringTab)
			: data.tutoringSessions.length
				? "sessions"
				: $currentUser.member
					? "queue"
					: "request";
		initialTutoringTabResolved = true;
	});

	// Keep the open tab in the URL so a refresh or shared link opens the same tab.
	$effect(() => {
		if (!initialTutoringTabResolved) return;
		const tab = activeTutoringTab;
		const url = new URL(page.url);
		if (url.searchParams.get("tab") === tab) return;
		url.searchParams.set("tab", tab);
		replaceState(url, page.state);
	});

	$effect(() => {
		const sessionIds = tutoringSessionSubscriptionKey
			.split(",")
			.filter((sessionId) => sessionId.length > 0);
		if (sessionIds.length === 0 || typeof window === "undefined") {
			return;
		}

		let active = true;
		let unsubscribe: (() => Promise<void>) | undefined;
		const syncMessages = async () => {
			try {
				const response = await fetch(
					`/tutoring/messages?sessionIds=${encodeURIComponent(sessionIds.join(","))}`
				);
				if (!response.ok || !active) {
					return;
				}
				const payload = (await response.json()) as { messages?: ExpandedTutoringMessage[] };
				for (const message of payload.messages ?? []) {
					addMessageToSession(message);
				}
			} catch (error) {
				console.error("Failed to synchronize tutoring messages", error);
			}
		};

		const startSubscription = async () => {
			try {
				unsubscribe = await pb.collection("tutoringMessages").subscribe(
					"*",
					({ action, record }) => {
						if (!active || action !== "create") return;
						const message = record as unknown as ExpandedTutoringMessage;
						if (sessionIds.includes(message.session)) addMessageToSession(message);
					},
					{ filter: sessionIds.map((sessionId) => `session="${sessionId}"`).join(" || ") }
				);
			} catch (error) {
				console.error("Failed to start live tutoring messages", error);
			}
		};

		void startSubscription();
		// PocketBase realtime is the primary path. Keep a quiet recovery sync for
		// school networks or suspended mobile tabs that temporarily drop SSE.
		const fallbackIntervalId = window.setInterval(() => {
			if (!document.hidden) void syncMessages();
		}, 30000);
		const onVisibilityChange = () => {
			if (!document.hidden) void syncMessages();
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			active = false;
			void unsubscribe?.();
			window.clearInterval(fallbackIntervalId);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	});

	const requestTutoringFormObj = superForm(
		untrack(() => data.requestTutoringForm),
		{ resetForm: true }
	);
	const { errors: requestTutoringFormErrors, form: requestTutoringForm } = requestTutoringFormObj;

	// Words that don't tell a tutor what to prepare. A topic made only of these
	// ("Unit 3", "test review", "everything") gets a nudge to name the skills.
	const VAGUE_TOPIC_WORDS = new Set(
		"unit units chapter chapters ch lesson lessons topic topics module modules review reviews test tests quiz quizzes exam exams prep studying study for the my a an and of on in to with help pls please everything all above most general stuff things like class homework hw math science english history spanish chem bio physics cs idk".split(
			" "
		)
	);
	const topicIsVague = $derived.by(() => {
		const words = ($requestTutoringForm.topic ?? "").toLowerCase().match(/[a-z]+/g) ?? [];
		return words.length > 0 && words.every((word) => VAGUE_TOPIC_WORDS.has(word));
	});
	const finishTutoringFormObj = superForm(
		untrack(() => data.finishTutoringSessionForm),
		{ resetForm: true }
	);
	const { errors: finishTutoringFormErrors } = finishTutoringFormObj;

	const subjectShortNames: Record<string, string> = {
		"Biology & Environmental Science": "Bio & Env Sci",
		"Computer Science & Technology": "CS & Tech",
		"Foreign Language": "Foreign Lang",
		"Social Studies": "S.S.",
		"Music & Art & Health": "Music/Art/Health"
	};

	function setClaiming(id: string, isClaiming: boolean) {
		const next = new Set(claimingIds);
		if (isClaiming) {
			next.add(id);
		} else {
			next.delete(id);
		}
		claimingIds = next;
	}

	function claimEnhance(id: string) {
		return async ({ cancel }: { cancel: () => void }) => {
			if (claimingIds.has(id)) {
				cancel();
				return;
			}
			setClaiming(id, true);
			return async ({
				result,
				update
			}: {
				result: { type: string };
				update: () => Promise<void>;
			}) => {
				try {
					await update();
					if (result.type === "success") {
						await invalidateAll();
					}
				} finally {
					setClaiming(id, false);
				}
			};
		};
	}

	function setCancelingSession(id: string, isCanceling: boolean) {
		const next = new Set(cancelingSessionIds);
		if (isCanceling) {
			next.add(id);
		} else {
			next.delete(id);
		}
		cancelingSessionIds = next;
	}

	function cancelEnhance(id: string) {
		return async ({ cancel }: { cancel: () => void }) => {
			if (cancelingSessionIds.has(id)) {
				cancel();
				return;
			}
			setCancelingSession(id, true);
			return async ({
				result,
				update
			}: {
				result: { type: string };
				update: () => Promise<void>;
			}) => {
				try {
					await update();
					if (result.type === "success") {
						await invalidateAll();
					}
				} finally {
					setCancelingSession(id, false);
				}
			};
		};
	}

	function setDeletingRequest(id: string, isDeleting: boolean) {
		const next = new Set(deletingRequestIds);
		if (isDeleting) {
			next.add(id);
		} else {
			next.delete(id);
		}
		deletingRequestIds = next;
	}

	function deleteRequestEnhance(id: string) {
		return async ({ cancel }: { cancel: () => void }) => {
			if (deletingRequestIds.has(id)) {
				cancel();
				return;
			}
			setDeletingRequest(id, true);
			return async ({
				result,
				update
			}: {
				result: { type: string };
				update: () => Promise<void>;
			}) => {
				try {
					await update();
					if (result.type === "success") {
						await invalidateAll();
					}
				} finally {
					setDeletingRequest(id, false);
				}
			};
		};
	}

	function setSendingMessage(id: string, isSending: boolean) {
		const next = new Set(sendingMessageSessionIds);
		if (isSending) {
			next.add(id);
		} else {
			next.delete(id);
		}
		sendingMessageSessionIds = next;
	}

	function messageEnhance(id: string) {
		return async ({ cancel }: { cancel: () => void }) => {
			if (sendingMessageSessionIds.has(id)) {
				cancel();
				return;
			}
			setSendingMessage(id, true);
			return async ({
				result,
				update
			}: {
				result: { type: string; data?: { createdMessage?: ExpandedTutoringMessage } };
				update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
			}) => {
				try {
					await update({ reset: true, invalidateAll: false });
					if (result.type === "success" && result.data?.createdMessage) {
						addMessageToSession(result.data.createdMessage);
					}
				} finally {
					setSendingMessage(id, false);
				}
			};
		};
	}

	function setUploadingVerification(id: string, isUploading: boolean) {
		const next = new Set(uploadingVerificationSessionIds);
		if (isUploading) {
			next.add(id);
		} else {
			next.delete(id);
		}
		uploadingVerificationSessionIds = next;
	}

	async function compressVerificationImage(file: File): Promise<File> {
		if (!file.type.startsWith("image/") || file.type === "image/gif") {
			return file;
		}
		// Browsers that can't decode a format (like HEIC outside Safari) upload it as is.
		let imageBitmap: ImageBitmap;
		try {
			imageBitmap = await createImageBitmap(file);
		} catch {
			return file;
		}
		const maxDimension = 1600;
		const scale = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height));
		const width = Math.max(1, Math.round(imageBitmap.width * scale));
		const height = Math.max(1, Math.round(imageBitmap.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) {
			return file;
		}
		context.drawImage(imageBitmap, 0, 0, width, height);

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/webp", 0.78);
		});
		imageBitmap.close();

		if (!blob || blob.size >= file.size) {
			return file;
		}

		return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
			type: "image/webp",
			lastModified: Date.now()
		});
	}

	function verificationEnhance(id: string) {
		return async ({ formData, cancel }: { formData: FormData; cancel: () => void }) => {
			if (uploadingVerificationSessionIds.has(id)) {
				cancel();
				return;
			}
			setUploadingVerification(id, true);
			const file = formData.get("verificationImage");
			if (file instanceof File && file.size > 0) {
				const compressedFile = await compressVerificationImage(file);
				formData.set("verificationImage", compressedFile);
			}
			return async ({ update }: { update: () => Promise<void> }) => {
				try {
					await update();
					await invalidateAll();
				} finally {
					setUploadingVerification(id, false);
				}
			};
		};
	}

	function messageTimestamp(sentAt: Date | string | undefined, created: string | undefined) {
		const timestamp = sentAt ?? created;
		if (!timestamp) {
			return "Just now";
		}
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return "Just now";
		const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
		if (date.toDateString() === new Date().toDateString()) return time;
		return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
	}

	function messageTimeValue(message: ExpandedTutoringMessage) {
		const timestamp = message.sentAt ?? message.created ?? "";
		const time = new Date(timestamp).getTime();
		return Number.isNaN(time) ? 0 : time;
	}

	function isSessionTutee(session: ExpandedTutoringSession) {
		return session.tutee === $currentUser?.id;
	}

	function compareMessages(a: ExpandedTutoringMessage, b: ExpandedTutoringMessage) {
		const timeDiff = messageTimeValue(a) - messageTimeValue(b);
		return timeDiff === 0 ? a.id.localeCompare(b.id) : timeDiff;
	}

	function addMessageToSession(message: ExpandedTutoringMessage) {
		tutoringSessions = tutoringSessions.map((session) => {
			if (session.id !== message.session) {
				return session;
			}
			if (session.messages?.some((existing) => existing.id === message.id)) {
				return session;
			}
			const sender_name =
				message.sender_name ??
				(message.sender === session.tutor ? session.tutor_name : session.tutee_name);
			return {
				...session,
				messages: [...(session.messages ?? []), { ...message, sender_name }].sort(compareMessages)
			};
		});
	}

	function autoScrollMessages(node: HTMLDivElement, messageCount: number | undefined) {
		let previousCount = messageCount ?? 0;
		let shouldFollowMessages = true;

		function updateFollowState() {
			shouldFollowMessages = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
		}

		async function scrollToBottom(behavior: ScrollBehavior = "auto") {
			await tick();
			node.scrollTo({ top: node.scrollHeight, behavior });
		}

		void scrollToBottom();
		node.addEventListener("scroll", updateFollowState, { passive: true });

		return {
			update(nextCount: number | undefined) {
				const currentCount = nextCount ?? 0;
				if (currentCount !== previousCount && shouldFollowMessages) {
					previousCount = currentCount;
					void scrollToBottom("smooth");
				}
				previousCount = currentCount;
			},
			destroy() {
				node.removeEventListener("scroll", updateFollowState);
			}
		};
	}

	const modalStore = getModalStore();

	// Like most messaging apps, a time divider appears when a conversation picks
	// back up after a pause.
	const CHAT_GAP_MS = 60 * 60 * 1000;

	// Ask before submitting a destructive form. The form submits through its
	// normal enhance handler once the person confirms.
	function confirmBeforeSubmit(event: MouseEvent, settings: ModalSettings) {
		const button = event.currentTarget as HTMLButtonElement;
		event.preventDefault();
		modalStore.trigger({
			...settings,
			response: (approved: boolean) => {
				if (approved) button.form?.requestSubmit(button);
			}
		});
	}

	const subjects = [
		"Biology & Environmental Science",
		"Chemistry",
		"Physics",
		"Math",
		"Foreign Language",
		"Social Studies",
		"Computer Science & Technology",
		"English",
		"Music & Art & Health",
		"Others"
	];

	function waitingFor(created: string) {
		const days = Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000);
		if (days <= 0) return "Today";
		if (days === 1) return "Yesterday";
		return `${days} days ago`;
	}

	const openRequestCount = $derived(priorityRequests.length + recentRequests.length);
</script>

<svelte:head><title>Tutoring | ARISTA</title></svelte:head>

{#snippet requestCard(tutoringRequest: RecievedTutoringRequest, isPriority: boolean)}
	<article class="request" class:request--priority={isPriority}>
		<div class="request__top">
			<span class="badge"
				>{subjectShortNames[tutoringRequest.subject] ?? tutoringRequest.subject}</span
			>
			<span class="request__age" class:request__age--old={isPriority}
				>{waitingFor(tutoringRequest.created)}</span
			>
		</div>
		<h3>{tutoringRequest.class}</h3>
		<p class="request__topic">{tutoringRequest.topic}</p>
		<dl>
			<div>
				<dt>Teacher</dt>
				<dd>{tutoringRequest.teacher}</dd>
			</div>
			<div>
				<dt>Free</dt>
				<dd>{tutoringRequest.general_time}</dd>
			</div>
		</dl>
		<div class="request__actions">
			<form
				method="POST"
				action={"?/claim_tutoring_request&id=" + tutoringRequest.id}
				use:enhance={claimEnhance(tutoringRequest.id)}
			>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={claimingIds.has(tutoringRequest.id) ||
						tutoringRequest.tutee === $currentUser?.id}
					aria-busy={claimingIds.has(tutoringRequest.id)}
				>
					{tutoringRequest.tutee === $currentUser?.id
						? "Your request"
						: claimingIds.has(tutoringRequest.id)
							? "Claiming…"
							: "Claim request"}
				</button>
			</form>
			{#if canDeleteTutoringRequests}
				<form
					method="POST"
					action={"?/delete_tutoring_request&id=" + tutoringRequest.id}
					use:enhance={deleteRequestEnhance(tutoringRequest.id)}
				>
					<button
						type="submit"
						class="icon-btn"
						aria-label="Delete request for {tutoringRequest.class}"
						title="Delete request"
						disabled={deletingRequestIds.has(tutoringRequest.id)}
						aria-busy={deletingRequestIds.has(tutoringRequest.id)}
						onclick={(event) =>
							confirmBeforeSubmit(event, {
								title: "Delete this request?",
								body: `The ${tutoringRequest.class} request will be removed from the queue for everyone.`,
								confirmLabel: "Delete request",
								danger: true
							})}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true"
							><path d="M4 7h16M9 7V4.5h6V7M18 7l-.8 12.5H6.8L6 7M10 11v5M14 11v5" /></svg
						>
					</button>
				</form>
			{/if}
		</div>
	</article>
{/snippet}

<main class="page tutoring">
	<header class="page-header">
		<div>
			<h1>Tutoring</h1>
		</div>
		{#if $currentUser?.member}
			<div class="page-header__actions">
				<a href="/tutoring/guide" class="btn">Tutoring guide</a>
			</div>
		{/if}
	</header>

	<div class="tabs" role="group" aria-label="Tutoring">
		<button
			type="button"
			aria-pressed={activeTutoringTab === "sessions"}
			class:active={activeTutoringTab === "sessions"}
			onclick={() => (activeTutoringTab = "sessions")}
			>Your sessions{#if tutoringSessions.length}<span class="tabs__count"
					>{tutoringSessions.length}</span
				>{/if}</button
		>
		<button
			type="button"
			aria-pressed={activeTutoringTab === "request"}
			class:active={activeTutoringTab === "request"}
			onclick={() => (activeTutoringTab = "request")}>Request help</button
		>
		{#if $currentUser?.member}
			<button
				type="button"
				aria-pressed={activeTutoringTab === "queue"}
				class:active={activeTutoringTab === "queue"}
				onclick={() => (activeTutoringTab = "queue")}
				>Open requests{#if openRequestCount}<span class="tabs__count">{openRequestCount}</span
					>{/if}</button
			>
		{/if}
	</div>

	{#if activeTutoringTab === "sessions"}
		<section class="tab-panel" aria-label="Your tutoring sessions">
			{#if tutoringSessions.length == 0}
				<div class="empty-state">
					<h2>No sessions yet.</h2>
					{#if $currentUser?.member}
						<p>Claim an open request and the conversation with your tutee will show up here.</p>
						<button
							type="button"
							class="btn btn-primary"
							onclick={() => (activeTutoringTab = "queue")}>See open requests</button
						>
					{:else}
						<p>Once a tutor picks up your request, you'll be able to message them here.</p>
						<button
							type="button"
							class="btn btn-primary"
							onclick={() => (activeTutoringTab = "request")}>Ask for help</button
						>
					{/if}
				</div>
			{:else}
				<div class="sessions">
					{#each tutoringSessions as tutoringSession (tutoringSession.id)}
						{@const req = tutoringSession.expand.tutoringRequest}
						{@const amTutee = isSessionTutee(tutoringSession)}
						{@const contact = amTutee
							? tutoringSession.tutor_contact
							: tutoringSession.tutee_contact}
						<article class="session panel">
							<div class="session__info">
								<div class="session__who">
									<span class="badge">{amTutee ? "Your tutor" : "Your tutee"}</span>
									<h2>{amTutee ? tutoringSession.tutor_name : tutoringSession.tutee_name}</h2>
									<a
										class="text-link"
										href="mailto:{amTutee
											? tutoringSession.tutor_email
											: tutoringSession.tutee_email}"
										>{amTutee ? tutoringSession.tutor_email : tutoringSession.tutee_email}</a
									>
								</div>

								<div class="session__contact">
									<h3>Contact</h3>
									{#if contact}
										<p>{contact}</p>
									{:else}
										<p class="muted">They haven't added contact info yet. Use the chat or email.</p>
									{/if}
								</div>

								<dl class="session__facts">
									<div>
										<dt>Class</dt>
										<dd>{req.class}</dd>
									</div>
									<div>
										<dt>Subject</dt>
										<dd>{req.subject}</dd>
									</div>
									<div>
										<dt>Teacher</dt>
										<dd>{req.teacher}</dd>
									</div>
									<div>
										<dt>Free</dt>
										<dd>{req.general_time}</dd>
									</div>
									<div class="session__facts-wide">
										<dt>Topic</dt>
										<dd>{req.topic}</dd>
									</div>
								</dl>

								{#if tutoringSession.tuteeMarkedComplete}
									<p class="notice notice--warning">
										{amTutee ? "You logged" : "Your tutee logged"}
										{tutoringSession.durationInHours} hour{tutoringSession.durationInHours === 1
											? ""
											: "s"}.
										{amTutee
											? "The session closes once your tutor uploads a photo or screenshot."
											: "Upload a photo or screenshot from the session to close it out."}
									</p>
								{/if}

								{#if tutoringSession.verificationImage}
									<a
										class="text-link"
										href={"/tutoring/proof/" + tutoringSession.id}
										target="_blank"
										rel="noreferrer">View the uploaded proof</a
									>
								{/if}

								{#if amTutee}
									{#if !tutoringSession.tuteeMarkedComplete}
										<form
											method="POST"
											class="session__task"
											action={"?/finish_tutoring_session&id=" + tutoringSession.id}
											use:enhance
										>
											<h3>Done with your session?</h3>
											<ErrorComponent errors={$finishTutoringFormErrors} />
											<InputField
												form={finishTutoringFormObj}
												field="durationInHours"
												label="How long did you meet, in hours?"
												hint="For example 1 or 1.5."
												placeholder="1"
												type="number"
												inputmode="decimal"
												step="0.1"
												min="0.1"
												max="10"
											/>
											<button type="submit" class="btn btn-primary">Log hours</button>
										</form>
									{/if}
								{:else}
									<form
										method="POST"
										enctype="multipart/form-data"
										class="session__task"
										action={"?/upload_tutoring_verification&id=" + tutoringSession.id}
										use:enhance={verificationEnhance(tutoringSession.id)}
									>
										<h3>Proof of session</h3>
										<label for={"proof-" + tutoringSession.id} class="field-label">
											Photo or screenshot from your session
										</label>
										<input
											id={"proof-" + tutoringSession.id}
											name="verificationImage"
											type="file"
											accept="image/*,.heic,.heif"
											class="file-input"
											required
										/>
										<button
											type="submit"
											class="btn btn-primary"
											disabled={uploadingVerificationSessionIds.has(tutoringSession.id)}
											aria-busy={uploadingVerificationSessionIds.has(tutoringSession.id)}
										>
											{uploadingVerificationSessionIds.has(tutoringSession.id)
												? "Uploading…"
												: tutoringSession.tuteeMarkedComplete
													? "Upload and close session"
													: "Upload proof"}
										</button>
									</form>
								{/if}

								<form
									class="session__cancel"
									method="POST"
									action={"?/cancel_tutoring_session&id=" + tutoringSession.id}
									use:enhance={cancelEnhance(tutoringSession.id)}
								>
									<button
										type="submit"
										class="btn btn-ghost btn-sm"
										disabled={cancelingSessionIds.has(tutoringSession.id) ||
											tutoringSession.tuteeMarkedComplete}
										aria-busy={cancelingSessionIds.has(tutoringSession.id)}
										onclick={(event) =>
											confirmBeforeSubmit(event, {
												title: "Cancel this session?",
												body: amTutee
													? "Your tutor will be released and your request will be deleted. You can always ask again."
													: "Your request goes back into the open queue so another member can pick it up.",
												confirmLabel: "Cancel session",
												danger: true
											})}
									>
										{cancelingSessionIds.has(tutoringSession.id) ? "Canceling…" : "Cancel session"}
									</button>
								</form>
							</div>

							<section
								class="chat"
								aria-label="Messages with {amTutee
									? tutoringSession.tutor_name
									: tutoringSession.tutee_name}"
							>
								{#if tutoringSession.messages?.length}
									<div
										class="chat__feed"
										aria-live="polite"
										use:autoScrollMessages={tutoringSession.messages.length}
									>
										{#each tutoringSession.messages as message, index (message.id)}
											{@const own = message.sender === $currentUser?.id}
											{@const previous = tutoringSession.messages[index - 1]}
											{#if !previous || messageTimeValue(message) - messageTimeValue(previous) > CHAT_GAP_MS}
												<p class="chat__divider">
													<span>{messageTimestamp(message.sentAt, message.created)}</span>
												</p>
											{/if}
											<div
												class="bubble"
												class:bubble--own={own}
												class:bubble--grouped={previous &&
													previous.sender === message.sender &&
													messageTimeValue(message) - messageTimeValue(previous) <= CHAT_GAP_MS}
												title={new Date(message.sentAt ?? message.created ?? "").toLocaleString()}
											>
												{#if !own && !(previous && previous.sender === message.sender && messageTimeValue(message) - messageTimeValue(previous) <= CHAT_GAP_MS)}
													<p class="bubble__name">{message.sender_name}</p>
												{/if}
												<p class="bubble__body">{message.body}</p>
											</div>
										{/each}
									</div>
								{:else}
									<div class="chat__empty">
										<p>Say hi and plan a time. Share links, room numbers, or a Zoom link here.</p>
									</div>
								{/if}
								<form
									method="POST"
									class="chat__composer"
									action={"?/send_tutoring_message&id=" + tutoringSession.id}
									use:enhance={messageEnhance(tutoringSession.id)}
								>
									<label class="sr-only" for={"message-" + tutoringSession.id}>Message</label>
									<textarea
										id={"message-" + tutoringSession.id}
										name="body"
										maxlength="1000"
										rows="2"
										placeholder="Write a message"
										required
										onkeydown={(event) => {
											if (event.key === "Enter" && !event.shiftKey) {
												event.preventDefault();
												(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
											}
										}}></textarea>
									<button
										type="submit"
										class="btn btn-primary"
										disabled={sendingMessageSessionIds.has(tutoringSession.id)}
										aria-busy={sendingMessageSessionIds.has(tutoringSession.id)}
									>
										{sendingMessageSessionIds.has(tutoringSession.id) ? "Sending…" : "Send"}
									</button>
								</form>
							</section>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if activeTutoringTab === "request"}
		<section class="tab-panel ask" aria-labelledby="ask-title">
			<form method="POST" class="panel ask__form" action="?/request_tutoring" use:enhance>
				<h2 id="ask-title" class="section-title">What do you need help with?</h2>
				<ErrorComponent errors={$requestTutoringFormErrors} />
				<div class="ask__grid">
					<div class="ask__field">
						<label for="subjectSelect">Subject</label>
						<select id="subjectSelect" name="subject" required>
							<option value="" disabled selected>Choose a subject</option>
							{#each subjects as subject}<option value={subject}>{subject}</option>{/each}
						</select>
					</div>
					<InputField
						form={requestTutoringFormObj}
						field="class"
						label="Class"
						placeholder="Geometry, Intro to CS"
					/>
					<InputField
						form={requestTutoringFormObj}
						field="teacher"
						label="Your teacher"
						placeholder="Ms. Smith"
					/>
					<InputField
						form={requestTutoringFormObj}
						field="general_time"
						label="When are you free?"
						hint="Weekends and Zoom are fine."
						placeholder="Tuesdays after school, period 6"
					/>
					<div class="ask__wide">
						<InputField
							form={requestTutoringFormObj}
							field="topic"
							label="What topic(s) do you need help on?"
							hintIsNudge={topicIsVague}
							hint={topicIsVague
								? 'Which skills are in it? Name them, like "solving systems by substitution" or "writing a DBQ thesis".'
								: "Name the exact skills, not just the unit."}
							placeholder="Factoring quadratics, preterite vs. imperfect, DBQ thesis writing"
						/>
					</div>
				</div>
				<button type="submit" class="btn btn-primary btn-lg">Send request</button>
			</form>

			<aside class="ask__mine" aria-labelledby="mine-title">
				<h2 id="mine-title" class="section-title">Your open requests</h2>
				{#if myTutoringRequests.length > 0}
					<ul>
						{#each myTutoringRequests as tutoringRequest (tutoringRequest.id)}
							<li>
								<div>
									<strong>{tutoringRequest.class}</strong>
									<span>{tutoringRequest.topic}</span>
									<span class="ask__waiting"
										>Waiting for a tutor, sent {waitingFor(
											tutoringRequest.created
										).toLowerCase()}</span
									>
								</div>
								<form
									method="POST"
									action={"?/delete_tutoring_request&id=" + tutoringRequest.id}
									use:enhance={deleteRequestEnhance(tutoringRequest.id)}
								>
									<button
										class="btn btn-ghost btn-sm"
										type="submit"
										disabled={deletingRequestIds.has(tutoringRequest.id)}
										onclick={(event) =>
											confirmBeforeSubmit(event, {
												title: "Withdraw this request?",
												body: `Your ${tutoringRequest.class} request will be taken out of the queue.`,
												confirmLabel: "Withdraw request",
												danger: true
											})}>Withdraw</button
									>
								</form>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">
						Nothing waiting. Requests you send show up here until a tutor claims them.
					</p>
				{/if}
			</aside>
		</section>
	{/if}

	{#if activeTutoringTab === "queue" && $currentUser?.member}
		<section class="tab-panel" aria-label="Open tutoring requests">
			<div class="queue__filters">
				<label for="subjectFilter" class="sr-only">Subject</label>
				<select id="subjectFilter" bind:value={selectedSubject}>
					<option value="All">All subjects</option>
					{#each subjects as subject}<option value={subject}>{subject}</option>{/each}
				</select>
				<p class="muted">
					{openRequestCount === 0
						? "No open requests"
						: `${openRequestCount} open request${openRequestCount === 1 ? "" : "s"}`}{selectedSubject ===
					"All"
						? ""
						: ` in ${selectedSubject}`}.
				</p>
			</div>

			{#if data.tutoringRequests.length === 0}
				<div class="empty-state">
					<h2>The queue is empty.</h2>
					<p>Every request has a tutor. New ones will show up here as students ask.</p>
				</div>
			{:else if openRequestCount === 0}
				<div class="empty-state">
					<h2>Nothing in {selectedSubject} right now.</h2>
					<button type="button" class="btn" onclick={() => (selectedSubject = "All")}
						>Show all subjects</button
					>
				</div>
			{/if}

			{#if priorityRequests.length > 0}
				<section class="queue__group" aria-labelledby="priority-title">
					<div class="queue__group-head">
						<h2 id="priority-title" class="section-title">Priority requests</h2>
						<p class="muted">These students have been waiting two days or more.</p>
					</div>
					<div class="queue__grid">
						{#each [...priorityRequests].reverse() as tutoringRequest (tutoringRequest.id)}
							{@render requestCard(tutoringRequest, true)}
						{/each}
					</div>
				</section>
			{/if}

			{#if recentRequests.length > 0}
				<section class="queue__group" aria-labelledby="recent-title">
					<div class="queue__group-head">
						<h2 id="recent-title" class="section-title">Newer requests</h2>
					</div>
					<div class="queue__grid">
						{#each recentRequests as tutoringRequest (tutoringRequest.id)}
							{@render requestCard(tutoringRequest, false)}
						{/each}
					</div>
				</section>
			{/if}
		</section>
	{/if}
</main>

<style>
	.tutoring {
		width: min(var(--tool-width), 100% - 2 * var(--gutter));
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		border-bottom: 1px solid var(--line);
	}
	.tabs button {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.75rem;
		padding: 0.5rem 0.9rem;
		border: 0;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition: color var(--dur-2) var(--ease-out);
	}
	.tabs button:hover,
	.tabs button.active {
		color: var(--ink);
	}
	/* All three tabs fit on a phone instead of the last one scrolling away. */
	@media (max-width: 520px) {
		.tabs {
			gap: 0;
			overflow: visible;
		}
		.tabs button {
			flex: 1 1 auto;
			justify-content: center;
			gap: 0.3rem;
			padding: 0.5rem 0.3rem;
			font-size: var(--text-sm);
		}
		.tabs button.active::after {
			right: 0.3rem !important;
			left: 0.3rem !important;
		}
	}
	.tabs button.active::after {
		position: absolute;
		right: 0.9rem;
		bottom: -1px;
		left: 0.9rem;
		height: 2px;
		border-radius: 2px;
		background: var(--flame);
		content: "";
	}
	.tabs__count {
		display: inline-grid;
		place-items: center;
		min-width: 1.4rem;
		height: 1.4rem;
		padding: 0 0.35rem;
		border-radius: var(--radius-pill);
		background: var(--wash);
		color: var(--ink);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.tab-panel {
		animation: panel-in var(--dur-3) var(--ease-out);
	}
	@keyframes panel-in {
		from {
			opacity: 0;
		}
	}

	/* Sessions */
	.sessions {
		display: grid;
		gap: 1.25rem;
	}
	.session {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
		gap: clamp(1.25rem, 3vw, 2.5rem);
		align-items: start;
	}
	.session__info {
		display: grid;
		gap: 1.25rem;
	}
	.session__who {
		display: grid;
		justify-items: start;
		gap: 0.35rem;
	}
	.session__who h2 {
		font-size: var(--text-xl);
	}
	.session__who .text-link {
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.session__facts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem 1.25rem;
		margin: 0;
		padding: 1rem 0;
		border-block: 1px solid var(--line);
	}
	.session__facts-wide {
		grid-column: 1 / -1;
	}
	.session__facts dt,
	.request dt {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.session__facts dd,
	.request dd {
		margin: 0.15rem 0 0;
		font-weight: 500;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.session__task {
		display: grid;
		justify-items: start;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: var(--radius-field);
		background: var(--surface-sunken);
	}
	.session__task > :global(.field) {
		width: 100%;
	}
	.session__task h3 {
		font-family: var(--font-text);
		font-size: var(--text-base);
		font-weight: 650;
		letter-spacing: 0;
	}
	.session__task .field-label {
		display: grid;
		gap: 0.2rem;
	}
	.file-input {
		width: 100%;
		font-size: var(--text-sm);
	}
	.file-input::file-selector-button {
		margin-right: 0.75rem;
		padding: 0.45rem 0.9rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.session__cancel .btn {
		margin-left: -0.85rem;
		color: var(--danger);
	}

	.chat {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		height: min(32rem, 70vh);
		min-height: 22rem;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-field);
		background: var(--surface-sunken);
	}
	.chat__feed {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.chat__divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.75rem 0 0.25rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		text-align: center;
	}
	.chat__divider:first-child {
		margin-top: 0;
	}
	.chat__divider::before,
	.chat__divider::after {
		flex: 1;
		height: 1px;
		background: var(--line);
		content: "";
	}
	.bubble--grouped {
		margin-top: -0.3rem;
	}
	.session__contact {
		padding: 0.85rem 1rem;
		border-radius: var(--radius-field);
		background: var(--wash);
	}
	.session__contact h3 {
		color: var(--muted);
		font-family: var(--font-text);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0;
	}
	.session__contact p {
		margin: 0.2rem 0 0;
		line-height: 1.5;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.chat__empty {
		display: grid;
		place-items: center;
		padding: 1.5rem;
		color: var(--muted);
		text-align: center;
	}
	.chat__empty p {
		max-width: 22rem;
		margin: 0;
	}
	.bubble {
		max-width: min(85%, 28rem);
		padding: 0.55rem 0.8rem;
		border-radius: 16px 16px 16px 6px;
		background: var(--surface);
		box-shadow: 0 0 0 1px var(--line);
		animation: bubble-in var(--dur-3) var(--ease-out);
	}
	.bubble--own {
		align-self: flex-end;
		border-radius: 16px 16px 6px 16px;
		background: var(--action);
		box-shadow: none;
		color: var(--on-action);
	}
	@keyframes bubble-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	.bubble p {
		margin: 0;
	}
	.bubble__name {
		margin-bottom: 0.1rem !important;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 650;
	}
	.bubble__body {
		line-height: 1.45;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.chat__composer {
		display: flex;
		align-items: end;
		gap: 0.5rem;
		padding: 0.6rem;
		border-top: 1px solid var(--line);
		background: var(--surface);
	}
	.chat__composer textarea {
		min-height: 2.75rem !important;
		max-height: 8rem;
		border-radius: 20px !important;
		resize: none !important;
	}

	/* Ask for help */
	.ask {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(16rem, 4fr);
		gap: 1.5rem;
		align-items: start;
	}
	.ask__form {
		display: grid;
		justify-items: start;
		gap: 1.25rem;
	}
	.ask__form > :global(*) {
		width: 100%;
	}
	.ask__form > .btn {
		width: auto;
	}
	.ask__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.1rem;
	}
	.ask__wide {
		grid-column: 1 / -1;
	}
	.ask__field {
		display: grid;
		align-content: start;
		gap: 0.4rem;
	}
	.ask__field label {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.ask__mine ul {
		display: grid;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}
	.ask__mine li {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.85rem 0;
		border-top: 1px solid var(--line);
	}
	.ask__mine li div {
		display: grid;
		gap: 0.1rem;
	}
	.ask__mine li span {
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.ask__mine .ask__waiting {
		color: var(--flame-text);
		font-size: var(--text-xs);
	}
	.ask__mine .muted {
		margin: 0.5rem 0 0;
	}

	/* Queue */
	.queue__filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		margin-bottom: 1.25rem;
	}
	.queue__filters select {
		width: auto !important;
		min-height: 2.5rem !important;
		border-radius: var(--radius-pill) !important;
		font-size: var(--text-sm) !important;
		font-weight: 600 !important;
	}
	.queue__filters p {
		margin: 0;
		font-size: var(--text-sm);
	}
	.queue__group + .queue__group {
		margin-top: 2.25rem;
	}
	.queue__group-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 1rem;
		margin-bottom: 1rem;
	}
	.queue__group-head p {
		margin: 0;
		font-size: var(--text-sm);
	}
	.queue__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 1rem;
	}
	.request {
		display: grid;
		grid-template-rows: auto auto auto 1fr auto;
		gap: 0.6rem;
		padding: 1.15rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
	}
	.request--priority {
		border-color: color-mix(in srgb, var(--flame) 55%, var(--line));
	}
	.request__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.request__age {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.request__age--old {
		color: var(--flame-text);
	}
	.request h3 {
		font-size: var(--text-lg);
		overflow-wrap: anywhere;
	}
	.request__topic {
		margin: 0;
		line-height: 1.45;
	}
	.request dl {
		display: grid;
		gap: 0.5rem;
		margin: 0;
	}
	.request__actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.4rem;
	}
	.icon-btn {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		transition:
			background-color var(--dur-2) var(--ease-out),
			color var(--dur-2) var(--ease-out);
	}
	.icon-btn:hover {
		background: var(--danger-soft);
		color: var(--danger);
	}
	.icon-btn svg {
		width: 1.15rem;
		height: 1.15rem;
		fill: none;
		stroke: currentcolor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.75;
	}

	@media (max-width: 900px) {
		.session,
		.ask {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.ask__grid,
		.session__facts {
			grid-template-columns: 1fr;
		}
	}
</style>
