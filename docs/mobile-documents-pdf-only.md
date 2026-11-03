# Mobile documents: PDF-only uploads

## What candidates see now

At the client's request, the mobile Documents screen accepts one scanned
PDF per document:

- Every document offers a single **Choose file** button, and the picker shows
  PDF files only. The accepted-files hint reads "PDF, up to …".
- A two-page or two-sided document (passport, CNIC, next of kin's CNIC, Qatar
  driving licence) shows one option, **Scan PDF** (Urdu: "اسکین PDF"), already
  selected. The candidate uploads one PDF with both pages or sides in it.
- **Take photo**, **Choose from gallery** and **Separate photos** (front and
  back as separate images) are not shown.

## What is hidden, not removed

Nothing was deleted. The photo features are still fully implemented and
tested:

- Camera capture and gallery picking, with their permission prompts and
  "Open Settings" notices (`useDocumentUpload.ts`, `DocumentUploadPanel.tsx`).
- Separate front/back (or page 1/page 2) uploads for pair documents.
- JPEG/PNG validation and previews.
- The backend still accepts images wherever a requirement's upload rules
  allow them. Today `descon-be/app/services/document_checklists/definitions.rb`
  allows PDF only, but requirement rows that still list image types keep
  working.

## Turning photo uploads back on

All of it is controlled by one switch in
`mobile/src/features/candidate/documents/uploadOptions.ts`:

```ts
export const PDF_ONLY_UPLOADS = true;
```

Set it to `false` to show Take photo / Choose from gallery and the
Separate photos / Scan PDF choice again, for every requirement whose backend
rules accept images. A future photo or selfie feature should start from here.

## Tests

`mobile/src/app/(tabs)/documents/index.test.jsx` runs most of its cases with
the photo options switched back on, so the hidden code stays covered. The
"PDF-only uploads (current client setting)" block checks what candidates see
today.
