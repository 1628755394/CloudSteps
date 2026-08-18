import { LegalPage } from './legal-page'

export function TermsPage() {
  return (
    <LegalPage title='Terms of Service' updatedAt='Effective date: March 26, 2026'>
      <p>
        Welcome to CloudSteps. These terms form a binding agreement between you
        and the CloudSteps operator. Please read them before registering,
        signing in, or using the product. If you do not agree, stop using the
        service immediately.
      </p>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>1. Account</h2>
        <p className='text-muted-foreground'>
          You must provide accurate registration information and keep it
          up to date. You are responsible for safeguarding your credentials,
          including passwords, captcha answers, and tokens.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>2. Services</h2>
        <p className='text-muted-foreground'>
          We provide learning and training features as they appear in the
          product. We may upgrade, change, interrupt, or discontinue services
          and will notify you in a reasonable way.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>3. Acceptable use</h2>
        <p className='text-muted-foreground'>You must not:</p>
        <ul className='list-disc space-y-1 ps-5 text-muted-foreground'>
          <li>Violate applicable laws, regulations, or public order.</li>
          <li>Infringe others’ rights, including privacy and intellectual property.</li>
          <li>Access, disrupt, or damage systems or data without authorization.</li>
          <li>Create or spread illegal or harmful content.</li>
        </ul>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>4. Intellectual property</h2>
        <p className='text-muted-foreground'>
          Interface, graphics, marks, code, and documentation belong to us or
          the respective owners. You may not copy, modify, distribute, reverse
          engineer, or use them for commercial purposes without permission.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>5. Disclaimer</h2>
        <p className='text-muted-foreground'>
          We work to keep the service available, but we do not guarantee
          uninterrupted or error-free operation. To the extent permitted by
          law, we are not liable for outages caused by force majeure, network
          failure, or third parties.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>6. Changes and termination</h2>
        <p className='text-muted-foreground'>
          We may update these terms for legal or business reasons. Updates take
          effect when published. Continued use means you accept the updated
          terms.
        </p>
      </section>
      <section className='space-y-2'>
        <h2 className='text-base font-semibold'>7. Governing law</h2>
        <p className='text-muted-foreground'>
          These terms are governed by the laws of the People’s Republic of
          China. Disputes should first be resolved through discussion; otherwise
          they may be submitted to a court with jurisdiction.
        </p>
      </section>
    </LegalPage>
  )
}
