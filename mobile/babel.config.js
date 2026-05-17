module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // reanimated: false — we add the plugin once at the end (Expo also auto-injects it)
      ["babel-preset-expo", { jsxImportSource: "nativewind", reanimated: false }],
    ],
    plugins: [
      // NativeWind v4: use css-interop plugin only (nativewind/babel also pulls
      // react-native-worklets/plugin, which requires Reanimated 4 / RN 0.81+)
      require("react-native-css-interop/dist/babel-plugin").default,
      "react-native-reanimated/plugin",
    ],
  };
};
