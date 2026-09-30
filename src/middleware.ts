export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*", "/customers/:path*", "/orders/:path*", "/inventory/:path*",
    "/service-calendar/:path*", "/service-map/:path*", "/tasks/:path*", "/leads/:path*",
    "/automations/:path*", "/integrations/:path*", "/reports/:path*", "/ai/:path*",
    "/access/:path*", "/users/:path*", "/pipeline/:path*", "/activity/:path*", "/audit/:path*", "/settings/:path*",
  ],
};

