# Mobile documents: PDF or photo uploads

## What candidates see now

Candidates can upload each document as a scanned PDF or as photos:

- Every document offers two buttons: **Take photo** and **Choose file** (PDF,
  JPEG or PNG). The accepted-files hint reads "PDF, JPEG, PNG, up to …".
  - On Android, Choose file opens the system file picker, which already
    includes the gallery.
  - On iPhone the Files app doesn't show the Photos library, so Choose file
    first asks **Photo library** or **Files** (`fileSourceChooser.ts`). Where
    only a PDF fits (one combined PDF), it goes straight to Files.
- A two-page or two-sided document (passport, CNIC, next of kin's CNIC, Qatar
  driving licence) offers **Scan PDF** (one PDF with both pages or sides) or
  **Separate photos** (a photo of each page or side).
- The file size limit stays 5 MB per file. There is no maximum pixel size.

## Minimum photo size

A photo must be at least **500 × 500 pixels**, so the document stays
readable. The rule lives in `shared/candidateDocuments/imageResolution.ts`
(`MIN_IMAGE_SIDE`).

- The app checks a photo as soon as it is picked: the camera and gallery
  report its size, and a JPEG/PNG chosen with the file picker is measured with
  `Image.getSize`. A photo that is too small is not added, and the panel says
  how small it was. This applies to document uploads and the bank proof.
- The backend checks it again on upload
  (`Candidates::Documents::ImageDimensions::MINIMUM_SIDE` in descon-be) and
  answers `image_too_small` (422). This also covers older app versions.
- PDFs are never checked for pixel size.

## Switching back to PDF only

The mobile options are controlled by one switch in
`mobile/src/features/candidate/documents/uploadOptions.ts`:

```ts
export const PDF_ONLY_UPLOADS = false;
```

Set it to `true` to hide Take photo, the Photo library choice and the Separate
photos choice again. To refuse photos on the server as well, set the
requirements' accepted content types back to PDF only in
`descon-be/app/services/document_checklists/definitions.rb` (and migrate the
existing rows, as `20261125090000_allow_document_photos_again.rb` did in the
other direction).

## Tests

`mobile/src/app/(tabs)/documents/index.test.jsx` covers photo capture, the
minimum size (camera, file and bank proof) and, in the "PDF-only uploads"
block, the setting that hides the photo options.
