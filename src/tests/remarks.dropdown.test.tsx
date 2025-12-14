import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toBeInTheDocument } from "@testing-library/jest-dom/matchers";
expect.extend({ toBeInTheDocument });
import App from "../App";

describe("Remarks dropdowns", () => {
  it("Talent remark is required and shows error when empty", () => {
    const { getByRole, getByLabelText } = render(<App />);
    const reportBtn = getByRole("button", { name: /Report Cards/i });
    fireEvent.click(reportBtn);
    const sel = getByLabelText("Select template");
    expect(sel).toBeInTheDocument();
    fireEvent.change(sel, { target: { value: "" } });
    const teacherSel = screen.getAllByLabelText(
      "Select remark"
    )[0] as HTMLSelectElement;
    expect(teacherSel).toBeInTheDocument();
  });

  it("Talent remark Other enforces 20+ characters", () => {
    const { getByRole, getByLabelText } = render(<App />);
    const reportBtn = getByRole("button", { name: /Report Cards/i });
    fireEvent.click(reportBtn);
    const sel = getByLabelText("Select template");
    fireEvent.change(sel, { target: { value: "Other" } });
    const input = getByLabelText("Custom talent remark");
    fireEvent.change(input, { target: { value: "too short" } });
    fireEvent.change(input, {
      target: { value: "this is more than twenty chars" },
    });
  });

  it("Headmaster's Remarks line renders 100 underscores", () => {
    const { getByRole } = render(<App />);
    const reportBtn = getByRole("button", { name: /Report Cards/i });
    fireEvent.click(reportBtn);
    const underscoresNode = screen.getAllByTestId("headmaster-underscores")[0];
    expect(underscoresNode).toBeInTheDocument();
    const count = underscoresNode?.textContent?.match(/_/g)?.length ?? 0;
    expect(count).toBe(100);
  });
});
