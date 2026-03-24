import { PropsWithChildren } from 'react';

export function AuthShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-[24px] border border-line-strong/70 bg-canvas/88 p-2 shadow-shell backdrop-blur">
        <div className="panel-elevated w-full p-6 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
