import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PrivateLink } from "../private-link";
import { RETURNING_COOKIE } from "@/lib/auth/returning";

/**
 * The two states the plan asks for: present after signing in, absent in a fresh private window.
 *
 * Rendered rather than reasoned about, because the failure mode is a hydration one — the server
 * renders nothing and the client renders a link — and that only shows up when the component
 * actually runs.
 */

function clearCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0].trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  }
}

afterEach(clearCookies);

describe("PrivateLink", () => {
  it("renders nothing in a browser that has never signed in", () => {
    clearCookies();
    const { container } = render(<PrivateLink />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a link to /private once the hint is set", () => {
    document.cookie = `${RETURNING_COOKIE}=1; path=/`;
    render(<PrivateLink />);
    expect(screen.getByRole("link", { name: "Private" })).toHaveAttribute("href", "/private");
  });

  it("is not offered to crawlers", () => {
    // A personal shortcut on every public page is not something to hand a search engine.
    document.cookie = `${RETURNING_COOKIE}=1; path=/`;
    render(<PrivateLink />);
    expect(screen.getByRole("link", { name: "Private" })).toHaveAttribute("rel", "nofollow");
  });

  it("stays hidden when an unrelated cookie is present", () => {
    clearCookies();
    document.cookie = "theme=dark; path=/";
    const { container } = render(<PrivateLink />);
    expect(container).toBeEmptyDOMElement();
  });

  it("passes its class through, so the footer controls its own styling", () => {
    document.cookie = `${RETURNING_COOKIE}=1; path=/`;
    render(<PrivateLink className="text-primary" />);
    expect(screen.getByRole("link", { name: "Private" })).toHaveClass("text-primary");
  });
});
