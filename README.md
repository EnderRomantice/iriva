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

- 学员本周概览、任务勾选、练习草稿和提交、已发布反馈。
- Host 工作台、反馈草稿与发布、日程与改期冲突校验。
- 运营报名跟进、容量校验、入组、报名价格快照与付款状态查看。
- 独立机构数据与离线队列隔离，附带 Common Ground 演示工作区。
- SQLite 事务、幂等记录、乐观版本检查、审计事件。
- IndexedDB 草稿与 outbox，乐观更新、恢复联网后同步、冲突比较与显式选择。
- 导航分为机构汇总（左侧窄栏）、Household 选择（侧栏）、小组内容（组内标签）。不选小组时汇总当前机构内有权访问的数据，选择后练习、日程、成员和旅程仅显示该组内容；顶部搜索始终覆盖当前机构。
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
