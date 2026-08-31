import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isProfileAvatarSource, resolveProfileAvatarSource } from '../src/lib/profile-avatar';

describe('profile avatar sources', () => {
  it('accepts persisted HTTPS and raster image data URLs only', () => {
    assert.equal(isProfileAvatarSource('https://lh3.googleusercontent.com/avatar.jpg'), true);
    assert.equal(isProfileAvatarSource('data:image/jpeg;base64,aGVsbG8='), true);
    assert.equal(isProfileAvatarSource('data:image/png;base64,aGVsbG8='), true);
    assert.equal(isProfileAvatarSource('http://example.test/avatar.jpg'), false);
    assert.equal(isProfileAvatarSource('javascript:alert(1)'), false);
    assert.equal(isProfileAvatarSource('data:image/svg+xml;base64,PHN2Zy8+'), false);
  });

  it('keeps the saved avatar stable before falling back to the provider photo', () => {
    const provider = 'https://lh3.googleusercontent.com/new-avatar.jpg';
    const saved = 'https://cdn.example.test/saved-avatar.jpg';

    assert.equal(resolveProfileAvatarSource(saved, provider), saved);
    assert.equal(resolveProfileAvatarSource(undefined, provider), provider);
    assert.equal(resolveProfileAvatarSource('not an image', provider), provider);
    assert.equal(resolveProfileAvatarSource(undefined, undefined), undefined);
  });
});
