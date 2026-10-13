# Tango Finance Studio

基于课程项目 [Tango Finance](https://github.com/Hu-Tianze/Tango-Finance) 的需求，独立重设计并实现的个人财务管理作品。原课程仓库在本地 `origin_resource/` 仅供功能对照，并被 Git 忽略；新版代码位于本仓库的 `src/` 和 `server/`。

## 功能

- 邮箱注册、登录、退出；PostgreSQL 保存各用户的交易与预算
- 交易增删改、按月份/类型/分类/关键词筛选、CSV 导出
- 收支趋势、分类排行、月度预算和超支提示
- CNY、GBP、USD、EUR 原币记账；外币交易保存人民币金额、使用汇率、观察日期和来源
- 历史汇率由 [Frankfurter v2](https://frankfurter.dev/) 获取并缓存；服务故障时可输入手动汇率，系统不会悄悄使用过期汇率
- 不启动后端时，前端仍可使用浏览器本地演示账本

## 快速运行

需要 Node.js 20.19+、npm。完整模式还需要 Docker Compose 或可用的 PostgreSQL 17 服务。

### 只看演示版

```bash
npm ci
npm run dev
```

打开 `http://localhost:5173`。若 API 不可用，页面自动进入演示模式。演示数据只存在当前浏览器，汇率为固定示例值。

### 完整登录版

```bash
cp .env.example .env
docker compose up -d db
npm ci
npm run migrate
npm run dev:api
```

再开一个终端运行 `npm run dev`，打开 `http://localhost:5173` 注册账户。`dev:api` 在 3001 端口运行，Vite 将 `/api` 代理到它。若你已有 PostgreSQL，可以不用 Docker，直接在 `.env` 中设置 `DATABASE_URL`。`.env.example` 中的密码只用于本地演示，不要用于公开部署。

也可以直接运行 `docker compose up --build`，使用容器内的 PostgreSQL 和生产构建，在 `http://localhost:3001` 打开应用。

## 数据与汇率设计

- 金额在数据库中按最小货币单位（分）保存，折算使用 Decimal.js 并只在写入时四舍五入一次。
- 外币交易创建或编辑时，根据交易日期查询历史汇率，并把汇率与折算结果写入交易行。之后汇率变化不会改写旧账。
- 先查精确日期缓存，再请求 Frankfurter。请求失败会返回明确错误；用户可以手动提供汇率并在记录中看到 `MANUAL` 来源。
- `rateDate` 表示汇率服务返回的观察日期，可能与交易日期不同；CSV 同时导出汇率、日期和来源。
- 预算按分类设置，每个月沿用同一组预算金额。

## 安全与数据控制

- 密码使用随机盐和 scrypt 哈希；登录会话为随机令牌，数据库只保存令牌哈希。
- 登录 Cookie 为 HttpOnly、SameSite=Strict；HTTPS 部署时启用 Secure。所有写入请求检查 `APP_ORIGIN`，认证接口有速率限制。
- 每个数据库查询均按登录用户限定；SQL 使用参数化查询。交易修改与审计记录在同一数据库事务中提交。
- 用户可以导出 CSV，或在设置页输入密码删除账户及其数据。数据库备份由部署者单独管理。

本项目是作品集应用，尚未实现原课程项目的 AI 录入、风控审计规则、邮箱 OTP 或密码找回；`audit_events` 只记录交易操作类型与时间。不要在简历中把这些未实现能力写成新版成果。

## 测试与部署

```bash
npm test
npm run build
```

本地未配置 `TEST_DATABASE_URL` 时，PostgreSQL API 集成测试会跳过；设置它并先运行 `npm run migrate` 后，测试会覆盖注册、账户隔离、汇率快照、预算、删除与来源校验。GitHub Actions 在 PostgreSQL 17 服务中运行完整测试、构建和生产依赖审计。

`Dockerfile` 将前端与 API 打包为同源服务，容器启动时运行版本化数据库迁移。公开部署时，请使用托管 PostgreSQL 和 HTTPS。不要把本地 `compose.yaml` 的示例密码用于生产。

### Render 上线状态

- 线上地址：[tango-finance-studio.onrender.com](https://tango-finance-studio.onrender.com/)；源码：[witcher2333/Finance_web](https://github.com/witcher2333/Finance_web)
- Web 服务与 PostgreSQL 17 均位于新加坡区域，使用免费计划；`DATABASE_URL` 在 Render 环境变量中配置，没有进入仓库
- 2026-10-13 已验证 HTTPS 页面、`/api/ready`、安全登录 Cookie、注册/登录/退出、交易保存、历史汇率和账户删除；测试账户已删除
- 当前服务通过公开 GitHub URL 创建。**推送新提交后，需在 [Web 服务控制台](https://dashboard.render.com/web/srv-db6vkojncjis73f14frg) 手动选择 Deploy latest commit**；这个连接方式不会自动部署 GitHub 更新

仓库根目录的 `render.yaml` 是以后在**新 Render 工作区**使用的 Blueprint 模板：它定义了数据库连接、`/api/ready` 健康检查，以及通过 GitHub CI 后自动部署。当前线上服务是单独创建的，未与这个 Blueprint 绑定；不要在现有工作区再次创建同名资源。当前服务已能通过 `/api/ready` 检查数据库，但 Render 控制台的健康检查路径尚未设置为该接口。应用读取 HTTPS `RENDER_EXTERNAL_URL` 作为默认请求来源并启用安全 Cookie；绑定自定义域名时，请在 Web 服务环境变量中设置 `APP_ORIGIN=https://你的域名`。

**免费方案只适合短期演示。**Render 免费 Web 服务空闲约 15 分钟后会休眠，首次访问需要等待唤醒；本次免费 PostgreSQL 将于 **2026-11-12** 到期，到期后登录数据不可用。要长期放在简历中，请在到期前升级数据库并安排备份。

- 存活检查：`GET /api/health`
- 数据库就绪检查：`GET /api/ready`；部署平台可定期检查并在失败时告警
- 服务日志为结构化 JSON，包含请求 ID、路径、状态和耗时，不记录请求体、密码或交易备注
- 在有 `pg_dump` 且获准连接数据库的环境中，设置 `DATABASE_URL` 后运行 `sh scripts/backup.sh`；备份默认保存到被 Git 忽略的 `backups/`，文件权限仅限当前用户。当前 Render 数据库的外部 IP 允许列表为空，不能直接从本机运行脚本；长期使用时需先规划数据库访问和备份方案，并演练恢复

当前已上线，但 Render 控制台尚未配置 `/api/ready` 健康检查路径或额外的告警通知。长期展示前建议补上这两项。

## 项目结构

```text
src/                 React 界面、演示模式与 API 客户端
server/app.js        认证、交易、预算与账户 API
server/fx.js         历史汇率及缓存策略
server/domain.js     金额与输入规则
server/migrations/   PostgreSQL 版本化建表脚本
server/test/         单元测试及数据库集成测试
.github/workflows/ci.yml  CI 流程
```

## 简历表述建议

在你能独立运行和解释实现后，可以写：

> **Tango Finance Studio｜个人财务管理 Web 应用（独立复现与重设计）**：基于课程项目需求，使用 React、Express 和 PostgreSQL 重新实现账户、交易和预算管理；设计多币种历史汇率快照与异常回退流程，补充账户隔离、CSV 导出、自动化测试及容器化部署配置。

面试时说明：原课程项目是团队成果，你当时承担辅助角色；上述新版由你按原需求独立复现和升级。正式部署、真实用户量或性能数据，只有实际完成后再加入简历。
