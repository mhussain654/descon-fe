import { ActionSheetIOS, Platform } from 'react-native';

/** Where "Choose file" picks from: the files picker, or the photo library. */
export type FileSource = 'file' | 'gallery';

export interface FileSourceLabels {
  photoLibrary: string;
  files: string;
  cancel: string;
}

/**
 * "Choose file" is the one button for picking an existing file. Android's
 * system file picker already includes the gallery, so it opens directly. On
 * iPhone it opens the Files app, which doesn't show the Photos library, so the
 * candidate first chooses Photo library or Files -- unless only PDFs are
 * accepted, when Files is the only sensible source. Resolves null on cancel.
 */
export function chooseFileSource(labels: FileSourceLabels, acceptsPhotos: boolean): Promise<FileSource | null> {
  if (Platform.OS !== 'ios' || !acceptsPhotos) return Promise.resolve('file');
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [labels.photoLibrary, labels.files, labels.cancel], cancelButtonIndex: 2 },
      (index) => resolve(index === 0 ? 'gallery' : index === 1 ? 'file' : null)
    );
  });
}
