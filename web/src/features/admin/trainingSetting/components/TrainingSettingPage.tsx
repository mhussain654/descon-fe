import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { trainingVideosClient } from '../../../../lib/training-videos-client';
import type { TrainingVideoInput } from '../../../../lib/training-videos-client';

const MAX_BYTES = 250 * 1024 * 1024;
const initial: TrainingVideoInput = { title_en: '', title_ur: '', description_en: '', description_ur: '', position: 0, published: false };

export function TrainingSettingPage() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'training-videos'], queryFn: trainingVideosClient.list });
  const [fields, setFields] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const upload = useMutation({ mutationFn: () => trainingVideosClient.create(fields, file!, setProgress), onSuccess: () => {
    setFields(initial); setFile(null); setMessage(''); setProgress(0); queryClient.invalidateQueries({ queryKey: ['admin', 'training-videos'] });
  } });
  const update = useMutation({ mutationFn: ({ id, changes }: { id: number; changes: Partial<TrainingVideoInput> }) => trainingVideosClient.update(id, changes), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'training-videos'] }) });
  const remove = useMutation({ mutationFn: trainingVideosClient.remove, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'training-videos'] }) });
  const change = (name: keyof TrainingVideoInput, value: string | number | boolean) => setFields(previous => ({ ...previous, [name]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || file.type !== 'video/mp4' || file.size > MAX_BYTES) { setMessage(t('trainingFileInvalid')); return; }
    setMessage(''); setProgress(0); upload.mutate();
  };
  return <div className="mx-auto max-w-[1000px] px-4 py-5 sm:px-6 sm:py-6">
    <div className="mb-5 flex items-center gap-4 rounded-2xl bg-brand px-6 py-7 text-white"><GraduationCap className="h-7 w-7" /><div><h1 className="text-2xl font-semibold">{t('adminTrainingSettingTitle')}</h1><p>{t('trainingAdminIntro')}</p></div></div>
    <form onSubmit={submit} className="mb-6 space-y-4 rounded-2xl border border-border-subtle bg-white p-5">
      <h2 className="font-semibold">{t('trainingUpload')}</h2>
      {(['title_en', 'title_ur', 'description_en', 'description_ur'] as const).map(name => <label key={name} className="block text-sm">{t(`training_${name}`)}<input value={fields[name]} onChange={event => change(name, event.target.value)} required={name.startsWith('title')} maxLength={name.startsWith('title') ? 150 : undefined} className="mt-1 block w-full rounded-lg border border-border-subtle p-3" /></label>)}
      <label className="block text-sm">{t('trainingPosition')}<input type="number" min="0" value={fields.position} onChange={event => change('position', Number(event.target.value))} className="mt-1 block w-28 rounded-lg border border-border-subtle p-3" /></label>
      <label className="block text-sm">{t('trainingFile')}<input type="file" accept="video/mp4,.mp4" onChange={event => setFile(event.target.files?.[0] ?? null)} required className="mt-1 block w-full" /></label>
      <p className="text-sm text-text-secondary">{t('trainingFileHint')}</p>
      {message && <p role="alert" className="text-red-600">{message}</p>}
      {upload.isPending && <p role="status">{t('trainingUploading')} {progress}%</p>}
      {upload.isError && <p role="alert" className="text-red-600">{t('trainingSaveError')}</p>}
      <button type="submit" disabled={upload.isPending} className="rounded-lg bg-brand px-5 py-3 text-white disabled:opacity-50">{upload.isPending ? t('loading') : t('trainingUpload')}</button>
    </form>
    {query.isPending && <p>{t('loading')}</p>}
    {query.isError && <button type="button" onClick={() => query.refetch()}>{t('trainingLoadError')} {t('retry')}</button>}
    {query.data?.length === 0 && <p>{t('trainingEmpty')}</p>}
    <div className="space-y-3">{query.data?.map(video => <article key={video.id} className="rounded-2xl border border-border-subtle bg-white p-5">
      <h2 className="font-semibold">{language === 'ur' ? video.title_ur : video.title_en}</h2>
      <p className="text-sm text-text-secondary">{video.title_en} / {video.title_ur}</p>
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={update.isPending} onClick={() => update.mutate({ id: video.id, changes: { published: !video.published } })} className="rounded-lg border px-3 py-2">{video.published ? t('trainingUnpublish') : t('trainingPublish')}</button>
      <a href={video.playback_url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2">{t('trainingPreview')}</a>
      <button type="button" disabled={remove.isPending} onClick={() => { if (window.confirm(t('trainingDeleteConfirm'))) remove.mutate(video.id); }} className="rounded-lg border px-3 py-2 text-red-700">{t('trainingDelete')}</button></div>
    </article>)}</div>
    {(update.isError || remove.isError) && <p role="alert">{t('trainingSaveError')}</p>}
  </div>;
}
