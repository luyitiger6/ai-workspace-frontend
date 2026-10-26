# 前端（Next.js）

wanderchain 的前端工程：Next.js 16 App Router + React 19 + TypeScript。首页内容由本地 Mock 契约提供，真实 API 接入时只替换仓储实现。

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
│   ├── login/ register/        Mock 登录与注册
│   ├── globals.css             设计令牌与基础排版
│   └── api/[...path]/route.ts  同源 API 代理
├── components/
│   ├── home/                   导航、城市入口、AI 助手与三类内容区块
│   ├── auth/                   Mock 认证（Provider、表单、账号菜单）
│   └── site/                   页头、页脚与占位页
├── lib/
│   ├── home/                   类型契约、城市白名单、Mock 数据与仓储
│   └── auth/                   Mock 注册、登录与会话
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
- 代理只透传 method、请求体、`content-type`、状态码与响应体；后端不开放 CORS，接口路径不变

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

## Mock 认证的边界

`lib/auth/mock-auth.ts` 是**接口形状的占位实现**，不是可用的认证：

- 账号与会话只存在浏览器 `localStorage`，密码以**明文**保存，令牌是 `alg: none` 的假签名，服务端不做任何校验
- 生产构建（`NODE_ENV=production`）下注册与登录会直接返回错误，避免演示代码被当成真认证部署出去
- 换成真实认证需要另立项：服务端签发 JWT、`HttpOnly` Cookie、BCrypt 哈希与用户表
- 不要用「前端加密密码」缓解：密钥与密文在同一次下载里，不构成任何防护

## 测试

组件与代理测试均不依赖后端进程：内容区块测试使用本地 Mock 仓储，认证测试使用 localStorage，代理测试 mock 全局 `fetch`。
