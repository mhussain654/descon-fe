import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { candidateImportClient, type CandidateImportError, type CandidateImportResult } from '../../../../lib/candidate-import-client';
import { validateCsvFile, type CsvFileValidationError } from '../schemas/csvFile';

function randomIdempotencyKey(): string {
  return `candidate-import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Owns the whole import flow's state: the selected file, its client-side
 * validation, and the upload mutation. A fresh idempotency key is generated
 * only when a *new* file is selected, then reused across any retry of that
 * same file -- a network/server failure followed by "Retry" must not risk
 * creating duplicate candidates (AGENTS.md: "Prevent accidental duplicate
 * mutations"; the backend documents Idempotency-Key exactly for this).
 */
export function useCandidateImport() {
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<CsvFileValidationError | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const mutation = useMutation<CandidateImportResult, CandidateImportError, void>({
    mutationFn: () => {
      if (!file) {
        return Promise.reject({ code: 'UNKNOWN' } satisfies CandidateImportError);
      }
      return candidateImportClient.importCandidates(file, idempotencyKey ?? undefined);
    },
  });

  const selectFile = useCallback(
    (nextFile: File | null) => {
      setFile(nextFile);
      setValidationError(validateCsvFile(nextFile));
      setIdempotencyKey(nextFile ? randomIdempotencyKey() : null);
      mutation.reset();
    },
    [mutation]
  );

  const submit = useCallback(() => {
    const error = validateCsvFile(file);
    setValidationError(error);
    if (error) return;
    mutation.mutate();
  }, [file, mutation]);

  const retry = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return { file, validationError, selectFile, submit, retry, mutation };
}
