module.exports = {
  dependencies: {
    // Work around RN 0.83 Android CMake/codegen autolink issue in react-native-sound.
    'react-native-sound': {
      platforms: {
        android: null,
      },
    },
  },
};
