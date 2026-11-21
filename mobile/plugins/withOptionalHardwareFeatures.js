const { withAndroidManifest } = require('expo/config-plugins');

// Hardware the app uses when present but does not need. Google Play otherwise
// treats both as required and hides the app from devices without them:
// - screen.portrait is implied by the portrait lock ("orientation" in app.json);
// - wifi is implied by a Wi-Fi state permission that a network library adds.
// Marking them optional keeps the portrait lock and Wi-Fi use unchanged.
const OPTIONAL_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

/** Adds `<uses-feature android:required="false">` for each feature, or sets an existing one to optional. */
function markFeaturesOptional(androidManifest, featureNames = OPTIONAL_FEATURES) {
  const manifest = androidManifest.manifest;
  const features = manifest['uses-feature'] ?? [];
  for (const name of featureNames) {
    const existing = features.find((feature) => feature.$?.['android:name'] === name);
    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
  }
  manifest['uses-feature'] = features;
  return androidManifest;
}

function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = markFeaturesOptional(modConfig.modResults);
    return modConfig;
  });
}

module.exports = withOptionalHardwareFeatures;
module.exports.markFeaturesOptional = markFeaturesOptional;
module.exports.OPTIONAL_FEATURES = OPTIONAL_FEATURES;
