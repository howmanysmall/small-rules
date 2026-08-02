import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/strict-component-boundaries";

import { js } from "./rule-testers";

const FIXTURES = nodePath.join(import.meta.dirname, "fixtures", "strict-boundaries");
const BASIC_APP = nodePath.join(FIXTURES, "basic-app", "app");

const errors = [
	{
		message:
			"Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.",
	},
];

describe("strict-component-boundaries", () => {
	js.run("strict-component-boundaries", rule, {
		invalid: [
			// Reaching into another component and going deeper
			{
				code: "import someThing from '../Bar/any-path';",
				documentation: { id: "fail", title: "Nested component import" },
				errors: [
					{
						message:
							"Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.",
					},
				],
				filename: "tests/fixtures/strict-boundaries/basic-app/app/components/Foo/index.ts",
			},
			{
				code: "import someThing from './components/Bar/any-path';",
				errors,
				filename: nodePath.join(BASIC_APP, "index.ts"),
			},
			// PascalCase component before fixtures
			{
				code: "import someThing from '../Bar/tests/fixtures/SomeMockQuery/query.json';",
				errors,
				filename: nodePath.join(BASIC_APP, "components", "Foo", "index.ts"),
			},
			// Allow pattern matches but import goes deeper
			{
				code: "import someThing from './components/Foo/foo';",
				errors,
				filename: nodePath.join(BASIC_APP, "index.ts"),
				options: [{ allow: [String.raw`components/\w+$`] }],
			},
			// MaxDepth exceeded
			{
				code: "import someThing from './components/Foo/foo';",
				errors,
				filename: nodePath.join(BASIC_APP, "index.ts"),
				options: [{ maxDepth: 2 }],
			},
			// Reaching into a kebab-case component's internal module
			{
				code: "import someThing from './components/status-bar/labeled-value';",
				errors,
				filename: nodePath.join(BASIC_APP, "index.ts"),
			},
		],
		valid: [
			// Importing components folder itself (no PascalCase reached)
			{
				code: "import {someThing} from './components';",
				documentation: { id: "pass", title: "Shared components import" },
				filename: "tests/fixtures/strict-boundaries/basic-app/app/index.ts",
			},
			// Component folder entrypoint should be allowed
			{
				code: "import {StatusBar} from './components/status-bar';",
				filename: nodePath.join(BASIC_APP, "index.ts"),
			},
			// Sibling component import (to index)
			{
				code: "import {someThing} from '../Bar';",
				filename: nodePath.join(BASIC_APP, "components", "Foo", "index.ts"),
			},
			// Non-relative import (package) - skipped, not resolved
			{
				code: "import {getDisplayName} from '@shopify/react-utilities/components';",
				filename: nodePath.join(BASIC_APP, "sections", "MySection", "MySection.ts"),
			},
			// No PascalCase in path
			{
				code: "import someUtility from './utilities/someUtility';",
				filename: nodePath.join(BASIC_APP, "index.ts"),
			},
			// Fixtures before PascalCase - valid fixture import
			{
				code: "import someThing from './tests/fixtures/SomeMockQuery/query.json';",
				filename: nodePath.join(BASIC_APP, "components", "Bar", "index.ts"),
			},
			// Allow pattern matches
			{
				code: "import someThing from './components/Foo';",
				filename: nodePath.join(BASIC_APP, "index.ts"),
				options: [{ allow: [String.raw`components/\w+$`] }],
			},
			// MaxDepth increased
			{
				code: "import someThing from './components/Foo';",
				filename: nodePath.join(BASIC_APP, "index.ts"),
				options: [{ maxDepth: 2 }],
			},
			// Child folder import - NOT crossing component boundary
			// (the game case: importing from own Configs subfolder)
			{
				code: "import StoryModeConfig from './Configs/gameplay/story-mode';",
				filename: nodePath.join(FIXTURES, "shared", "data-service", "data-processor.ts"),
			},
		],
	});
});
