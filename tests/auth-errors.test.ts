import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage, type AuthErrorCopy } from '../src/lib/auth-errors';

describe('authErrorMessage', () => {
  it('explains an unauthorized preview domain', () => {
    assert.match(
      authErrorMessage({ code: 'auth/unauthorized-domain', message: 'Firebase: Error (auth/unauthorized-domain).' }),
      /Authorized domains/,
    );
  });

  it('hides raw invalid-credential noise', () => {
    assert.equal(
      authErrorMessage({ code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' }),
      'Email or password is incorrect.',
    );
  });

  it('uses supplied localized copy instead of SDK error prose', () => {
    const arabic: AuthErrorCopy = {
      unauthorizedDomain: 'نطاق غير مسموح',
      invalidCredentials: 'بيانات الدخول غير صحيحة',
      tooManyAttempts: 'محاولات كثيرة',
      popupBlocked: 'تم حظر النافذة',
      signInCancelled: 'تم الإلغاء',
      networkError: 'خطأ شبكة',
      signInMethodDisabled: 'الطريقة معطلة',
      emailAlreadyInUse: 'البريد مستخدم',
      weakPassword: 'كلمة المرور قصيرة',
      apiKeyReferrerBlocked: 'تم حظر النطاق',
      authFailed: 'فشلت المصادقة',
    };

    assert.equal(
      authErrorMessage(
        { code: 'auth/network-request-failed', message: 'Firebase: Error (auth/network-request-failed).' },
        arabic,
      ),
      arabic.networkError,
    );
    assert.equal(authErrorMessage(new Error('Unexpected SDK failure'), arabic), arabic.authFailed);
  });
});
