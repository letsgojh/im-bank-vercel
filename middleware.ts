import { NextResponse, type NextRequest } from "next/server";

// APP_PASSWORD가 설정되어 있으면 페이지와 API 전체에 기본 인증(브라우저 로그인 창)을 건다.
// 아이디는 아무거나, 비밀번호만 확인한다. 설정하지 않으면 누구나 접근 가능.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="im-bank-web", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
