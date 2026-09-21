// oxlint-disable import/no-namespace -- Namespace import required for jest-extended matchers

import { expect } from "vitest";
import * as matchers from "jest-extended";

expect.extend(matchers);
