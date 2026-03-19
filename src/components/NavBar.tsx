import Link from "next/link";

export function NavBar() {
  return (
    <>
      {/* Top banner */}
      <div className="bg-[var(--color-cobalt)] text-white text-center py-2 text-sm font-medium tracking-wide">
        <span className="inline-flex items-center gap-2">
          <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          HOW IT WORKS
        </span>
      </div>

      {/* Main nav */}
      <nav className="bg-white border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="shrink-0">
              <span
                className="text-[var(--color-cobalt)] text-2xl tracking-tight"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                Fanstake
              </span>
            </Link>

            {/* Search */}
            <div className="flex-1 max-w-xl hidden sm:block">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search teams, athletes, schools"
                  className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-sky-light)] py-2 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-cobalt-lite)] focus:ring-1 focus:ring-[var(--color-cobalt-lite)]"
                />
              </div>
            </div>

            {/* Right nav items */}
            <div className="flex items-center gap-5">
              <span className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-cobalt)] transition-colors hidden sm:block">
                Play
              </span>
              <span className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer hover:text-[var(--color-cobalt)] transition-colors hidden sm:block">
                Rewards
              </span>
              <span className="text-sm font-bold text-[var(--color-cobalt)] hidden sm:block">
                $150
              </span>
              {/* Avatar */}
              <div className="h-8 w-8 rounded-full bg-[var(--color-sky)] border-2 border-[var(--color-cobalt-lite)] flex items-center justify-center overflow-hidden">
                <svg className="h-5 w-5 text-[var(--color-cobalt-med)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
