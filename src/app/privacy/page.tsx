import BackLink from "@/components/BackLink";

export const metadata = { title: "Privacy Policy — JobWalker" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-white/80">
      <BackLink />
      <h1 className="mt-4 text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="mt-1 text-sm text-white/50">Last updated July 2026</p>

      <p className="mt-6 leading-relaxed">
        JobWalker is built by AI Tech Helper LLC (&quot;we,&quot; &quot;us&quot;),
        Tulsa, OK. This policy explains what we collect when you use the
        JobWalker app and why.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        Information we collect
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>
          <strong>Account info:</strong> name, email, phone number, business
          name, and trade type, provided when you sign up and complete
          onboarding.
        </li>
        <li>
          <strong>Walkthrough content:</strong> audio recordings and photos
          you capture during a job walkthrough, and the transcript and report
          generated from them.
        </li>
        <li>
          <strong>Usage data:</strong> basic technical data (device, app
          version) needed to keep the app working reliably.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-white">
        How we use it
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>
          Your account info and reports are stored so you can view, edit, and
          manage your walkthroughs.
        </li>
        <li>
          A report is only visible to others if you generate and send its
          share link yourself.
        </li>
        <li>
          We do not sell your personal information. We do not use your
          walkthrough content to train AI models.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-white">
        Sharing with AI services
      </h2>
      <p className="mt-3 leading-relaxed">
        To turn a walkthrough into a report, JobWalker shares the following with
        third-party AI providers, and only for that purpose:
      </p>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>
          <strong>OpenAI</strong> — receives your <strong>audio recording</strong>{" "}
          to produce a text transcript.
        </li>
        <li>
          <strong>Anthropic</strong> — receives that <strong>transcript</strong>{" "}
          and your <strong>photos</strong> to write the report.
        </li>
      </ul>
      <p className="mt-3 leading-relaxed">
        <strong>We ask for your permission before any of this is sent.</strong>{" "}
        The first time you open the recorder, JobWalker shows you what data is
        sent and who it goes to, and you must agree before you can record or
        send anything. No audio, photos, or transcripts are shared with OpenAI
        or Anthropic unless you have given that permission.
      </p>
      <p className="mt-3 leading-relaxed">
        Under our agreements with them, OpenAI and Anthropic process your data
        solely to generate your report, do not use it to train their AI models,
        and are contractually required to provide the same or equal protection
        for your data as described in this policy. We confirm that any third
        party we share your data with provides equivalent protection.
      </p>
      <h2 className="mt-8 text-lg font-semibold text-white">
        How we collect your data
      </h2>
      <p className="mt-3 leading-relaxed">
        Audio and photos are collected directly from your device&apos;s
        microphone and camera, only while you are actively recording a
        walkthrough and only after you grant iOS permission. Account details are
        collected from what you enter at sign-up and onboarding. JobWalker does
        not access your photo library, contacts, or location.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        Where it&apos;s stored
      </h2>
      <p className="mt-3 leading-relaxed">
        Account and report data is stored in a hosted Postgres database
        (Neon). Photos and audio recordings are stored via Vercel Blob
        storage. Authentication is handled by Clerk. All of these providers
        process data on our behalf under their own security and privacy
        commitments.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">Your choices</h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>You can edit or delete any walkthrough and its report at any time.</li>
        <li>
          You can delete your account from within the app (tap your profile
          icon → Delete account). This permanently removes your account,
          walkthroughs, reports, photos, and audio.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-white">Contact</h2>
      <p className="mt-3 leading-relaxed">
        Questions about this policy or your data:{" "}
        <a
          href="mailto:aitechnologyhelper@gmail.com"
          className="text-brand hover:underline"
        >
          aitechnologyhelper@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
