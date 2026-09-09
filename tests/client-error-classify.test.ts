import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDevToolsVitalsNoise, isProviderIdentityError } from '../src/lib/client-error-classify';

describe('client-error classification', () => {
  it('recognises the DevTools-injected web-vitals crash as browser noise', () => {
    // Exact console output from a dashboard navigation with DevTools open:
    // the Performance panel injects web-vitals as an anonymous VM* script.
    const message = "Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')";
    const stack = [
      'TypeError: Cannot read properties of undefined (reading \'startTime\')',
      '    at et.reportAllChanges (VM195:2:19429)',
      '    at VM195:2:13070',
    ].join('\n');
    assert.equal(isDevToolsVitalsNoise(message, stack), true);
  });

  it('does not silence app errors that merely mention startTime', () => {
    assert.equal(isDevToolsVitalsNoise("Cannot read properties of undefined (reading 'startTime')"), false);
    assert.equal(
      isDevToolsVitalsNoise("Cannot read properties of undefined (reading 'startTime')", '    at app.js:1:10'),
      false,
    );
    assert.equal(isDevToolsVitalsNoise('useHousehold must be used inside HouseholdProvider'), false);
  });

  it('recognises React context-identity failures for self-healing reload', () => {
    assert.equal(isProviderIdentityError('useHousehold must be used inside HouseholdProvider'), true);
    assert.equal(isProviderIdentityError('useDashboard must be used within a DashboardProvider'), true);
    assert.equal(isProviderIdentityError('useAuth must be used within an AuthProvider'), true);
  });

  it('does not treat ordinary errors as provider-identity failures', () => {
    assert.equal(isProviderIdentityError('Network request failed'), false);
    assert.equal(isProviderIdentityError("Cannot read properties of undefined (reading 'startTime')"), false);
    assert.equal(isProviderIdentityError(''), false);
    assert.equal(isProviderIdentityError(undefined), false);
    assert.equal(isProviderIdentityError(null), false);
    assert.equal(isProviderIdentityError(42), false);
  });
});
