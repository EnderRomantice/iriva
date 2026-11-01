import { demoOrganizationId } from "../../domain/workspace";
import type { Entity, State } from "../../domain/models";
import { SqliteRepository, tables } from "../repositories/sqlite-repository";

export const seedId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function seedDemo(repo: SqliteRepository) {
  if (repo.db.prepare("SELECT id FROM users LIMIT 1").get()) {
    const cities = ["上海", "北京", "杭州", "深圳", "London", "上海", "成都", "广州", "南京"];
    repo.atomic(() => {
      cities.forEach((city, index) => repo.db.prepare("UPDATE users SET city = ? WHERE id = ? AND email LIKE '%@example.test' AND city = ''").run(city, seedId(index + 1)));
      // Update the original demo translation without overwriting edited locations.
      repo.db.prepare("UPDATE users SET city = 'London' WHERE id = ? AND email = 'emma@example.test' AND city = '伦敦'").run(seedId(5));
    });
    seedOrganizations(repo);
    seedChats(repo);
    seedHostDirectory(repo);
    return;
  }
  const now = new Date();
  const at = (days: number, hour = 12) => { const date = new Date(now); date.setUTCDate(date.getUTCDate() + days); date.setUTCHours(hour, 0, 0, 0); return date.toISOString(); };
  const base = (n: number): Entity => ({ id: seedId(n), version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString() });
  const householdId = seedId(201);
  const state: State = {
    organizations: [], organizationMemberships: [], channels: [], channelParticipants: [], messages: [],
    users: [
      { ...base(1), name: "林小满", email: "xiaoman@example.test", city: "上海", timezone: "Asia/Shanghai", avatar: "coral" },
      { ...base(2), name: "陈一舟", email: "yizhou@example.test", city: "北京", timezone: "Asia/Shanghai", avatar: "blue" },
      { ...base(3), name: "许知夏", email: "zhixia@example.test", city: "杭州", timezone: "Asia/Shanghai", avatar: "lilac" },
      { ...base(4), name: "周亦安", email: "yian@example.test", city: "深圳", timezone: "Asia/Shanghai", avatar: "sage" },
      { ...base(5), name: "Emma Wilson", email: "emma@example.test", city: "London", timezone: "Europe/London", avatar: "amber" },
      { ...base(6), name: "IRIVA 运营", email: "ops@example.test", city: "上海", timezone: "Asia/Shanghai", avatar: "blue" },
      { ...base(7), name: "沈可心", email: "kexin@example.test", city: "成都", timezone: "Asia/Shanghai", avatar: "lilac" },
      { ...base(8), name: "张予宁", email: "yuning@example.test", city: "广州", timezone: "Asia/Shanghai", avatar: "sage" },
      { ...base(9), name: "李沐阳", email: "muyang@example.test", city: "南京", timezone: "Asia/Shanghai", avatar: "coral" },
    ],
    terms: [{ ...base(101), name: "秋日同行 · 第一期", startsOn: at(-8).slice(0,10), endsOn: at(34).slice(0,10) }],
    households: [
      { ...base(201), name: "The Sunday Club", termId: seedId(101), hostId: seedId(5), timezone: "Asia/Shanghai", capacity: 4, theme: "从日常小事，认识彼此的世界。" },
      { ...base(202), name: "Across the Table", termId: seedId(101), hostId: seedId(5), timezone: "Asia/Shanghai", capacity: 4, theme: "一次相聚，新的故事。" },
    ],
    memberships: [1,2,3,4,5].map((user, index) => ({ ...base(210 + index), householdId, userId: seedId(user), role: user === 5 ? "host" as const : "learner" as const })).concat([{ ...base(220), householdId: seedId(202), userId: seedId(5), role: "host" }]),
    sessions: [
      { ...base(301), householdId, title: "Small talk, real connections", description: "从一句 How was your day? 开始，聊聊那些让日常变得特别的小事。带上一件想分享的物品就好。", startsAt: at(1), endsAt: at(1,14), status: "scheduled", meetingUrl: "" },
      { ...base(302), householdId, title: "A little piece of home", description: "分享一个来自家乡的小故事，练习自然地表达与追问。", startsAt: at(4), endsAt: at(4,14), status: "scheduled", meetingUrl: "" },
      { ...base(303), householdId, title: "Hello, this is me", description: "我们的第一场 iriva meeting：记住名字，也记住彼此的故事。", startsAt: at(-6), endsAt: at(-6,14), status: "completed", meetingUrl: "" },
    ],
    assignments: [
      { ...base(401), householdId, title: "带来一个关于你的小故事", description: "用 3–5 句话介绍一件你喜欢的小事。它可能是一杯咖啡、一首歌，或者下班路上的风。试着说说它为什么对你特别。", category: "prepare", dueAt: at(1), week: 2 },
      { ...base(402), householdId, title: "和伙伴聊聊：今天有什么新鲜事？", description: "和你的伙伴进行一次 15 分钟的对话。用 What made you smile today? 开始，再写下一个你想记住的新表达。", category: "practice", dueAt: at(2), week: 2 },
      { ...base(403), householdId, title: "给这一周留下一句话", description: "回想一次你主动开口的瞬间。你说了什么？当时感觉如何？写给未来的自己。", category: "reflect", dueAt: at(4), week: 2 },
      { ...base(404), householdId, title: "Hello, Household!", description: "向你的 Household 介绍自己，分享你来到这里的一个小愿望。", category: "prepare", dueAt: at(-5), week: 1 },
    ],
    submissions: [
      { ...base(501), assignmentId: seedId(404), learnerId: seedId(1), body: "Hi, I'm Xiaoman. I love taking long walks and finding small cafés. I hope to feel more comfortable sharing my stories in English.", status: "submitted", completed: true },
      { ...base(502), assignmentId: seedId(401), learnerId: seedId(1), body: "There is a little bookshop near my home. I like going there on Sunday mornings…", status: "draft", completed: false },
      { ...base(503), assignmentId: seedId(401), learnerId: seedId(2), body: "I started growing tomatoes on my balcony. Last week I picked the first one. It was small, but I was really proud of it.", status: "submitted", completed: true },
    ],
    feedback: [{ ...base(601), submissionId: seedId(501), authorId: seedId(5), body: "你讲到小咖啡馆的时候，整个人都放松了。那就是交流最好的样子。\n\n下次可以试试：One of my favorite things to do is… 用它开启一个属于你的小故事。", status: "published" }],
    applications: [
      { ...base(701), userId: seedId(7), goal: "准备出国读研，希望能自然参与课堂讨论。", availability: "周三、周日 20:00–22:00（北京时间）", status: "new" },
      { ...base(702), userId: seedId(8), goal: "工作中需要和海外同事沟通，想更有信心。", availability: "工作日 19:00 以后（北京时间）", status: "contacted" },
      { ...base(703), userId: seedId(9), goal: "喜欢旅行，希望认识更多来自不同文化的朋友。", availability: "周末下午（北京时间）", status: "new" },
    ],
    enrollments: [1,2,3,4].map(n => ({ ...base(800 + n), userId: seedId(n), termId: seedId(101), householdId, plan: "母语档 · 每周 1 次", amountMinor: 318000, currency: "CNY", paymentStatus: "paid" })),
  };
  repo.atomic(() => { for (const table of tables) for (const item of state[table]) repo.put(table, item); });
  seedOrganizations(repo);
  seedChats(repo);
    seedHostDirectory(repo);
}


