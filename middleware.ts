import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((request) => {
  const isProtected = ['/kasir', '/dashboard', '/admin', '/rekap', '/receipt'].some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !request.auth) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/kasir/:path*', '/dashboard/:path*', '/admin/:path*', '/rekap/:path*', '/receipt/:path*'],
};
