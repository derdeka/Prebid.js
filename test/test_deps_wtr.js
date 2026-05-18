// @web/test-runner setup — replaces test/test_deps.js (Karma-specific APIs removed)
// Uses dynamic imports to preserve setup ordering (sinon global before mocks that use it)

window.process = {
  env: {
    NODE_ENV: 'production'
  }
};

window.addEventListener('error', function (ev) {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', ev.error, ev.error?.stack);
});

window.addEventListener('unhandledrejection', function (ev) {
  // this message is used for counting intentional failures created in the tests
  if (ev.reason === 'pending failure') return;
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', ev.reason);
});

// Set up globals before importing mocks that reference them
const { default: sinon } = await import('sinon');
const { fakeServer, fakeServerWithClock, fakeXhr } = await import('nise');
const { expect, assert } = await import('chai');

globalThis.sinon = sinon;
globalThis.expect = expect;
globalThis.assert = assert;
if (!sinon.sandbox) {
  sinon.sandbox = { create: sinon.createSandbox.bind(sinon) };
}
sinon.fakeServer = fakeServer;
sinon.fakeServerWithClock = fakeServerWithClock;
sinon.useFakeXMLHttpRequest = fakeXhr.useFakeXMLHttpRequest.bind(fakeXhr);
sinon.createFakeServer = fakeServer.create.bind(fakeServer);
sinon.createFakeServerWithClock = fakeServerWithClock.create.bind(fakeServerWithClock);

localStorage.clear();

if (window.frameElement != null) {
  // sometimes (e.g. chrome headless) the tests run in an iframe that is offset from the top window
  // other times (e.g. browser debug page) they run in the top window
  // this can cause inconsistencies with the percentInView libraries; if we are in a frame,
  // fake the same dimensions as the top window
  window.frameElement.getBoundingClientRect = () => window.top.getBoundingClientRect();
}

// Import helpers and mocks after sinon global is set up
await import('test/helpers/global_hooks.js');
await import('test/helpers/consentData.js');
await import('test/helpers/prebidGlobal.js');
await import('test/mocks/adloaderStub.js');
await import('test/mocks/xhr.js');
await import('test/mocks/analyticsStub.js');
await import('test/mocks/ortbConverter.js');
await import('test/mocks/percentInView.js');
await import('test/mocks/storageManager.js');
await import('modules/rtdModule/index.js');
await import('modules/fpdModule/index.js');
