# IRIVA · Household

Next.js App Router + TypeScript。本地三端工作区，Slack 启发的温暖协作界面、微交互、SQLite 后端与 IndexedDB 本地优先体验。

## 启动

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3001
```

- 官网：<http://127.0.0.1:3001/>
- 学员：<http://127.0.0.1:3001/learn>
- Host：<http://127.0.0.1:3001/host>
- 运营：<http://127.0.0.1:3001/ops>
- 报名：<http://127.0.0.1:3001/apply>

首次接口访问自动迁移并初始化示例数据。数据库位于 `data/iriva.sqlite`，可用 `SQLITE_PATH` 指定文件。`data/` 不进入 Git。三个本地演示身份可从左下角切换，数据真实持久化，不是正式登录。

## 已实现

- 独立沟通频道和一对一私聊：Host 可建立机构内公开频道；所有角色可建立仅自己可见的个人频道；私聊仅双方可读写，运营无旁观权限。
- 聊天草稿本地保存、消息乐观发送、离线队列与失败重试，消息区搜索、表情和 Enter 发送。建立频道与首次打开私聊需要联网。
- 学员本周概览、任务勾选、练习草稿和提交、已发布反馈。
- Host 工作台、反馈草稿与发布、日程与改期冲突校验。
- 运营报名跟进、容量校验、入组、报名价格快照与付款状态查看。
- 独立机构数据与离线队列隔离，附带 Common Ground 演示工作区。
- SQLite 事务、幂等记录、乐观版本检查、审计事件。
- IndexedDB 草稿与 outbox，乐观更新、恢复联网后同步、冲突比较与显式选择。
- 导航分为机构汇总（左侧窄栏）、Household 选择（侧栏）、小组内容（组内标签）。不选小组时汇总当前机构内有权访问的数据，选择后练习、日程、成员和旅程仅显示该组内容；练习搜索覆盖当前机构，聊天页面搜索当前对话消息，频道列表搜索频道名称。
- 左下角“建立”按身份提供入口：学员写练习，Host 建任务与排课，运营建小组。创建表单草稿保存在本机；任务、排课和建组提交需联网，并检查机构权限与排课冲突。
- Slack 三栏布局、带图标导航、组织切换与前进/后退/历史菜单、可收起侧栏、导航显隐与排序、自定义配色、深色模式和紧凑间距。
- 已访问工作区的离线外壳缓存；设置内可模拟慢网与离线。构建版已验证停服后重新打开；开发模式受 Next.js 热更新影响，刷新页面仍需本地服务运行，已打开页面的草稿与队列可离线保存。

本地测试采用开发身份适配器，仅对 loopback Host + development 开启。正式部署前须接真实会话和角色管理；production 构建接口会拒绝演示访问。支付、会议接入、录音上传、自动通知尚未实现。

## 检查与数据迁移

```bash
npm run typecheck
npm test
npm run build
npm run db:export
npm run db:import -- data/exports/<export>.json data/restored.sqlite
```

`npm start` 启动 Next.js production 服务，不再静态导出；它用于构建检查，演示身份在 production 下关闭。本地体验请用 `npm run dev`。

## 结构

- `app/api`：Next.js HTTP 适配层。
- `domain`：共享实体与命令合同。
- `server/services`：与 Next.js/数据库驱动解耦的业务规则。
- `server/repositories`：持久化接口与 SQLite 适配器。
- `server/db/migrations`：数据库版本迁移。
- `local`：本地数据库、乐观视图与同步队列。
- `features/space`：三端功能视图。
- `app/fonts`：本地 Slack-Lato 字体、官方来源与许可证。
- `lib/content.ts`：官网课程文案与价格。
- `original-export/`：最初落地页产物，保留用于对照。

数据关系、同步协议、PostgreSQL 迁移边界见 [docs/architecture.md](docs/architecture.md)。

### 邮箱统一登录与注册

登录页先输入邮箱，再输入 6 位验证码；新用户在验证成功后创建账号，已有用户直接登录，不需要设置密码。验证码 10 分钟有效、一次性使用，60 秒后可重发，每个邮箱每小时最多发送 5 次，每个验证码最多尝试 5 次。登录会话保留 30 天，活跃使用时每周续期，退出登录立即使当前会话失效。

本地 `npm run dev` 且通过 localhost / 127.0.0.1 访问时，如果没有邮件配置，验证码只输出到开发服务终端（搜索 `IRIVA 本地邮件预览`），页面会明确提示未发送邮件。本地开发还可以输入 `000000` 通过当前有效的验证码请求；生产和非本机地址不接受这个测试码。此预览模式不会用于生产或局域网地址。

要实际发送邮件，将 `.env.example` 中的 `RESEND_API_KEY` 和 `AUTH_EMAIL_FROM` 配置到 `.env.local` 后重启开发服务。发件地址需使用 Resend 已验证的域名。验证码不会返回到浏览器 API 响应中。第三方 Google / 微信和在线支付仍待配置。

新用户填写学习需求后先进入独立 `/plans` 套餐页，选择付费套餐进入 `/checkout?order=…` 订单确认页。Free 用户可点击右下角「先聊聊看」进入客服工作区，本次登录不再重复拦截；退出登录后重置。联系 Host 仍需付费权益；后续由 Host 确认约谈、运营完成入组。

本地测试付款：在 localhost / 127.0.0.1 的开发服务中，订单页点击支付立即成功并开通套餐，后台记录 `checkout.test_paid` 审计事件，不产生真实扣款。生产环境和非本机地址禁用该入口。

Host 目录位于工作区 `/learn?view=hosts` 路由视图（旧 `/hosts` 自动跳转），支持按专业资质筛选及姓名、城市、专业搜索。全职 Host 使用金色细边框，明星 Host 使用炫彩细边框；明星 Host 仅 Pro / Max 可发起约谈，服务端也校验权限。当前四位 Host 的照片和资质为本地示例数据；运营需替换为真实资料。

资料完整性在进入 Host 列表时检查一次；未完善时工作区持续提醒，联系 Host 的服务端接口也会在创建对话、约谈及通知之前校验必填项。头像无会员边框；昵称后以银色 Lite、金色 Pro、彩色 Max 标签表示套餐。

主页按小组汇总任务完成、正式提交与 meeting 进度，综合分数为任务完成率 × 70 + 正式提交率 × 30（不是语言能力评分）；无任务时显示空值。个人资料为 `?view=profile` 工作区路由，从 Host 校验进入时保存后返回 Host 列表。

### Shared message cards

A message can contain plain `body` text, up to five `cards`, or both. Cards use a versioned reference format; arbitrary HTML, URLs, display text and prices are not accepted from the sender:

```json
{
  "channelId": "<channel UUID>",
  "body": "推荐你看看这位 Host 和这个套餐",
  "cards": [
    { "version": 1, "type": "host", "entityId": "<host UUID>" },
    { "version": 1, "type": "plan", "entityId": "pro" }
  ]
}
```

The five types are `user`, `task`, `group`, `host`, and `plan`; plans use `free`, `lite`, `pro`, or `max` as IDs. `domain/message-cards.ts` defines the shared schema. `server/services/message-cards.ts` resolves current public profile fields, basic summaries of accessible or explicitly shared groups, and plan data, and restricts task details to viewers who have access. The server validates sender permissions; references do not grant recipients access or enroll them in a group. Missing or inaccessible references render as unavailable. Cards remain reference-only in SQLite; the per-viewer snapshot catalog supplies current titles, descriptions and metadata without copying private profile fields into messages.

The composer supports selection, preview, removal, card-only sending, reactions, title search, persistent local drafts and the existing offline outbox. Card details route to user conversations, tasks, groups, Host contact (using the existing profile/plan checks), or the selected plan on the plans page. Unjoined group cards direct learners to support. Migration 010 preserves previous messages and reactions.


### 个人空间与 Host 小组

每位用户首次验证邮箱登录时拥有一个个人工作空间，不能添加成员。运营在主页或报名页的「Host 与小组管理」输入邮箱：已注册账号原空间直接升级，空间 ID、个人频道和消息保留；未注册邮箱保存待激活资格，首次登录即开通 Host 小组，跳过学员报名与套餐引导。邮箱忽略大小写，重复添加不重复开组。

Host 空间与小组一一对应。Host 在该空间主页添加已注册成员，成员保留自己的个人空间，可通过左上角切换空间；加入别人的小组时使用学员权限。个人频道仅本人可见，小组公共频道仅本空间成员可见。运营拥有所属平台 Host 小组管理权限，不获得个人空间访问权。

Host 在主页提交额外开组申请，运营可批准或拒绝；审批前不创建空间，同一 Host 同一平台只允许一个待审批申请，重复批准不会重复创建。成员人数仍受小组容量限制。

迁移 011 增加空间所有权、邮箱预授权和开组审批表。启动时一次性转换旧数据：原小组分别成为空间，保留小组 ID 及关联任务；Host 创建的旧公开频道归入其在原机构的首个小组，旧个人频道归入所有者个人空间，私聊仍保留原机构归属。迁移与升级均在事务内执行。平台入口保留目录、约谈、客服及运营汇总；新公共频道须在 Host 小组内创建。备份导出 v11 包含 Host 预授权和开组审批记录。
