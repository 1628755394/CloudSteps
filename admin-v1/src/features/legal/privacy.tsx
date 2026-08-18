import { LegalPage } from './legal-page'

export function PrivacyPage() {
  return (
    <LegalPage title='Privacy Policy' updatedAt='Last updated: March 26, 2026'>
      <p>
        We take personal information seriously. This policy explains how
        CloudSteps collects, uses, stores, shares, and protects your data, and
        how you can exercise your rights. Please read it before using the
        service.
      </p>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>1. Information we collect</h2>
        <p className='text-muted-foreground'>We may collect:</p>
        <ul className='list-disc space-y-1 ps-5 text-muted-foreground'>
          <li>Account details such as email, display name, and avatar.</li>
          <li>Optional profile data such as phone, region, and timezone.</li>
          <li>
            Logs for security, including device info, activity, IP address, and
            sign-in time.
          </li>
        </ul>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>2. How we use it</h2>
        <p className='text-muted-foreground'>
          We use personal information to provide and improve the service,
          authenticate accounts, investigate issues, and meet legal
          requirements.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>3. Storage and protection</h2>
        <p className='text-muted-foreground'>
          We use reasonable technical and organizational measures such as
          access control, encryption in transit, and audit logs. No internet
          environment is perfectly secure; we work to reduce risk.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>4. Sharing</h2>
        <p className='text-muted-foreground'>
          We do not sell your personal information. We may share, transfer, or
          disclose it only with your consent, when required by law, to protect
          vital interests, or with service providers in the minimum scope
          needed to run the product.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>5. Your rights</h2>
        <p className='text-muted-foreground'>
          You may access, correct, or delete your personal information, and
          update some of it in Settings. Where the law allows, you may also
          withdraw consent or close your account.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>6. Policy updates</h2>
        <p className='text-muted-foreground'>
          We may update this policy from time to time. If a change materially
          affects your rights, we will notify you in a reasonable way.
        </p>
      </section>
    </LegalPage>
  )
}
