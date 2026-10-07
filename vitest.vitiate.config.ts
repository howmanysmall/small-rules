import { sharedConfiguration } from "@small-rules/vite-configuration";
import { vitiateConfiguration } from "@small-rules/vite-configuration/vitiate";
import { mergeConfig } from "vitest/config";

const configuration = mergeConfig(sharedConfiguration, vitiateConfiguration);

export default configuration;
