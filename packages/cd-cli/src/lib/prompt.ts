function isBackspace(input: string): boolean {
  return input === '\u0008' || input === '\u007f';
}

export async function promptHidden(message: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive password prompt requires a TTY. Use --password instead.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const stdin = process.stdin;
    const stdout = process.stdout;
    const previousRawMode = stdin.isRaw;

    const cleanup = () => {
      stdin.off('data', handleData);
      if (stdin.isTTY) {
        stdin.setRawMode(previousRawMode ?? false);
      }
      stdin.pause();
      stdout.write('\n');
    };

    const handleData = (chunk: Buffer | string) => {
      const input = chunk.toString('utf8');

      if (input === '\u0003') {
        cleanup();
        reject(new Error('Cancelled by user.'));
        return;
      }

      if (input === '\r' || input === '\n') {
        cleanup();
        resolve(value);
        return;
      }

      if (isBackspace(input)) {
        value = value.slice(0, -1);
        return;
      }

      if (input.startsWith('\u001b')) {
        return;
      }

      value += input;
    };

    stdout.write(message);
    stdin.resume();
    stdin.setEncoding('utf8');
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.on('data', handleData);
  });
}

export async function promptPasswordWithConfirmation(): Promise<string> {
  const first = await promptHidden('Password: ');
  const second = await promptHidden('Confirm password: ');

  if (first !== second) {
    throw new Error('Passwords do not match.');
  }

  return first;
}
