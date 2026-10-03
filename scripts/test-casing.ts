#!/usr/bin/env bun

import { consola } from "consola";

import {
	applyCasing,
	Casing,
	copy,
	detect,
	isCamelCase,
	isConstantCase,
	isDotCase,
	isKebabCase,
	isLowerCase,
	isPascalCase,
	isPathCase,
	isSnakeCase,
	isTitleCase,
	isUnknown,
	isUpperCase,
	setLocaleMode,
	toCamelCase,
	toConstantCase,
	toDotCase,
	toKebabCase,
	toLowerCase,
	toPascalCase,
	toPathCase,
	toSnakeCase,
	toSpaceCase,
	toTitleCase,
	toUpperCase,
} from "$script-utilities/casing-utilities";

consola.info(detect("thisIsPascalCase"));
consola.info(applyCasing("thisIsKebabCase", Casing.KebabCase));
consola.info(copy("next-strīng", "next-string"));

const dumbString = "yurr this is cool";

setLocaleMode(true);
consola.info(toSpaceCase(dumbString));
consola.info(toLowerCase(dumbString));
consola.info(toUpperCase(dumbString));
consola.info(toPathCase(dumbString));
consola.info(toTitleCase(dumbString));
consola.info(toPascalCase(dumbString));
consola.info(toCamelCase(dumbString));
consola.info(toConstantCase(dumbString));
consola.info(toSnakeCase(dumbString));
consola.info(toDotCase(dumbString));
consola.info(toKebabCase(dumbString));
consola.info(isCamelCase(dumbString));
consola.info(isConstantCase(dumbString));
consola.info(isDotCase(dumbString));
consola.info(isKebabCase(dumbString));
consola.info(isLowerCase(dumbString));
consola.info(isPascalCase(dumbString));
consola.info(isPathCase(dumbString));
consola.info(isSnakeCase(dumbString));
consola.info(isTitleCase(dumbString));
consola.info(isUnknown(dumbString));
consola.info(isUpperCase(dumbString));
