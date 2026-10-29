import { z } from "zod";

type StrictRecordModel = {
	id: string;
	created: string;
	updated: string;
	collectionId: string;
	collectionName: string;
}; // Same as pocketbase's record model, without the [key: string] : any

export const CommitteesSchema = z.union([
	z.literal("web"),
	z.literal("admin"),
	z.literal("events"),
	z.literal("operations")
]);

export const UserSchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	name: z.string().min(3).max(48),
	preferredName: z.string().trim().max(32).optional(),
	avatar: z.string().optional(),
	graduationYear: z.number().min(2023).max(2999),
	osis: z.number().min(1).max(999999999),
	homeroom: z.string().max(4),
	committees: CommitteesSchema.array().max(5),
	member: z.boolean().default(false),
	creditChoice: z.boolean().default(false),
	bigSib: z.boolean().optional(),
	themePreference: z.enum(["system", "light", "dark"]).default("system"),
	muteMessageEmails: z.boolean().default(false),
	adminSections: z
		.array(z.enum(["people", "crediting", "tutoring", "credits", "attendance"]))
		.optional()
});

export const EventSchema = z
	.object({
		name: z.string().min(3).max(64),
		description: z.string().max(4000),
		location: z.string().max(256),
		place: z.string().min(2).max(64),
		intendedVolunteers: z.number().min(1).max(200),
		start_time: z.coerce.date(),
		end_time: z.coerce.date(),
		multiplier: z.number().min(1).max(5).step(0.5).default(1),
		signupStatus: z.boolean().default(false),
		// signed_up: z.string().array(),
		isComplete: z.boolean().default(false)
	})
	.refine((event) => event.end_time > event.start_time, {
		message: "The event has to end after it starts.",
		path: ["end_time"]
	});

export const CreditSchema = z.object({
	credits: z.number(),
	user: z.string(), // id of user
	event: z.string(), // id of event
	session: z.string(), // id of session,
	semester: z.string().optional(),
	type: z.union([z.literal("event"), z.literal("tutoring"), z.literal("other")]),
	manualExplanation: z.string().min(1).optional()
});

export const StrikeSchema = z.object({
	strikedUser: z.string(),
	reason: z.string().min(1).max(256),
	weight: z.number().default(1)
});

export const CreditSemesterSchema = z.object({
	name: z.string().min(3).max(64),
	key: z.string().regex(/^[a-z]+\d{4}$/),
	active: z.boolean().default(false),
	rolloverFrom: z.string().optional(),
	rolloverPercent: z.coerce.number().min(0).max(1).default(1)
});

export const CreditRequirementSchema = z.object({
	semester: z.string(),
	graduationYear: z.number().min(2023).max(2999),
	committee: z.union([
		z.literal("general"),
		z.literal("events"),
		z.literal("operations"),
		z.literal("web")
	]),
	eventCredits: z.number().min(0),
	tutoringCredits: z.number().min(0),
	otherCredits: z.number().min(0)
});

export const TutoringRequestSchema = z.object({
	subject: z.string().min(2).max(64),
	class: z.string().min(2).max(64),
	teacher: z.string().min(2).max(64),
	topic: z.string().min(2).max(64),
	tutee: z.string().min(2).max(64),
	general_time: z.string().min(2).max(512),
	isClaimed: z.boolean().default(false),
	slack_message_ts: z.string().max(64).optional()
});

export const TutoringSessionSchema = z.object({
	tutee: z.string().min(2).max(64),
	tutor: z.string().min(2).max(64),
	tutoringRequest: z.string().min(2).max(64),
	isComplete: z.boolean().default(false),
	tuteeMarkedComplete: z.boolean().default(false),
	dateCompleted: z.coerce.date().optional(),
	durationInHours: z.coerce.number().min(0.5).max(10).optional(),
	verificationImage: z.string().optional(),
	verificationSubmittedAt: z.coerce.date().optional(),
	verificationStorageProvider: z
		.union([z.literal("pocketbase"), z.literal("google_drive")])
		.optional(),
	verificationExternalUrl: z.string().url().optional(),
	durationWarning: z.boolean().default(false),
	durationWarningReason: z.string().optional(),
	flaggedBy: z.string().optional(),
	flaggedAt: z.string().optional(),
	fraud: z.boolean().optional(),
	fraudReason: z.string().optional(),
	fraudBy: z.string().optional(),
	fraudAt: z.string().optional(),
	fraudCreditsRemoved: z.number().optional()
});