function seedOrganizations(repo: SqliteRepository) {
  const now = new Date().toISOString();
  const base = (n: number): Entity => ({ id: seedId(n), version: 1, createdAt: now, updatedAt: now });
  repo.atomic(() => {
    // Existing users belong to the original institution; never reassign their data.
    repo.db.exec("INSERT OR IGNORE INTO organization_memberships SELECT 'org-' || id, '10000000-0000-4000-8000-000000001001', id, CASE WHEN id='10000000-0000-4000-8000-000000000006' THEN 'ops' WHEN id IN (SELECT host_id FROM households WHERE organization_id='10000000-0000-4000-8000-000000001001') THEN 'host' ELSE 'learn' END, 1, created_at, updated_at FROM users WHERE id NOT IN (SELECT user_id FROM organization_memberships)");
    if (repo.read().organizations.some(o => o.id === demoOrganizationId)) return;
    if (![1,5,6].every(n => repo.read().users.some(u => u.id === seedId(n) && u.email.endsWith("@example.test")))) return;
    repo.put("organizations", { ...base(1002), name: "Common Ground", initials: "C", color: "#5d3c63" });
    for (const [index, userId, role] of [[1051, 1, "learn"], [1055, 5, "host"], [1056, 6, "ops"]] as const) repo.put("organizationMemberships", { ...base(index), organizationId: demoOrganizationId, userId: seedId(userId), role });
    repo.put("terms", { ...base(1101), name: "Common Ground · 城市交流", startsOn: now.slice(0,10), endsOn: new Date(Date.now()+42*86400000).toISOString().slice(0,10) });
    repo.put("households", { ...base(1201), organizationId: demoOrganizationId, name: "City Stories", termId: seedId(1101), hostId: seedId(5), timezone: "Europe/London", capacity: 4, theme: "分享你所在城市的一件小事。" });
    for (const [index, userId, role] of [[1211,1,"learner"], [1215,5,"host"]] as const) repo.put("memberships", { ...base(index), householdId: seedId(1201), userId: seedId(userId), role });
    repo.put("assignments", { ...base(1401), householdId: seedId(1201), title: "A place you call home", description: "用几句话介绍你所在城市中最喜欢的一个地方。", category: "practice", dueAt: new Date(Date.now()+3*86400000).toISOString(), week: 1 });
  });
}

