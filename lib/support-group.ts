// Replace both the image and expiry whenever the official WeChat group QR is renewed.
export const supportGroup = {
  image: '/support/official-wechat-group.png',
  expiresAt: '2026-11-29T00:00:00+08:00',
  version: '2026-11-22',
};
export const supportGroupExpired = (now = Date.now()) => now >= Date.parse(supportGroup.expiresAt);
