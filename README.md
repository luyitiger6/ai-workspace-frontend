# 前端（Next.js）

Spring Boot Todo API 的前端工程：Next.js 16 App Router + React 19 + TypeScript。

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
│   ├── layout.tsx              根布局（语言、标题、全局样式）
│   ├── page.tsx                首页
│   ├── globals.css             全局样式
│   └── api/[...path]/route.ts  同源 API 代理
├── components/                 客户端组件
├── lib/                        后端 API 封装
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
docker build -t todo-frontend .
docker run -d --name todo-frontend -p 3000:3000 `
  -e BACKEND_URL=http://host.docker.internal:8989 `
  todo-frontend
```

- 多阶段构建（deps → builder → runner），运行阶段以非 root 用户 `nextjs` 执行 `node server.js`，容器内监听 `3000`（`EXPOSE 3000`）
- `BACKEND_URL` 在 Dockerfile 中有默认值 `http://localhost:8989`，可用 `-e` 覆盖；容器内的 `localhost` 指向容器自身，连宿主机后端请写 `host.docker.internal`
- 只改后端地址时不必重建镜像，重新创建容器即可

## 测试

组件与代理测试均不依赖后端进程：组件测试 mock `lib/api`，代理测试 mock 全局 `fetch`。
