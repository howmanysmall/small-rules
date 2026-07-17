import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.stubEnv("BASE_URL", "/small-rules/");
afterEach(cleanup);
