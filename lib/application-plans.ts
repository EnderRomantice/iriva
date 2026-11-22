export const applicationPlans = [
  { id: 'native', name: '母语档', language: 'English', duration: '四周', amountMinor: 198000, currency: 'cny', available: true, description: '四位学员、一位固定英语母语 Host；每周圆桌与一对一交流。' },
  { id: 'everyday', name: '基础档', language: 'English', duration: '', amountMinor: null, currency: 'cny', available: false, description: '日常生活、兴趣与故事，暂未开放。' },
  { id: 'professional', name: '专业档', language: 'English', duration: '', amountMinor: null, currency: 'cny', available: false, description: '商务、国际交流与专业表达，暂未开放。' },
] as const;
