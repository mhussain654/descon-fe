import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Play, X } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'position' | 'title' | 'newest'>('position');
  const [playing, setPlaying] = useState<{ id: number; url: string } | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [playError, setPlayError] = useState(false);
  const upload = useMutation({ mutationFn: () => trainingVideosClient.create(fields, file!, setProgress), onSuccess: () => {
    setFields(initial); setFile(null); setMessage(''); setProgress(0); queryClient.invalidateQueries({ queryKey: ['admin', 'training-videos'] });
  } });
  const update = useMutation({ mutationFn: ({ id, changes }: { id: number; changes: Partial<TrainingVideoInput> }) => trainingVideosClient.update(id, changes), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'training-videos'] }) });
  const remove = useMutation({ mutationFn: trainingVideosClient.remove, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'training-videos'] }) });
  const change = (name: keyof TrainingVideoInput, value: string | number | boolean) => setFields(previous => ({ ...previous, [name]: value }));
  // The signed playback link expires within minutes, so it is refreshed each time a video is opened.
  const togglePlayer = async (id: number) => {
    if (playing?.id === id) { setPlaying(null); return; }
    setOpening(id); setPlayError(false);
    try {
      const fresh = await query.refetch();
      const current = fresh.data?.find(video => video.id === id);
      if (current?.playback_url) setPlaying({ id, url: current.playback_url });
    } finally { setOpening(null); }
  };
  const visibleVideos = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matches = (query.data ?? []).filter(video => !needle
      || [video.title_en, video.title_ur, video.description_en, video.description_ur].some(text => text?.toLowerCase().includes(needle)));
    const title = (video: { title_en: string; title_ur: string }) => (language === 'ur' ? video.title_ur : video.title_en);
    return [...matches].sort((a, b) => {
      if (sort === 'title') return title(a).localeCompare(title(b), language);
      if (sort === 'newest') return b.id - a.id;
      return a.position - b.position || a.id - b.id;
    });
  }, [query.data, search, sort, language]);
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
    {!!query.data?.length && <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="block min-w-[220px] flex-1 text-sm">{t('trainingSearch')}<input type="search" value={search} onChange={event => setSearch(event.target.value)} className="mt-1 block w-full rounded-lg border border-border-subtle p-3" /></label>
      <label className="block text-sm">{t('trainingSort')}<select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="mt-1 block rounded-lg border border-border-subtle bg-white p-3">
        <option value="position">{t('trainingSortPosition')}</option><option value="title">{t('trainingSortTitle')}</option><option value="newest">{t('trainingSortNewest')}</option>
      </select></label>
    </div>}
    {!!query.data?.length && visibleVideos.length === 0 && <p>{t('trainingNoMatches')}</p>}
    <div className="space-y-3">{visibleVideos.map(video => <article key={video.id} className="rounded-2xl border border-border-subtle bg-white p-5">
      <h2 className="font-semibold">{language === 'ur' ? video.title_ur : video.title_en}</h2>
      <p className="text-sm text-text-secondary">{video.title_en} / {video.title_ur}</p>
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={update.isPending} onClick={() => update.mutate({ id: video.id, changes: { published: !video.published } })} className="rounded-lg border px-3 py-2">{video.published ? t('trainingUnpublish') : t('trainingPublish')}</button>
      <button type="button" disabled={opening !== null} onClick={() => togglePlayer(video.id)} aria-expanded={playing?.id === video.id} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2">{playing?.id === video.id ? <X className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}{opening === video.id ? t('loading') : playing?.id === video.id ? t('trainingClosePlayer') : t('trainingPlay')}</button>
      <button type="button" disabled={remove.isPending} onClick={() => { if (window.confirm(t('trainingDeleteConfirm'))) remove.mutate(video.id); }} className="rounded-lg border px-3 py-2 text-red-700">{t('trainingDelete')}</button></div>
      {playing?.id === video.id && <div className="mt-4"><video key={playing.url} src={playing.url} controls autoPlay playsInline preload="metadata" onError={() => setPlayError(true)} aria-label={language === 'ur' ? video.title_ur : video.title_en} className="aspect-video max-h-[480px] w-full rounded-xl bg-black" />{playError && <p role="alert" className="mt-2 text-red-600">{t('trainingPlayError')}</p>}</div>}
    </article>)}</div>
    {(update.isError || remove.isError) && <p role="alert">{t('trainingSaveError')}</p>}
  </div>;
}
