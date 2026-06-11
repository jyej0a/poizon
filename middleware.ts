import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 보호해야 할 구역(대시보드 등)을 정의합니다.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // 보호된 구역에 접근하려 할 때, 로그인이 안 되어 있다면 보호 조치를 취합니다.
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Next.js 내부 파일 및 모든 정적 파일을 제외한 모든 경로를 검사합니다.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API 라우트는 항상 실행합니다.
    "/(api|trpc)(.*)",
  ],
};
