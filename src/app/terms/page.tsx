export const metadata = { title: "Terms of Service — JobWalk" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-white/80">
      <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
      <p className="mt-1 text-sm text-white/50">Last updated July 2026</p>

      <p className="mt-6 leading-relaxed">
        These terms govern your use of JobWalk, provided by AI Tech Helper
        LLC (&quot;we,&quot; &quot;us&quot;). By creating an account, you
        agree to them.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">The service</h2>
      <p className="mt-3 leading-relaxed">
        JobWalk lets you record a job-site walkthrough (audio + photos) and
        generates a written report using AI transcription and text
        generation. You&apos;re responsible for the accuracy of what you
        narrate and for reviewing the generated report before sending it to a
        client — JobWalk assists with drafting; it doesn&apos;t replace your
        professional judgment.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">Your account</h2>
      <p className="mt-3 leading-relaxed">
        You&apos;re responsible for the accuracy of the information you
        provide and for keeping your account credentials secure. You can
        delete your account at any time from within the app.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">Your content</h2>
      <p className="mt-3 leading-relaxed">
        You own the recordings, photos, and reports you create. You grant us
        the permission needed to process and store them in order to provide
        the service — for example, sending audio to a transcription provider
        and photos/transcript to an AI model to draft your report.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        Acceptable use
      </h2>
      <p className="mt-3 leading-relaxed">
        Don&apos;t use JobWalk to record or share content you don&apos;t have
        the right to capture, or in a way that violates others&apos;
        privacy or applicable law.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        Disclaimer &amp; liability
      </h2>
      <p className="mt-3 leading-relaxed">
        JobWalk is provided &quot;as is,&quot; without warranties of any
        kind. AI-generated reports may contain errors — review them before
        sending. To the extent permitted by law, AI Tech Helper LLC isn&apos;t
        liable for damages arising from your use of the app or its generated
        content.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">Changes</h2>
      <p className="mt-3 leading-relaxed">
        We may update these terms as the app evolves. Continued use after an
        update means you accept the revised terms.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">Contact</h2>
      <p className="mt-3 leading-relaxed">
        Questions about these terms:{" "}
        <a
          href="mailto:aitechhelper@gmail.com"
          className="text-brand hover:underline"
        >
          aitechhelper@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
