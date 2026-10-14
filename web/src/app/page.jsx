import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { useLanguage } from "../contexts/LanguageContext";

// Descon-hosted images for client review. Replace with approved local assets
// before launch so this site does not depend on Descon's media URLs.
const HERO = "https://www.descon.com/assets/desconbanner.jpg";
const PEOPLE = "https://www.descon.com/assets/career1.jpg";

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-[#173146]">
      <header className="border-b border-[#d8e0df] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" aria-label={t("connectHomeLink")} className="flex items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#007e79]">
            <img src="/descon-logo.png" alt="Descon" className="h-11 max-w-36 object-contain" />
            <span className="border-s border-[#cad4d2] ps-3 text-sm font-semibold uppercase tracking-widest text-[#126b68] sm:text-base">Connect</span>
          </Link>
          <nav aria-label={t("connectNavLabel")} className="flex items-center gap-3 sm:gap-6">
            <a href="#about" className="hidden text-sm font-semibold hover:text-[#007e79] sm:inline">{t("connectAboutLink")}</a>
            <a href="#mobile-app" className="hidden text-sm font-semibold hover:text-[#007e79] sm:inline">{t("connectAppLink")}</a>
            <Link to="/admin/login" className="rounded bg-[#007e79] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00615e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007e79]">{t("connectStaffLogin")}</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-[#102b3a] text-white">
          <img src={HERO} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#102b3a]/95 via-[#102b3a]/85 to-[#102b3a]/45" />
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
            <div className="max-w-2xl">
              <p className="mb-6 text-sm font-bold uppercase tracking-widest text-[#85ddd0]">{t("connectEyebrow")}</p>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">{t("connectHeroTitle")}</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-100">{t("connectHeroDescription")}</p>
              <div className="mt-9 flex flex-wrap gap-4">
                <a href="#mobile-app" className="inline-flex items-center gap-2 rounded bg-[#e8b74e] px-6 py-3 font-semibold text-[#173146] hover:bg-[#f4ca6f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t("connectLearnApp")} <ArrowRight size={18} aria-hidden="true" /></a>
                <Link to="/admin/login" className="rounded border border-white/70 px-6 py-3 font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t("connectStaffLogin")}</Link>
              </div>
            </div>
          </div>
        </section>
        <section id="about" className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#007e79]">{t("connectAboutEyebrow")}</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{t("connectAboutTitle")}</h2>
            <p className="mt-6 text-lg leading-8 text-[#445967]">{t("connectAboutDescription")}</p>
            <p className="mt-5 leading-7 text-[#445967]">{t("connectDesconContext")}</p>
            <a href="https://www.descon.com/" target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 font-semibold text-[#007e79] underline-offset-4 hover:underline">{t("connectVisitDescon")} <ExternalLink size={16} aria-hidden="true" /></a>
          </div>
          <img src={PEOPLE} alt={t("connectPeopleImageAlt")} loading="lazy" className="aspect-[4/3] w-full rounded-2xl bg-[#dbe4e3] object-cover shadow-xl" />
        </section>
        <section id="mobile-app" className="bg-[#e6f0ec]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <p className="text-sm font-bold uppercase tracking-widest text-[#007e79]">{t("connectAppEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-bold">{t("connectAppTitle")}</h2>
            <p className="mt-4 max-w-3xl leading-7 text-[#445967]">{t("connectAppDescription")}</p>
            <p className="mt-6 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#27615f]">{t("connectAppComingSoon")}</p>
          </div>
        </section>
      </main>
      <footer className="bg-[#102b3a] text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-2">
          <div><p className="text-xl font-semibold text-white">Descon Connect</p><p className="mt-3 max-w-md leading-7">{t("connectFooterDescription")}</p></div>
          <div className="md:justify-self-end">
            <p className="font-semibold text-white">{t("connectFooterContact")}</p>
            <address className="mt-3 not-italic leading-7"><p>{t("connectFooterAddress")}</p><a href="tel:+9242111337266" className="hover:underline">+92 42 111 337 266</a></address>
            <a href="https://www.descon.com/contact-us/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block underline underline-offset-4 hover:text-white">{t("connectContactDescon")}</a>
          </div>
        </div>
        <div className="border-t border-white/15"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-5 text-sm sm:px-8"><span>{t("connectCopyright")}</span><a href="https://www.descon.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">descon.com</a></div></div>
      </footer>
    </div>
  );
}
