import type { LegalDocument } from './types';

const CONTACT_EMAIL = 'info.mps@descon.com';
const POSTAL_ADDRESS =
  'Descon Engineering Limited, Descon Head Quarters, 18 KM Ferozepur Road, Lahore 54760, Pakistan';

export const privacyPolicy: LegalDocument = {
  title: 'MPS Connect Privacy Policy',
  effectiveDate: '30 October 2026',
  sections: [
    {
      heading: '1. Who we are',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'This Privacy Policy explains how Descon Engineering Limited ("Descon", "we", "us") collects, uses, shares and protects personal information through the MPS Connect mobile app, website and related services (together, "MPS Connect").',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'MPS Connect is used by candidates registered with Descon for recruitment, document verification, onboarding fee payment, visa and work permit processing, and travel for overseas employment.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'You cannot sign up in the app yourself. Descon creates your account from its recruitment records, and only Descon can deactivate or delete it.',
          ],
        },
        {
          kind: 'paragraph',
          content: ['By using MPS Connect, you agree to the handling of your information as described in this policy.'],
        },
      ],
    },
    {
      heading: '2. Information we collect',
      blocks: [
        {
          kind: 'paragraph',
          content: ['We collect only the information needed to process your recruitment and overseas employment.'],
        },
        {
          kind: 'table',
          head: ['Category', 'Examples', 'Where it comes from'],
          rows: [
            ['Identity', 'Full name, CNIC number, passport number, photograph', "Descon's recruitment records, when Descon registers you"],
            ['Contact', 'Mobile number, city, residential address', 'You, or Descon staff'],
            [
              'Documents',
              'Copies of CNIC, passport, educational and experience certificates, police character certificate, medical reports and other requested documents',
              'Uploaded by you or by Descon staff',
            ],
            ['Next of kin', 'Name, mobile number and CNIC of your next of kin or emergency contact', 'You'],
            ['Bank details', 'Bank name, account title, account number and proof of account', 'You'],
            [
              'Recruitment progress',
              'Project, trade, country of deployment, workflow stage, medical result, visa decision, protection date, ticket and flight details',
              'Descon staff and authorized partners',
            ],
            [
              'Payments',
              'Onboarding fee amount, payment status, payment code, order and transaction references',
              'You and our payment provider',
            ],
            [
              'Communications',
              'SMS and automated call records, call outcome, and call transcripts where a call is recorded',
              'Our SMS and calling providers',
            ],
            [
              'Consent and security',
              'Policy acceptance date, IP address, login codes (stored only in scrambled form), sign-in times',
              'The app',
            ],
          ],
        },
        {
          kind: 'paragraph',
          content: [
            { bold: 'What we do not collect:' },
            " we do not collect your card number, card PIN or security code. Card details are entered on our payment provider's secure page and never reach our servers. We do not collect your location, contacts or browsing history.",
          ],
        },
        {
          kind: 'paragraph',
          content: [
            { bold: 'Camera and photos:' },
            ' the app asks for camera or photo access only when you choose to photograph or upload a document. You can refuse and upload the document another way.',
          ],
        },
      ],
    },
    {
      heading: '3. How we use your information',
      blocks: [
        {
          kind: 'paragraph',
          content: ['We use your information only for recruitment, employment and the steps needed to send you to work overseas:'],
        },
        {
          kind: 'bullets',
          items: [
            ['Registering you and confirming your identity when you sign in with your CNIC and a one-time code sent by SMS.'],
            [
              'Collecting, reviewing and verifying your documents, including automatically reading dates and details from document images to speed up review.',
            ],
            ['Processing medical tests, visa and work permit applications, protector (emigration) clearance, tickets and travel.'],
            ['Collecting the onboarding fee and keeping payment records.'],
            ['Sending you updates about your application by SMS and automated phone calls, in English or Urdu.'],
            ['Paying amounts due to you, where bank details are required.'],
            ['Keeping MPS Connect secure, preventing fraud and false documents, and keeping an audit trail of staff actions.'],
            ['Meeting legal, regulatory and client requirements, and responding to lawful requests from authorities.'],
          ],
        },
        {
          kind: 'paragraph',
          content: ['We do not sell your personal information, and we do not use it for advertising.'],
        },
      ],
    },
    {
      heading: '4. Who we share it with',
      blocks: [
        { kind: 'paragraph', content: ['We share your information only where needed for the purposes above.'] },
        {
          kind: 'paragraph',
          content: [{ bold: 'Service providers' }, ' who run parts of MPS Connect for us, under contract, and only for that service:'],
        },
        {
          kind: 'table',
          head: ['Provider', 'What they do', 'What they receive'],
          rows: [
            [
              'Amazon Web Services (AWS)',
              'Hosting, file storage and automatic reading of document images',
              'All information stored in MPS Connect',
            ],
            ['SendPK', 'Sending SMS (login codes and application updates)', 'Mobile number, name and the message details'],
            ['RoboCall', 'Placing automated voice calls', 'Mobile number and the recorded message to play'],
            [
              'KuickPay',
              'Processing the onboarding fee by card or payment code',
              'Name, mobile number, reference number and fee amount',
            ],
          ],
        },
        {
          kind: 'paragraph',
          content: [{ bold: 'Authorized parties in your recruitment' }, ', when your application needs it:'],
        },
        {
          kind: 'bullets',
          items: [
            ['Descon group companies and business units, such as the Qatar business unit.'],
            ['Clients and project owners you are being recruited for.'],
            [
              'Medical centres, embassies, consulates, visa centres, the Bureau of Emigration and Overseas Employment and other government authorities.',
            ],
            ['Travel agents and airlines arranging your travel.'],
          ],
        },
        {
          kind: 'paragraph',
          content: [
            { bold: 'Legal reasons:' },
            " we may disclose information when the law requires it, to protect people's safety, or to prevent fraud.",
          ],
        },
        { kind: 'paragraph', content: ['We do not share your information with anyone for their own marketing.'] },
      ],
    },
    {
      heading: '5. Payments, SMS and automated calls',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            { bold: 'Payments.' },
            " You can pay the onboarding fee by card on KuickPay's secure page, or with a payment code through a mobile wallet, bank app or bank branch. KuickPay handles your card or wallet details under its own privacy policy; we receive only the payment result and references.",
          ],
        },
        {
          kind: 'paragraph',
          content: [
            { bold: 'SMS.' },
            ' We send login codes and updates at important steps of your application. Login codes are needed to use the app.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            { bold: 'Automated calls.' },
            ' We may call you with a recorded message about your application. Where a call is recorded or transcribed, the transcript is kept for up to 90 days and then deleted.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            `To stop non-essential messages or calls, contact us at ${CONTACT_EMAIL}. You may miss important updates about your application if you do.`,
          ],
        },
      ],
    },
    {
      heading: '6. Storage, security and retention',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            { bold: 'Where it is stored.' },
            ' Your information is stored on Amazon Web Services servers, which may be located outside Pakistan. Uploaded documents are kept in private storage and opened only through short-lived, authorized links.',
          ],
        },
        {
          kind: 'paragraph',
          content: [
            { bold: 'How we protect it.' },
            ' We encrypt data in transit (HTTPS) and protect sensitive fields such as CNIC and bank details. Staff see only the information their role needs, and staff actions are recorded in an audit log. Login codes are single-use, expire quickly and are stored only in scrambled form.',
          ],
        },
        { kind: 'paragraph', content: [{ bold: 'How long we keep it.' }] },
        {
          kind: 'table',
          head: ['Information', 'Kept for'],
          rows: [
            [
              'Your profile, documents and recruitment records',
              'While your recruitment or employment with Descon continues, then up to 5 years, unless the law requires longer',
            ],
            ['Payment records', 'As long as tax and accounting law requires'],
            ['Call transcripts', 'Up to 90 days'],
            ['Login codes', 'Until used or expired, a few minutes'],
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'No system is completely secure. If a breach affects your information, we will inform you and the authorities as the law requires.',
          ],
        },
      ],
    },
    {
      heading: '7. Your rights and deleting your account',
      blocks: [
        { kind: 'paragraph', content: ['You can ask us to:'] },
        {
          kind: 'bullets',
          items: [
            ['Show you the personal information we hold about you.'],
            ['Correct information that is wrong or out of date.'],
            ['Delete your account and personal information.'],
            ['Withdraw your consent. This may stop us processing your application.'],
          ],
        },
        {
          kind: 'paragraph',
          content: [
            'There is no delete button in the app, because Descon creates and manages candidate accounts. Deletion is done by Descon at your request.',
          ],
        },
        { kind: 'paragraph', content: [{ bold: 'How to delete your account and data:' }] },
        {
          kind: 'steps',
          items: [
            [`Email ${CONTACT_EMAIL} from any address, with the subject "Delete my MPS Connect account".`],
            ['Include your full name, CNIC number and registered mobile number so we can find your account.'],
            ['We confirm your identity, usually by a code sent to your registered mobile number.'],
            ['We deactivate your account at once and delete your personal information and documents within 30 days.'],
          ],
        },
        {
          kind: 'paragraph',
          content: [
            { bold: 'What we may keep:' },
            ' records the law requires us to keep, such as payment and tax records, emigration and visa records, and the audit log, are kept only for the required period and then deleted. Deleting your account ends your recruitment through MPS Connect.',
          ],
        },
        { kind: 'paragraph', content: ['We reply to all requests within 30 days.'] },
      ],
    },
    {
      heading: '8. Children',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            "MPS Connect is for adults being recruited for employment. It is not meant for anyone under 18, and we do not knowingly collect children's information.",
          ],
        },
      ],
    },
    {
      heading: '9. Changes to this policy',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            'We may update this policy when MPS Connect or the law changes. The latest version is always at this page with its effective date. If a change is significant, we will tell you in the app and may ask you to accept it again.',
          ],
        },
      ],
    },
    {
      heading: '10. Contact us',
      blocks: [
        { kind: 'paragraph', content: ['For questions, requests or complaints about your personal information:'] },
        {
          kind: 'bullets',
          items: [
            [{ bold: 'Email:' }, ` ${CONTACT_EMAIL}`],
            [{ bold: 'Post:' }, ` ${POSTAL_ADDRESS}`],
          ],
        },
      ],
    },
  ],
};
