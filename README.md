# 前端（Next.js）

wanderchain 的前端工程：Next.js 16 App Router + React 19 + TypeScript。首页内容由本地 Mock 契约提供，真实 API 接入时只替换仓储实现；认证已接入后端真实接口。

## 环境要求

- Node.js >= 20.9.0（Next.js 16 的最低要求）
- npm（随 Node.js 提供）

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm ci` | 按 `package-lock.json` 可复现安装依赖 |
| `npm run dev` | 启动开发服务器，默认 http://localhost:3000 |
| `npm run build` | 生产构建（含 TypeScript 类型检查），产物在 `.next/` |
| `npm run start` | 以生产模式启动（需先执行 `npm run build`） |
| `npm run test` | 运行 Vitest 测试（jsdom + React Testing Library） |

## 目录结构

```
frontend/
├── app/                        路由与页面
│   ├── layout.tsx              根布局（语言、元信息、认证与 AI 助手 Provider）
│   ├── page.tsx                首页（城市筛选 + 五个区块）
│   ├── community/              旅游社区占位页
│   ├── attractions/            景点攻略占位页
│   ├── login/ register/        登录与两步注册
│   ├── globals.css             设计令牌与基础排版
│   └── api/[...path]/route.ts  同源 API 代理
├── components/
│   ├── home/                   导航、城市入口、AI 助手与三类内容区块
│   ├── auth/                   认证（Provider、表单、账号菜单）
│   └── site/                   页头、页脚与占位页
├── lib/
│   ├── home/                   类型契约、城市白名单、Mock 数据与仓储
│   ├── contracts/              后端 DTO 的镜像契约（字段名唯一真源）
│   └── auth/                   认证 HTTP 客户端与错误归一化
├── public/                     静态资源
├── next.config.ts              Next.js 配置（standalone 产物）
├── vitest.config.ts            测试配置
└── vitest.setup.ts             jest-dom 断言扩展
```

## 与后端的关系

浏览器只访问同源的 `/api/*`，由本工程的服务端代理转发到 Spring Boot（默认 `http://localhost:8989`），后端不开放 CORS。

## 后端地址与部署

`BACKEND_URL` 是运行期配置，每个请求读取一次：

- 默认值 `http://localhost:8989`
- 修改后重启前端进程生效，**不需要重新构建产物**
- PowerShell 示例：`$env:BACKEND_URL="http://backend.internal:8989"; npm run start`
- 反向代理为可选前置：若部署层已把 `/api` 转发到后端（多实例或统一入口场景），请求不会到达本代理，此变量保持默认即可
- 代理透传 method、请求体、`content-type`、状态码与响应体，并按白名单转发 `cookie` / `origin` / `referer`；上游的 `Set-Cookie` 逐条回传。`host` 与 `x-forwarded-for` 不转发也不伪造：后端的来源校验是 fail-closed 的，客户端可操纵的值会把安全判定变成摆设

## 容器镜像

在 `frontend/` 目录下构建与运行：

```powershell
docker build -t wanderchain-frontend .
docker run -d --name wanderchain-frontend -p 3000:3000 `
  -e BACKEND_URL=http://host.docker.internal:8989 `
  wanderchain-frontend
```

- 多阶段构建（deps → builder → runner），运行阶段以非 root 用户 `nextjs` 执行 `node server.js`，容器内监听 `3000`（`EXPOSE 3000`）
- `BACKEND_URL` 在 Dockerfile 中有默认值 `http://localhost:8989`，可用 `-e` 覆盖；容器内的 `localhost` 指向容器自身，连宿主机后端请写 `host.docker.internal`
- 只改后端地址时不必重建镜像，重新创建容器即可

## 认证接入

认证走后端真实接口，前端不保留任何本地会话：

- **契约单一真源**：`lib/contracts/auth.ts` 逐字镜像后端 `web/auth/dto/*.java` 的 record 组件名，一律 camelCase。
  改字段先改后端 DTO，再改这个文件；`harness/checks/10-contract-check.ps1` 会解析两侧字段集合做双向比对，
  只改一侧直接拦下
- **令牌不可读**：会话令牌只经 `Set-Cookie` 下发（`HttpOnly` / `SameSite=Lax` / `Path=/`，无 `Domain`），
  响应体里没有令牌；前端也不写 `localStorage` / `sessionStorage`
- **会话只有一个真源**：`AuthProvider` 挂载时调 `GET /api/auth/me`，登录与注册成功后再调一次刷新；
  界面显示名只取 `/me` 的返回值，不取登录响应里的近似值
- **探测失败归访客态**：`/me` 返回 401、5xx 或网络不可达都归 `guest`，不白屏也不弹错（探测不是用户操作的结果）
- **图形码按需出现**：登录默认不取图形码，只有后端返回 `CAPTCHA_INVALID` 才取码并带码重试；
  注册则固定两步（图形码换邮箱码 → 提交邮箱码注册）
- **错误码固定七个**：`UNAUTHENTICATED` / `EMAIL_UNVERIFIED` / `CROSS_SITE_REJECTED` / `INVALID_CODE` /
  `CAPTCHA_INVALID` / `RATE_LIMITED` / `VALIDATION_FAILED`，到英文文案的映射集中在 `lib/auth/auth-api.ts`；
  非契约错误体（例如代理兜底的 502）回落到错误原文，不伪装成业务文案

## 测试

组件与代理测试均不依赖后端进程：内容区块测试使用本地 Mock 仓储，认证测试与代理测试都桩掉全局 `fetch`。
因为 `AuthProvider` 挂载就会发 `GET /api/auth/me`，所有渲染根布局的页面测试也必须桩 `fetch`（通常回 401）。

后端本地限流的 `trusted-proxies` 为空时，所有请求同属「未知来源」共享同一个失败计数桶，
真实调用很容易把桶踩满；因此测试一律不打真实后端。
