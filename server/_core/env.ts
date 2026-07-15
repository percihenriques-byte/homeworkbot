export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // URL pública do próprio app. Sem Forge (deploy standalone tipo Render),
  // usamos essa pra transformar /uploads/foo.png em URL absoluta que o LLM
  // consegue baixar. Render injeta RENDER_EXTERNAL_URL sozinho; em outros
  // hosts, defina APP_PUBLIC_URL manualmente. Sem trailing slash.
  appPublicUrl: (
    process.env.APP_PUBLIC_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    ""
  ).replace(/\/+$/, ""),
};
