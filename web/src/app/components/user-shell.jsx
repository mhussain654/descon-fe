const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/documents", label: "Documents", icon: "▣" },
  { href: "/status", label: "Status", icon: "◷" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

export default function UserShell({ activeTab, children }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          {tabs.map((tab) => {
            const isActive = tab.href === activeTab;
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition ${
                  isActive ? "text-[#0066CC]" : "text-[#9B9B9B]"
                }`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
