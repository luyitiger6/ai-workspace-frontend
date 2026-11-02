/**
 * 作者判定只靠服务端返回的 `authorPublicId` 与当前账户比对。
 * 前端的展示判断不构成权限：真正的 403/404 仍由后端裁定。
 */
export function isPostAuthor(authorPublicId: string, accountPublicId: string | null): boolean {
  return accountPublicId !== null && accountPublicId === authorPublicId
}
