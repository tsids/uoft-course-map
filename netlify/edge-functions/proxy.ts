export default async (request: Request, context: { ip: string }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  return fetch("https://gateway.umami.is/api/send", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
      "user-agent": request.headers.get("user-agent") ?? "",
      "x-umami-client-ip": context.ip,
    },
    body: await request.text(),
  });
};

export const config = { path: "/api/send" };
