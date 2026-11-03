import { useEffect } from 'react';
import { Link } from 'react-router';
import type { LegalBlock, LegalDocument, LegalInline } from './types';

// Legal text is static and never reorders, so list positions are stable keys.

function Inline({ content }: { content: LegalInline[] }) {
  return (
    <>
      {content.map((part, index) => {
        if (typeof part === 'string') return <span key={index}>{part}</span>;
        if ('bold' in part) return <strong key={index} className="font-semibold text-text-primary">{part.bold}</strong>;
        return (
          <Link key={index} to={part.href} className="font-medium text-[#0065B3] underline underline-offset-2">
            {part.link}
          </Link>
        );
      })}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p>
          <Inline content={block.content} />
        </p>
      );
    case 'bullets':
    case 'steps': {
      const List = block.kind === 'bullets' ? 'ul' : 'ol';
      return (
        <List className={`space-y-2 ps-6 ${block.kind === 'bullets' ? 'list-disc' : 'list-decimal'}`}>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline content={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'table':
      // A table from tablet width up; on phones each row becomes a card of label/value pairs.
      return (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border sm:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {block.head.map((heading) => (
                    <th key={heading} scope="col" className="border-b border-border px-4 py-3 font-semibold text-text-primary">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row[0]} className="align-top [&:not(:last-child)>td]:border-b [&>td]:border-border">
                    {row.map((cell, index) => (
                      <td key={index} className="px-4 py-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 sm:hidden">
            {block.rows.map((row) => (
              <dl key={row[0]} className="rounded-xl border border-border bg-white px-4 py-3 text-sm">
                {row.map((cell, index) => (
                  <div key={block.head[index]} className="py-1">
                    <dt className="font-semibold text-text-primary">{block.head[index]}</dt>
                    <dd>{cell}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </>
      );
  }
}

/** A public, sign-in-free legal page; the store listings link here. */
export function LegalDocumentPage({ document: legalDocument }: { document: LegalDocument }) {
  useEffect(() => {
    window.document.title = legalDocument.title;
  }, [legalDocument.title]);

  return (
    <main className="min-h-screen bg-background">
      <article className="mx-auto w-full max-w-3xl px-6 pb-16 pt-12 text-base leading-7 text-text-secondary">
        <header className="mb-10 border-b border-border pb-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-white p-1.5 shadow-sm">
              <img src="/descon-logo.png" alt="Descon" className="h-full w-full object-contain" />
            </div>
            <span className="text-lg font-semibold text-text-primary">MPS Connect</span>
          </div>
          <h1 className="mb-3 text-3xl font-semibold text-text-primary">{legalDocument.title}</h1>
          <p>
            <strong className="font-semibold text-text-primary">Effective date:</strong> {legalDocument.effectiveDate}
          </p>
        </header>

        <div className="space-y-10">
          {legalDocument.sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="text-xl font-semibold text-text-primary">{section.heading}</h2>
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          <Link to="/privacy" className="font-medium text-[#0065B3] underline underline-offset-2">
            Privacy Policy
          </Link>
          <Link to="/terms" className="font-medium text-[#0065B3] underline underline-offset-2">
            Terms and Conditions
          </Link>
        </footer>
      </article>
    </main>
  );
}
