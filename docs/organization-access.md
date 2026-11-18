# 统一登录、组织权限与操作日志

邮箱入口 `/signin` 先识别身份。有团队组织权限的账号（owner/admin/partner）走密码验证，其他账号继续邮箱验证码。历史 `/team/signin` 重定向到统一入口。授权为团队成员会使已有邮箱会话失效；旧验证码不能绕过密码验证。

## 共同底层

`organizations` + `organization_access` 是团队和 Home 共同的结构；`organization_access` 以组织和用户为联合主键，角色为 owner/admin/partner。Home 的创建者为 owner，其他参与者为 partner。学习者、Host、运营等业务角色仍由原有业务成员表表达，不因 Home owner 自动获得团队管理权限。

- owner：组织管理、添加 admin/partner、转移所有权给本组织其他 admin。
- admin：组织运营、添加或移除 admin/partner、查看日志；不能移除或降级 owner，不能改自己的权限。
- partner：查看组织概况、创建和更新协作待办；不能管理成员、权限、Host、申请或复盘发布，也不能读取操作日志与申请资料。

组织选择保存为 HttpOnly cookie。每次请求都从数据库验证组织成员关系；写入事务内重新验证，组织切换时整页导航清除旧组织客户端状态。待办、申请、建议、Host 列表、小组与复盘都按组织隔离。

## 记录范围

后台数据读取、成员与运营操作、组织切换/创建/所有权转移、复盘处理、登录/退出记录到 `organization_audit`。操作与成功日志同一事务；被拒绝/失败操作回滚后单独留痕。日志不保存密码、验证码或完整请求体。PostgreSQL 运行角色只能读取和追加日志，不能修改或删除。

日志页支持操作者、操作、结果、北京时间日期范围、关键词、排序和每页 25 条分页。翻页固定查询截止时间，避免新记录导致重复或遗漏；刷新重建快照。

## 迁移

- SQLite：`023_organization_access.sql`，本地启动自动执行。
- PostgreSQL：`20261117100000_organization_access.sql`，通过现有 `scripts/migrate-supabase.ts --schema-only` 显式应用。
- 原团队成员映射为 admin/partner；保留已有 owner，否则优先选择原明确授权的 admin 为 owner，再兼容旧 ops。
- 原业务数据保留，旧全局运营数据归属原 IRIVA 组织；已有后台会话需重新密码登录。
- 当前开发配置使用远程 Supabase。只在确认目标环境后应用远程迁移，应用代码与迁移需同步交付。

## 验证

`npm run typecheck`、`npm test`、`npm run test:postgres`。

`npm run test:teams` 使用随机命名的独立本地 PostgreSQL 数据库，启动 3119 测试服务，覆盖实际 HTTP 登录、组织切换、Partner 越权、跨组织写入和日志筛选；结束清理数据库和测试角色。先完成 Next 构建。加 `-- --serve` 保留临时服务供浏览器验收，Ctrl+C 清理。

首个管理员的维护入口仍是受信任服务端命令 `team:account`；产品界面不提供自行注册或自我提升为 admin 的入口。
