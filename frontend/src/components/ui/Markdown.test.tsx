import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("opens links in a new tab without giving that page access to LaunchOps", () => {
    render(<Markdown>{"Read [the launch post](https://dsp.vybecod.example/launch)."}</Markdown>);

    const link = screen.getByRole("link", { name: "the launch post" });
    expect(link).toHaveAttribute("href", "https://dsp.vybecod.example/launch");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders tables in a container that scrolls sideways when they're wide", () => {
    render(<Markdown>{"| Tier | Price |\n| --- | --- |\n| Pro | $29/mo |"}</Markdown>);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("cell", { name: "$29/mo" })).toBeInTheDocument();
    expect(table.parentElement).toHaveStyle({ overflowX: "auto" });
  });

  it("shows HTML from the model as text and drops unsafe link addresses", () => {
    const { container } = render(<Markdown>{"Hi <img src=x onerror=alert(1)> [claim your prize](javascript:alert(1))"}</Markdown>);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    const link = screen.getByText("claim your prize");
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("href", expect.stringContaining("javascript"));
  });

  it("removes the citation tags that web search adds to the text", () => {
    render(<Markdown>{'The market for plugin tools is $2B<cite index="1-2">, growing 9% a year</cite>.'}</Markdown>);

    expect(screen.getByText("The market for plugin tools is $2B, growing 9% a year.")).toBeInTheDocument();
    expect(screen.queryByText(/cite/)).not.toBeInTheDocument();
  });
});
