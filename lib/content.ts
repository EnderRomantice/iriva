// 页面上的所有文案与数据集中在这里，改内容只需改这个文件。

export const nav = [
  { href: "#how", label: "怎么相处" },
  { href: "#journey", label: "六周旅程" },
  { href: "#price", label: "价格" },
  { href: "#faq", label: "常见问题" },
];

export const ctaLabel = "预约 15 分钟认识一下";

export const heroStats = [
  { value: "6 周", label: "固定开学日，固定同行" },
  { value: "4 + 1", label: "四位伙伴，一位 Host，不换人" },
  { value: "约 30 分钟", label: "每次圆桌你的开口时间" },
];

export const weekSchedule = [
  { name: "小组圆桌", detail: "1 或 2 次 × 120 分钟" },
  { name: "Host 一对一", detail: "1 次 × 30 分钟" },
  { name: "伙伴练习", detail: "3–4 次 × 30–45 分钟" },
  { name: "AI 教练", detail: "每天 15 分钟" },
  { name: "真实生活任务", detail: "每周 1 个" },
];

export const values = [
  {
    tag: "MESSAGE · 传递",
    title: "每个人都带着自己的故事来",
    body: "生活、文化、经历，都是开口的理由。在这里，每一种声音都有机会被听见。",
  },
  {
    tag: "CONNECTION · 连接",
    title: "差异让我们靠得更近",
    body: "固定的伙伴、反复的交流、共同的任务，让对话一次比一次深入。",
  },
  {
    tag: "BELONGING · 归属",
    title: "不必完美，也能自在表达",
    body: "被欢迎、被倾听，然后自然地说得更多、更好。",
  },
];

export const alternatives = [
  {
    label: "AI 口语 App",
    title: "练习很多，但对面不是人",
    body: "能帮你准备，却给不了真实的回应、幽默和友谊。",
  },
  {
    label: "外教一对一",
    title: "有真人，却没有同伴",
    body: "按课时买，常换老师；课一结束，就没有人等你。",
  },
];

export const ourWay = {
  label: "青鸟 IRIVA",
  title: "固定的伙伴，温暖的 Host，真实的话题",
  body: "AI 帮你准备，人与人创造连接。六周里，陌生人慢慢变成熟悉的面孔。",
};

export const formats = [
  {
    title: "小组圆桌",
    meta: "Host + 4 位学习者 · 120 分钟",
    body: "生活故事、文化话题、角色扮演。中间两人一组练习，每人每次约开口 30 分钟。",
  },
  {
    title: "Host 一对一",
    meta: "每周 30 分钟",
    body: "只练你自己想练的：面试、汇报、课堂发言，或这周反复卡住的地方。",
  },
  {
    title: "伙伴练习",
    meta: "两人一组 · 每周 3–4 次",
    body: "AI 给任务卡：场景、角色、要用的表达。你的伙伴在等你，你也在等他。",
  },
  {
    title: "AI 教练",
    meta: "课前、课后、每一天",
    body: "课前准备、课后复盘（3 处鼓励式纠正 + 1 句可借用的表达）、每日 15 分钟练习。",
  },
];

export const roundtable = [
  { time: "0–15 分钟", name: "签到", note: "讲一件这周的事" },
  { time: "15–60 分钟", name: "主题对话", note: "故事、文化、讨论" },
  { time: "60–70 分钟", name: "休息", note: "" },
  { time: "70–110 分钟", name: "两人一组", note: "开口最多的时段", highlight: true },
  { time: "110–120 分钟", name: "收尾", note: "每人一句今天的收获" },
];

export const journey = [
  { week: "第 0 周", title: "相识", body: "口语录音、目标问卷、组成 Household、欢迎会" },
  { week: "第 1 周", title: "讲自己的故事", body: "不再在脑子里先翻译" },
  { week: "第 2 周", title: "日常与社交", body: "寒暄、接话、问问题" },
  { week: "第 3 周", title: "表达观点", body: "解释、说服、礼貌地不同意" },
  { week: "第 4 周", title: "走进真实场景", body: "海外第一周、会议或面试" },
  { week: "第 5 周", title: "共同作品", body: "4 人合作一个 10 分钟英文分享" },
];

export const graduation = {
  week: "第 6 周",
  title: "结业",
  body: "分享作品，重录入学口语，听见自己的变化",
};

