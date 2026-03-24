export type ParsedArgs = {
  positionals: string[];
  options: Record<string, string | boolean>;
};

export function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    const equalIndex = withoutPrefix.indexOf('=');

    if (equalIndex >= 0) {
      const key = withoutPrefix.slice(0, equalIndex);
      const value = withoutPrefix.slice(equalIndex + 1);
      options[key] = value;
      continue;
    }

    const next = args[index + 1];

    if (!next || next.startsWith('--')) {
      options[withoutPrefix] = true;
      continue;
    }

    options[withoutPrefix] = next;
    index += 1;
  }

  return { positionals, options };
}

export function getStringOption(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.options[key];
  return typeof value === 'string' ? value : undefined;
}

export function getBooleanOption(parsed: ParsedArgs, key: string): boolean | undefined {
  const value = parsed.options[key];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }
  }

  return undefined;
}
