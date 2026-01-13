import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
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

describe("App", () => {
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
      if (typeof _url === "string" && _url.includes("/api/progress")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            progress: 50,
            total: 10,
            completed: 5,
            incomplete: [],
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

  it("renders header and navigates to Subject view", async () => {
    vi.mocked(apiClient.getStudents).mockResolvedValue([
      {
        id: "S1",
        surname: "Test",
        firstName: "Student",
        class: "JHS 2(A)",
        status: "Active",
      },
    ]);
    vi.mocked(apiClient.request).mockResolvedValue({
      user: {
        role: "HEAD",
        fullName: "Test User",
        username: "testuser",
        assignedClassName: null,
        assignedSubjectName: null,
      },
    });
    vi.mocked(apiClient.getSubjectSheet).mockResolvedValue({ rows: [] });
    vi.mocked(apiClient.getTalentRemarks).mockResolvedValue({ groups: [] });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    expect(await screen.findByText(/E-SBA \[JHS]/)).toBeInTheDocument();
    expect(await screen.findByText(/Core Subjects/)).toBeInTheDocument();

    const tile = await screen.findByRole("button", { name: /Mathematics/i });
    fireEvent.click(tile);
    expect(
      await screen.findByRole("heading", { name: /Assessment Sheet/i })
    ).toBeInTheDocument();

    // Verify ProgressBar appears
    await waitFor(async () => {
      // The ProgressBar renders "{subjectName} Progress"
      expect(
        await screen.findByText("Mathematics Progress")
      ).toBeInTheDocument();
    });
  });

  it("clamps marks values to valid ranges", async () => {
    vi.mocked(apiClient.getStudents).mockResolvedValue([
      {
        id: "T1",
        surname: "TEST",
        firstName: "Student",
        class: "JHS 2(A)",
        status: "Active",
      },
    ]);
    vi.mocked(apiClient.request).mockResolvedValue({
      user: {
        role: "HEAD",
        fullName: "Test User",
        username: "testuser",
        assignedClassName: null,
        assignedSubjectName: null,
      },
    });
    vi.mocked(apiClient.getSubjectSheet).mockResolvedValue({ rows: [] });
    vi.mocked(apiClient.getTalentRemarks).mockResolvedValue({ groups: [] });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Wait for initial render
    await screen.findByText(/Welcome, Test User/i);

    // Find the Mathematics tile directly
    const mathTile = await screen.findByRole("button", {
      name: /Mathematics/i,
    });
    fireEvent.click(mathTile);

    await screen.findByRole("heading", { name: /Assessment Sheet/i });

    // Need to wait for students to be populated in the table
    await waitFor(() => {
      expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
    });

    const inputs = screen.getAllByRole("spinbutton");
    const examInput = inputs[inputs.length - 1];
    fireEvent.change(examInput, { target: { value: "120" } });
    expect((examInput as HTMLInputElement).value).toBe("100");
  });
});
