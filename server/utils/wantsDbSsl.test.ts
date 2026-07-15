import { describe, expect, it } from "vitest";
import { wantsDbSsl } from "./wantsDbSsl";

describe("wantsDbSsl", () => {
  it("env DB_SSL=true força true (mesmo em URL local)", () => {
    expect(wantsDbSsl("mysql://root@localhost/db", "true")).toBe(true);
  });

  it("URL sem SSL e sem env → false (fluxo local)", () => {
    expect(wantsDbSsl("mysql://root@localhost:3306/db")).toBe(false);
  });

  it("URL com sslaccept=strict → true", () => {
    expect(wantsDbSsl("mysql://u:p@host/db?sslaccept=strict")).toBe(true);
  });

  it("URL com ssl-mode=REQUIRED → true", () => {
    expect(wantsDbSsl("mysql://u:p@host/db?ssl-mode=REQUIRED")).toBe(true);
  });

  it("URL com ssl=true → true", () => {
    expect(wantsDbSsl("mysql://u:p@host/db?ssl=true")).toBe(true);
  });

  it("host TiDB Cloud → true (mesmo sem query flag)", () => {
    expect(wantsDbSsl("mysql://u:p@gateway01.tidbcloud.com/db")).toBe(true);
  });

  it("host PlanetScale → true", () => {
    expect(wantsDbSsl("mysql://u:p@aws.connect.psdb.cloud/db")).toBe(true);
    expect(wantsDbSsl("mysql://u:p@x.planetscale.com/db")).toBe(true);
  });

  it("host Aiven → true", () => {
    expect(wantsDbSsl("mysql://u:p@x.aivencloud.com:12345/db")).toBe(true);
  });

  it("host Render → true", () => {
    expect(wantsDbSsl("mysql://u:p@x.render.com/db")).toBe(true);
  });

  it("case-insensitive na detecção de host", () => {
    expect(wantsDbSsl("mysql://u:p@AWS.CONNECT.PSDB.CLOUD/db")).toBe(true);
  });

  it("URL vazia / null / undefined → false (não crasha)", () => {
    expect(wantsDbSsl("")).toBe(false);
    expect(wantsDbSsl(null as any)).toBe(false);
    expect(wantsDbSsl(undefined as any)).toBe(false);
  });

  it("env DB_SSL diferente de 'true' não força", () => {
    expect(wantsDbSsl("mysql://root@localhost/db", "1")).toBe(false);
    expect(wantsDbSsl("mysql://root@localhost/db", "yes")).toBe(false);
    expect(wantsDbSsl("mysql://root@localhost/db", "")).toBe(false);
    expect(wantsDbSsl("mysql://root@localhost/db", null)).toBe(false);
  });
});
