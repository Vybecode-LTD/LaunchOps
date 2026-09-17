import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { API, DATABASE_OUTAGE, makeProject, makeState } from "./fakeApi";
import { renderApp } from "./renderApp";
import { server } from "./server";

// Changes that show at once and are rolled back if the save fails (lib/queries/hooks.ts).
// A launch date moved on the calendar is covered in app.calendar.test.tsx.
describe("Changes shown before the server confirms them", () => {
  it("unticks a launch plan item that couldn't be saved and says why", async () => {
    const project = makeProject({ checklist: {} });
    const { user } = renderApp(`/projects/${project.id}/plan`, makeState({ projects: [project] }));
    server.use(http.patch(`${API}/api/products/:id/checklist`, () => HttpResponse.json({ detail: DATABASE_OUTAGE }, { status: 503 })));

    await user.click(await screen.findByLabelText("Beta testers recruited"));

    expect(await screen.findByText("Launch plan not saved")).toBeInTheDocument();
    expect(screen.getByText(DATABASE_OUTAGE)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Beta testers recruited")).not.toBeChecked());
  });
});
