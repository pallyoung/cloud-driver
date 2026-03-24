import { Files, FolderTree, LogOut, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { logoutAction } from "../../state/app-state";
import { useActions } from "../../state/relax";

const items = [
  { to: "/explorer", label: "File Manager", icon: FolderTree },
  { to: "/jobs", label: "Task Center", icon: Files },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [logout] = useActions([logoutAction] as const);

  return (
    <aside className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[34px] border border-ink-strong/10 bg-ink-strong p-5 text-white shadow-shell">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,rgba(14,109,103,0.28),transparent_62%),radial-gradient(circle_at_top_right,rgba(184,104,55,0.22),transparent_56%)]" />

      <div className="relative">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Archive Ops Console
          </p>
          <p className="mt-3 font-display text-[30px] font-semibold leading-none text-white">
            Cloud Driver
          </p>
          <p className="mt-3 text-sm leading-6 text-white/72">
            Single-user file operations console for managed roots, inline
            preview, text editing, and export workflows.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72">
              Passphrase Auth
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72">
              Server Mirror
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72">
              Export Ready
            </span>
          </div>
        </div>

        <nav className="mt-6 space-y-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-[24px] border px-4 py-3.5 text-sm font-medium transition duration-200 ease-out",
                  isActive
                    ? "border-transparent bg-surface-alt text-ink-strong shadow-panel"
                    : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/16 hover:bg-white/[0.08] hover:text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx(
                      "flex h-10 w-10 flex-none items-center justify-center rounded-2xl transition",
                      isActive
                        ? "bg-accent-soft text-accent"
                        : "bg-white/[0.06] text-white/80",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{label}</span>
                  <span
                    className={clsx(
                      "h-2.5 w-2.5 rounded-full transition",
                      isActive ? "bg-accent" : "bg-white/20",
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="relative space-y-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4 text-sm text-white/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Console Mode
          </p>
          <p className="mt-3 font-medium text-white">File Operations Only</p>
          <p className="mt-2 leading-6">
            当前阶段聚焦目录浏览、预览、编辑与导出，所有高风险动作统一经过上下文菜单与确认弹层。
          </p>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[24px] border border-white/12 bg-white/[0.02] px-4 py-3 text-sm font-medium text-white/84 transition duration-200 ease-out hover:border-danger/55 hover:bg-danger/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
