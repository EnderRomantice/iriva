import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingProfileFields, isProfileComplete } from '../domain/account';
const complete = { name: 'Learner', signature: 'Hello', avatar: 'data:image/png;base64,iVBORw0KGgo=', mbti: 'INFP', timezone: 'Asia/Shanghai', city: '上海' };
test('profile completion requires every required field, allows absent optional fields, and rejects placeholders', () => {
  assert.equal(isProfileComplete(complete), true);
  for (const key of Object.keys(complete)) assert.equal(isProfileComplete({ ...complete, [key]: '' }), false, key);
  assert.deepEqual(missingProfileFields({ ...complete, avatar: 'sage', signature: '   ', mbti: 'xxxx', timezone: 'Not/A_Zone' }), ['头像', '个人签名', 'MBTI', '时区']);
  assert.equal(isProfileComplete(undefined), false);
});