export const TutoringMessageSchema = z.object({
	session: z.string().min(2).max(64),
	sender: z.string().min(2).max(64),
	body: z.string().min(1).max(1000),
	sentAt: z.coerce.date().optional()
});

export const ExtraCurricularSchema = z.object({
	organization: z.string().min(2).max(64),
	position: z.string().min(2).max(64),
	description: z.string().min(2).max(512),
	hoursPerWeek: z.string().min(1).max(10),
	weeksPerYear: z.string().min(1).max(10),
	advisorName: z.string().min(2).max(64),
	advisorContact: z.string().min(2).max(64),
	category: z.union([
		z.literal("service_in_stuy"),
		z.literal("service_out_stuy"),
		z.literal("ecs_in_stuy"),
		z.literal("ecs_out_stuy")
	])
});

export const ApplicationSchema = z.object({
	q1: z.preprocess((a) => String(a ?? "").trim(), z.string().min(2).max(1010)),
	q2: z.preprocess((a) => String(a ?? "").trim(), z.string().min(2).max(2010)),
	q3: z.preprocess((a) => String(a ?? "").trim(), z.string().min(2).max(2010)),
	extracurriculars: z.array(ExtraCurricularSchema).min(0).max(20).nullable()
});

export type ExtraCurricular = z.infer<typeof ExtraCurricularSchema>;

export const PublicUserDataSchema = UserSchema.pick({
	email: true,
	name: true,
	preferredName: true
});

export type RecievedUser = z.infer<typeof UserSchema> & StrictRecordModel;
export type RecievedEvent = z.infer<typeof EventSchema> &
	StrictRecordModel & { signed_up: string[]; event_owner: string };
export type RecievedCredit = z.infer<typeof CreditSchema> & StrictRecordModel;
export type RecievedCreditSemester = z.infer<typeof CreditSemesterSchema> & StrictRecordModel;
export type RecievedCreditRequirement = z.infer<typeof CreditRequirementSchema> & StrictRecordModel;
export type RecievedStrike = z.infer<typeof StrikeSchema> & StrictRecordModel;
export type RecievedTutoringRequest = z.infer<typeof TutoringRequestSchema> & StrictRecordModel;
export type RecievedTutoringSession = z.infer<typeof TutoringSessionSchema> & StrictRecordModel;
export type RecievedTutoringMessage = z.infer<typeof TutoringMessageSchema> & StrictRecordModel;
export type RecievedPublicUserData = z.infer<typeof PublicUserDataSchema> & StrictRecordModel;
export type RecievedApplication = z.infer<typeof ApplicationSchema> &
	StrictRecordModel & { applicant: string; submitted: boolean; submitted_time?: string };

export type ExpandedCredit = {
	expand?: {
		session?: ExpandedTutoringSession;
		event?: RecievedEvent;
	};
} & RecievedCredit;

export type ExpandedEvent = {
	expand?: {
		signed_up: Array<RecievedUser | RecievedPublicUserData>;
	};
} & RecievedEvent;

export type OpenUser = RecievedUser & { [x: string | number | symbol]: any };

export type ExpandedTutoringSession = {
	tutee_name?: string;
	tutee_email?: string;
	tutee_contact?: string;
	tutor_name?: string;
	tutor_email?: string;
	tutor_contact?: string;
	messages?: ExpandedTutoringMessage[];
	expand: {
		tutoringRequest: RecievedTutoringRequest;
	};
} & RecievedTutoringSession;

export type ExpandedTutoringMessage = {
	sender_name?: string;
} & RecievedTutoringMessage;

export type RecievedContactCard = { user: string; details: string } & StrictRecordModel;
