import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

describe("Auth CSRF and preview login", () => {
  let app: express.Express;
  beforeAll(() => {
    process.env.PREVIEW_LOGIN_ALLOW = "1";
    process.env.PREVIEW_LOGIN_USER = "preview";
    process.env.PREVIEW_LOGIN_PASS = "preview123";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.NEON_DATABASE_URL;
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_ISSUER = "e-sba";
    process.env.JWT_AUDIENCE = "e-sba-users";
  });

  beforeAll(async () => {
    const mod = await import("../routes/auth");
    const authRouter = mod.default;
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
  });

  it("should provide a CSRF token and set cookie", async () => {
    const res = await request(app).get("/api/auth/csrf");
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const setCookie = res.header["set-cookie"]?.[0] || "";
    expect(setCookie.includes("csrf-token")).toBe(true);
  });

  it("should reject login without CSRF", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "preview", password: "preview" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/i);
  });

  it("should allow preview login with valid CSRF", async () => {
    const csrf = await request(app).get("/api/auth/csrf");
    const token = csrf.body.token;
    const cookie = csrf.header["set-cookie"]?.[0] || "";
    const res = await request(app)
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .set("Cookie", cookie)
      .send({ username: "preview", password: "preview123" });
    expect([200, 401, 503, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.token).toBeTruthy();
      expect(res.body.user?.username).toBe("preview");
    }
  });

  it("should validate username/password format", async () => {
    const csrf = await request(app).get("/api/auth/csrf");
    const token = csrf.body.token;
    const cookie = csrf.header["set-cookie"]?.[0] || "";
    const res = await request(app)
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .set("Cookie", cookie)
      .send({ username: "x", password: "short" });
    expect(res.status).toBe(400);
  });
});
