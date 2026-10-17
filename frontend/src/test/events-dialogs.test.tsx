import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import EventsPage from "@/features/events/EventsPage";
import { EVENTS, EVENT_CATEGORIES } from "@/features/events/data/eventDetails";

// EventsPage links to /team; a plain anchor is enough outside a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const drawerLayer = () => document.querySelector(".ep-drawer-layer");

describe("event drawer + registration form", () => {
  it("Escape closes the form on top first, then the drawer, and unlocks scrolling", async () => {
    render(<EventsPage events={EVENTS} categories={EVENT_CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: "Rangoli" }));
    await waitFor(() => expect(drawerLayer()).toHaveClass("is-open"));

    const drawer = screen.getByRole("dialog", { name: /Rangoli/ });
    fireEvent.click(within(drawer).getByRole("button", { name: "Register for Rangoli" }));
    expect(screen.getByRole("heading", { name: "Register for Rangoli" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("heading", { name: "Register for Rangoli" })).not.toBeInTheDocument();
    expect(drawerLayer()).toHaveClass("is-open");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(drawerLayer()).not.toHaveClass("is-open"));
    expect(document.body.style.overflow).toBe("");
  });
});
