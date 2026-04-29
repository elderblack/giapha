/** Định tuyến cố định cho ProfilePage khi xem hồ sơ người khác (xem apps/web/src/App.tsx). */
export function feedUserProfilePath(userId: string): string {
  return `/app/u/${userId}`
}
