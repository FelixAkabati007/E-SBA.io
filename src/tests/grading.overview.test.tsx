import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
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
    getAllClassMarks: vi.fn(),
    getClassAttendance: vi.fn(),
  },
}));

describe("Grading Overview", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-token");
    vi.clearAllMocks();

    vi.mocked(apiClient.request).mockResolvedValue({
      user: {
        role: "HEAD",
        fullName: "Test User",
        username: "testuser",
      },
    });
    vi.mocked(apiClient.getStudents).mockResolvedValue([]);
    vi.mocked(apiClient.getAllClassMarks).mockResolvedValue({});
    vi.mocked(apiClient.getClassAttendance).mockResolvedValue([]);

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    );
  });

  it("renders Grading Overview with legend", async () => {
    const { getByText, findByRole } = render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Wait for data load
    await waitFor(() => expect(apiClient.request).toHaveBeenCalled());

    const reportBtn = await findByRole("button", { name: /Report Cards/i });
    fireEvent.click(reportBtn);

    // Wait for view change
    const title = await waitFor(() => getByText("Grading Overview"));
    expect(title).toBeInTheDocument();
    const legend = getByText("Grading Scale");
    expect(legend).toBeInTheDocument();
  });
});