export const takeaways = [
  { title: "前后对比录音", body: "入学和结业各录一次，自己听得出变化" },
  { title: "开口力报告", body: "开口频率、表达自信、发言时长的前后对比" },
  { title: "一个共同作品", body: "和你的 Household 一起完成的英文分享" },
  { title: "结业后的社区", body: "校友交流、文化主题活动，联系不随课程结束" },
];

export type Frequency = 1 | 2;

export type Tier = {
  name: string;
  who: string;
  host: string;
  scene: string;
  extra: string;
  /** 正价 */
  list: Record<Frequency, string>;
  /** 首期价 */
  pilot: Record<Frequency, string>;
  featured?: boolean;
};

export const tiers: Tier[] = [
  {
    name: "基础档",
    who: "想先自在开口、预算有限",
    host: "英语流利的国际 Host",
    scene: "日常生活、校园、求职",
    extra: "AI 教练 + 伙伴练习",
    list: { 1: "1,499", 2: "2,299" },
    pilot: { 1: "1,200", 2: "1,840" },
  },
  {
    name: "母语档",
    who: "准备出国留学的学习者和家庭",
    host: "英语母语者",
    scene: "课堂讨论、室友、社交、问教授",
    extra: "结业英文口语评估报告",
    list: { 1: "3,980", 2: "5,980" },
    pilot: { 1: "3,180", 2: "4,780" },
    featured: true,
  },
  {
    name: "职业档",
    who: "要和海外同事、客户打交道的职场人",
    host: "有商业工作背景的母语者",
    scene: "开会、汇报、谈判、寒暄",
    extra: "4 次美国行业人士模拟会议或面试",
    list: { 1: "5,980", 2: "8,980" },
    pilot: { 1: "4,780", 2: "7,180" },
  },
];

/** 每周圆桌次数 → 一学期和 Host 相处的小时数 */
export const hostHours: Record<Frequency, number> = { 1: 15, 2: 27 };

export const refunds = [
  { when: "开学 14 天以前", how: "全额退款（扣除支付手续费）" },
  { when: "开学前 14 天内", how: "退 80%，或免费转到下一期" },
  { when: "第 1 周结束前", how: "退 50%，或免费转到下一期" },
  { when: "第 1 周之后", how: "不退款；生病、家庭紧急情况等可转到下一期一次" },
  {
    when: "我们的原因（取消开班、无法匹配、Host 缺席未补）",
    how: "按未上部分比例退款，或免费转到下一期，由你选",
  },
];

export const faqs = [
  {
    q: "我的英语要到什么水平？",
    a: "能用英语聊 5 分钟“你今天做了什么”就可以，慢一点没关系。你不需要先变得流利，才能加入对话。零基础暂时不适合这个形式。",
  },
  {
    q: "时间怎么定？",
    a: "报名时勾选你每周的可用时段。我们把时间对得上、目标相近的 4 位伙伴组成一个 Household，再和 Host 确认圆桌时间，整个学期固定。一对一和伙伴练习自己约。",
  },
  {
    q: "Host 是什么样的人？",
    a: "基础档是英语流利的国际 Host，母语档是英语母语者，职业档是有商业工作背景的母语者。每位 Host 都先和真实学习者试聊，温暖、会倾听，才会带 Household。",
  },
  {
    q: "缺席了怎么办？",
    a: "圆桌时间固定，缺席不单独补课，由一对一和伙伴练习补上。你的伙伴在等你，这也是大家能坚持下来的原因。",
  },
  {
    q: "录音和数据怎么用？",
    a: "录音转写须事先书面同意，只用来生成你的反馈和报告，不对外分享，学期结束后按约定期限删除。",
  },
  {
    q: "未成年人可以报名吗？",
    a: "可以，需要由监护人报名并签署录音同意书，进度报告同步发给监护人。",
  },
];

export const applySteps = [
  { step: "第 1 步", title: "认识一下", body: "聊聊你的目标、故事和可用时间" },
  { step: "第 2 步", title: "录 3 分钟口语", body: "这是你的起点，结业时再听一次" },
  { step: "第 3 步", title: "组成 Household", body: "认识你的 3 位伙伴、Host 和圆桌时间" },
  { step: "第 4 步", title: "付款，一起出发", body: "一次付清，固定开学日开始" },
];

/** 报名入口与联系方式：上线前替换 */
export const contactPlaceholder = "[报名入口：表单或小程序链接] · [微信号 / 联系邮箱]";
