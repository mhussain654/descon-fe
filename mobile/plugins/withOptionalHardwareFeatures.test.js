const { markFeaturesOptional } = require('./withOptionalHardwareFeatures');

function manifestWith(usesFeature) {
  return { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' }, ...(usesFeature ? { 'uses-feature': usesFeature } : {}) } };
}

function featureState(manifest) {
  return Object.fromEntries(manifest.manifest['uses-feature'].map((feature) => [feature.$['android:name'], feature.$['android:required']]));
}

describe('markFeaturesOptional', () => {
  it('declares the portrait screen and Wi-Fi as optional, so Google Play does not hide the app from devices without them', () => {
    const result = markFeaturesOptional(manifestWith());

    expect(featureState(result)).toEqual({
      'android.hardware.screen.portrait': 'false',
      'android.hardware.wifi': 'false',
    });
  });

  it('turns an existing required declaration optional instead of adding a duplicate, and leaves other features alone', () => {
    const result = markFeaturesOptional(
      manifestWith([
        { $: { 'android:name': 'android.hardware.wifi', 'android:required': 'true' } },
        { $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } },
      ])
    );

    expect(result.manifest['uses-feature']).toHaveLength(3);
    expect(featureState(result)).toEqual({
      'android.hardware.wifi': 'false',
      'android.hardware.camera': 'false',
      'android.hardware.screen.portrait': 'false',
    });
  });
});