function seedChats(repo: SqliteRepository) {
  repo.atomic(() => {
    const state = repo.read();
    for (const [organizationId, n] of [[seedId(1001), 4001], [seedId(1002), 4002]] as const) {
      if (state.channels.some(c=>c.id===seedId(n)) || !state.organizations.some(o => o.id === organizationId) || state.channels.some(c => c.organizationId === organizationId && c.kind === "public")) continue;
      const host = state.organizationMemberships.find(m => m.organizationId === organizationId && m.role === "host");
      if (!host) continue;
      const now = new Date().toISOString();
      repo.saveChannel({ id: seedId(n), version: 1, createdAt: now, updatedAt: now, organizationId, ownerId: host.userId, name: "大厅", description: "打个招呼，分享日常，让对话自然发生。", kind: "public", directKey: "" });
    }
  });
}

function seedHostDirectory(repo: SqliteRepository) {
  repo.atomic(() => {
    const now=new Date().toISOString();
    const profiles=[
      {n:10,name:"Daniel Chen",email:"daniel@example.test",city:"New York",timezone:"America/New_York",signature:"从电影、设计到城市散步，每个故事都值得被听见。",occupation:"设计师 · 城市文化"},
      {n:11,name:"Sophie Lin",email:"sophie@example.test",city:"Sydney",timezone:"Australia/Sydney",signature:"喜欢旅行和美食，一起用英语聊聊生活里的小发现。",occupation:"旅行写作者 · 日常交流"},
      {n:12,name:"Alex Wang",email:"alex@example.test",city:"Vancouver",timezone:"America/Vancouver",signature:"聊职业，也聊生活。陪你把想法说得更自然。",occupation:"产品顾问 · 职业沟通"}
    ];
    for(const {n,...profile} of profiles) {
      if(repo.read().users.some(u=>u.id===seedId(n)))continue;
      repo.saveUser({id:seedId(n),version:1,createdAt:now,updatedAt:now,avatar:"sage",hostFullTime:n===10,...profile});
      repo.saveOrganizationMembership({id:seedId(5000+n),version:1,createdAt:now,updatedAt:now,organizationId:seedId(1001),userId:seedId(n),role:"host"});
    }
    // Fictional directory credentials for the existing local demo profiles.
    for (const [n, country, qualifications, featured] of [
      [5, 'GB', ['CELTA', 'TESOL'], true],
      [10, 'US', ['TESOL', '设计学硕士'], false],
      [11, 'AU', ['TEFL', '传播学学士'], false],
      [12, 'CA', ['TESOL', 'MBA'], true],
    ] as const) {
      repo.db.prepare("UPDATE users SET host_full_time=CASE WHEN id='10000000-0000-4000-8000-000000000005' THEN 1 ELSE host_full_time END,country_code=?,host_qualifications=?,host_featured=? WHERE id=? AND country_code='' AND email LIKE '%@example.test'").run(country,JSON.stringify(qualifications),Number(featured),seedId(n));
    }
  });
}
