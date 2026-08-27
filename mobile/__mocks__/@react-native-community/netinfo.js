// Project-wide Jest manual mock for @react-native-community/netinfo.
//
// Under Jest there is no native module for this package, and
// mobile/patches/@react-native-community+netinfo+11.4.1.patch removes the
// package's own "you must mock this in tests" guard (it would otherwise
// throw loudly and force every test file to add its own mock). Without a
// mock, `src/lib/api-client.ts`'s module-scope `NetInfo.addEventListener(...)`
// call runs once per test file against the real (patched) package -- with no
// native module behind it, this leaks a subscription per file instead of
// throwing, which accumulates across the full test run and is why
// `npm test -- --runInBand` (all ~52 suites in one process) hangs on exit
// even though every file passes and exits cleanly on its own.
//
// This file is applied automatically by Jest (no `jest.mock(...)` call
// needed) because it sits in a `__mocks__` directory adjacent to
// `node_modules` for a scoped node_modules package. Individual test files
// that already call `jest.mock('@react-native-community/netinfo', ...)`
// keep working unchanged -- their inline mock simply takes precedence.
module.exports = {
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true })
  ),
};
