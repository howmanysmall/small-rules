import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/react/strict-component-boundaries";

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
				filename: "tests/fixtures/strict-boundaries/basic-app/app/components/Foo/index.ts",
				code: "import someThing from '../Bar/any-path';",
				errors: [
					{
						message:
							"Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.",
					},
				],
				documentation: { id: "fail", title: "Nested component import" },
			},
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import someThing from './components/Bar/any-path';",
				errors,
			},
			// PascalCase component before fixtures
			{
				filename: nodePath.join(BASIC_APP, "components", "Foo", "index.ts"),
				code: "import someThing from '../Bar/tests/fixtures/SomeMockQuery/query.json';",
				errors,
			},
			// Allow pattern matches but import goes deeper
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import someThing from './components/Foo/foo';",
				options: [{ allow: [String.raw`components/\w+$`] }],
				errors,
			},
			// MaxDepth exceeded
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import someThing from './components/Foo/foo';",
				options: [{ maxDepth: 2 }],
				errors,
			},
			// Reaching into a kebab-case component's internal module
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import someThing from './components/status-bar/labeled-value';",
				errors,
			},
		],
		valid: [
			// Importing components folder itself (no PascalCase reached)
			{
				filename: "tests/fixtures/strict-boundaries/basic-app/app/index.ts",
				code: "import {someThing} from './components';",
				documentation: { id: "pass", title: "Shared components import" },
			},
			// Component folder entrypoint should be allowed
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import {StatusBar} from './components/status-bar';",
			},
			// Sibling component import (to index)
			{
				filename: nodePath.join(BASIC_APP, "components", "Foo", "index.ts"),
				code: "import {someThing} from '../Bar';",
			},
			// Non-relative import (package) - skipped, not resolved
			{
				filename: nodePath.join(BASIC_APP, "sections", "MySection", "MySection.ts"),
				code: "import {getDisplayName} from '@shopify/react-utilities/components';",
			},
			// No PascalCase in path
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import someUtility from './utilities/someUtility';",
			},
			// Fixtures before PascalCase - valid fixture import
			{
				filename: nodePath.join(BASIC_APP, "components", "Bar", "index.ts"),
				code: "import someThing from './tests/fixtures/SomeMockQuery/query.json';",
			},
			// Allow pattern matches
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import someThing from './components/Foo';",
				options: [{ allow: [String.raw`components/\w+$`] }],
			},
			// MaxDepth increased
			{
				filename: nodePath.join(BASIC_APP, "index.ts"),
				code: "import someThing from './components/Foo';",
				options: [{ maxDepth: 2 }],
			},
			// Child folder import - NOT crossing component boundary
			// (the game case: importing from own Configs subfolder)
			{
				filename: nodePath.join(FIXTURES, "shared", "data-service", "data-processor.ts"),
				code: "import StoryModeConfig from './Configs/gameplay/story-mode';",
			},
		],
	});
});
