import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createQueryClient } from "@/app/queryClient";
import { routeObjects } from "@/app/routes";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/Overlay";
import { handlers, type FakeState } from "./fakeApi";
import { server } from "./server";

/** Render the whole app (real routes and pages) at `path`, backed by a fake API. */
export function renderApp(path: string, state: FakeState, { signedIn = true } = {}) {
  server.use(...handlers(state));
  if (signedIn) localStorage.setItem("launchops_token", "token-1");
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } });
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TooltipProvider delayDuration={0}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, user, queryClient };
}

/** The recorded requests matching a method and path prefix. */
export function requestsTo(state: FakeState, method: string, pathPrefix: string) {
  return state.requests.filter((r) => r.method === method && r.path.startsWith(pathPrefix));
}
