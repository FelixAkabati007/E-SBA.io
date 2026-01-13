import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../App";
import { AuthProvider } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";

// Mock apiClient
vi.mock("../lib/apiClient", () => ({
  apiClient: {
    getStudents: vi.fn(),
    getSubjectSheet: vi.fn(),
    request: vi.fn(),
    getTalentRemarks: vi.fn(),
  },
}));

describe("RBAC Progress Bars", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "fake-token");
    vi.clearAllMocks();

    // Mock global fetch for ProgressBar
    global.fetch = vi.fn().mockImplementation((_url) => {
      if (typeof _url === "string" && _url.includes("/api/config/academic")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            academicYear: "2025/2026",
            term: "Term 1",
          }),
        });
      }
      if (typeof _url === "string" && _url.includes("/api/config/school")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: "Test School",
            motto: "Test Motto",
            headTeacher: "Test Head",
            address: "Test Address",
            catWeight: 50,
            examWeight: 50,
            logoUrl: null,
            signatureEnabled: true,
            headSignatureUrl: null,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows only assigned subject progress for SUBJECT teacher", async () => {
    vi.mocked(apiClient.getStudents).mockResolvedValue([]);
    vi.mocked(apiClient.request).mockResolvedValue({
      user: {
        role: "SUBJECT",
        fullName: "Math Teacher",
        username: "mathuser",
        assignedClassName: null,
        assignedSubjectName: "Mathematics",
      },
    });
    vi.mocked(apiClient.getSubjectSheet).mockResolvedValue({ rows: [] });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome, Math Teacher")).toBeInTheDocument();
    });

    // Check Assessment Progress Section
    await waitFor(() => {
      expect(screen.getByText(/Assessment Progress/)).toBeInTheDocument();
    });

    // Mathematics should be visible
    expect(screen.getAllByText("Mathematics").length).toBeGreaterThan(0);

    // English Language should NOT be present
    const englishElements = screen.queryAllByText("English Language");
    expect(englishElements.length).toBe(0);
  });

  it("shows only assigned class progress for CLASS teacher", async () => {
    vi.mocked(apiClient.getStudents).mockResolvedValue([]);
    vi.mocked(apiClient.request).mockResolvedValue({
      user: {
        role: "CLASS",
        fullName: "Class Teacher",
        username: "classuser",
        assignedClassName: "JHS 1(A)",
        assignedSubjectName: null,
      },
    });
    vi.mocked(apiClient.getSubjectSheet).mockResolvedValue({ rows: [] });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome, Class Teacher")).toBeInTheDocument();
    });

    // Should see assessment progress
    await waitFor(() => {
      expect(screen.getByText(/Assessment Progress/)).toBeInTheDocument();
    });
  });

  it("shows all subjects for HEAD teacher", async () => {
    vi.mocked(apiClient.getStudents).mockResolvedValue([]);
    vi.mocked(apiClient.request).mockResolvedValue({
      user: {
        role: "HEAD",
        fullName: "Head Teacher",
        username: "headuser",
        assignedClassName: null,
        assignedSubjectName: null,
      },
    });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome, Head Teacher")).toBeInTheDocument();
    });

    expect(screen.getByText(/Assessment Progress/)).toBeInTheDocument();

    // Should see multiple subjects
    expect(screen.getAllByText("Mathematics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("English Language").length).toBeGreaterThan(0);
  });
});
