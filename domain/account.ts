import { z } from 'zod';
import type { User } from './models';
export const plans = [
  { id: 'free', name: 'Free', label: '访客', prices: [0, 0], description: '认识 IRIVA，和客服聊聊你的目标', benefits: ['专属客服支持', '浏览套餐与学习方式'] },
  { id: 'lite', name: 'Lite', label: '自在开口', prices: [120000, 184000], description: '从日常对话开始，让英语融入生活', benefits: ['基础档 Host 与生活场景', '六周小组同行', '专属 AI 口语陪练', '结业口语报告'] },
  { id: 'pro', name: 'Pro', label: '连接世界', prices: [318000, 478000], description: '与母语 Host 一起，为出国留学和海外职场做好准备', benefits: ['母语档 Host · 留学与职场场景', '六周小组同行', '专属 AI 口语陪练', '结业英文口语评估报告', '专属金色 Pro 标签'] },
  // id stays 'max' so existing orders, members and tags keep working; it is shown as 专家档 / Expert.
  { id: 'max', name: '专家档', label: '资深专家同行', prices: [478000, 718000], description: '与具备商业或专业领域背景的资深工作者一起，应对商业谈判、出海与国际学术交流', benefits: ['专家档 Host · 商业或专业领域资深工作者', '商业谈判 · 出海 · 国际学术交流', '六周小组同行', '专属 AI 口语陪练', '结业英文口语评估报告', '专属炫彩 Expert 标签'] },
] as const;
/** Short badge text for a plan id (the stored id 'max' is presented as Expert). */
export function planTag(plan: string) { return plan === 'max' ? 'EXPERT' : plan.toUpperCase(); }
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80), signature: z.string().trim().min(1).max(180),
  avatar: z.string().max(700000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
  mbti: z.enum(['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en',{timeZone:value}); return true; } catch { return false; } }),
  city: z.string().trim().min(1).max(100), zodiac: z.string().max(40), birthChart: z.string().max(100), occupation: z.string().max(100),
}).strict();

const requiredProfileFields = { avatar: '头像', name: '昵称', signature: '个人签名', mbti: 'MBTI', timezone: '时区', city: '城市 / 地址' } as const;
export function missingProfileFields(user?: Partial<User>) {
  return (Object.keys(requiredProfileFields) as (keyof typeof requiredProfileFields)[])
    .filter(key => !profileSchema.shape[key].safeParse(user?.[key]).success)
    .map(key => requiredProfileFields[key]);
}
export function isProfileComplete(user?: Partial<User>) { return missingProfileFields(user).length === 0; }
