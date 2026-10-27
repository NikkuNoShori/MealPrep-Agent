import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/stores/authStore'
import {
  MessageSquare,
  ChefHat,
  ShoppingCart,
  Users,
  ArrowRight,
  Zap,
  Calendar,
  Heart,
} from 'lucide-react'

const LandingPage = () => {
  useDocumentTitle()
  const navigate = useNavigate()
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (user && !isLoading) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, isLoading, navigate])

  return (
    // LandingPage renders outside Layout (no route-level <main
    // overflow-y-auto> wrapper — see App.tsx), but html/body/#root are all
    // height:100%/overflow:hidden (the sealed height chain, index.css).
    // Without its own scroll container this page's four sections (taller
    // than most viewports) were silently clipped by that ancestor
    // overflow:hidden instead of scrolling. Chat is the only other page
    // that manages its own scroll region for the same reason.
    <div className="h-full overflow-y-auto">
      {/* ─── Hero ─── */}
      <section className="relative px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <p
            className="text-sm font-medium tracking-wide uppercase text-brand mb-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            AI-Powered Meal Planning
          </p>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-semibold text-fg leading-[1.1] tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Plan meals your
            <br />
            family will love
          </h1>

          <p
            className="mt-6 text-lg text-fg-muted max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            MealPrep uses AI to learn your family's preferences, manage recipes,
            and build weekly plans — so dinner is never a question.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-primary-foreground font-medium text-[15px] transition-all duration-200 hover:-translate-y-0.5"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                backgroundColor: 'var(--rs-accent)',
                boxShadow: '0 4px 14px rgba(29,158,117,0.25)',
              }}
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/signin"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-fg-secondary font-medium text-[15px] border border-surface-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-surface-300 dark:hover:border-white/20 transition-all duration-200"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="px-4 py-20 bg-white dark:bg-white/[0.02] border-y border-surface-200/60 dark:border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2
              className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              A smarter way to feed your family
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10 max-w-3xl mx-auto">
            {[
              {
                icon: MessageSquare,
                title: 'Conversational AI',
                desc: 'Add recipes through natural conversation. Paste a URL, describe a dish, or snap a photo — AI handles the rest.',
              },
              {
                icon: Calendar,
                title: 'Weekly meal plans',
                desc: "Drag-and-drop planner that suggests meals based on what you have, what you like, and what's in season.",
              },
              {
                icon: ShoppingCart,
                title: 'Auto grocery lists',
                desc: 'One tap to generate a shopping list from your plan. Smart grouping by aisle with quantity merging.',
              },
              {
                icon: Users,
                title: 'Household sharing',
                desc: "Invite family members, track everyone's preferences, and let kids vote on what's for dinner.",
              },
            ].map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-500/10 dark:bg-primary-400/10 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h3
                    className="text-[15px] font-semibold text-fg mb-1"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="text-sm text-fg-muted leading-relaxed"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2
              className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Three steps to stress-free dinners
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                step: '01',
                icon: ChefHat,
                title: 'Build your recipe collection',
                desc: 'Import from any URL, type it out, or tell our AI what you made. Recipes are parsed, tagged, and searchable instantly.',
              },
              {
                step: '02',
                icon: Heart,
                title: "Set your family's preferences",
                desc: 'Allergies, dietary goals, picky eaters — MealPrep remembers it all and filters suggestions accordingly.',
              },
              {
                step: '03',
                icon: Zap,
                title: 'Let AI do the planning',
                desc: 'Get personalized weekly plans, scaled portions, and grocery lists generated in seconds. Adjust anything with a tap.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="flex gap-5 items-start p-5 rounded-2xl border border-surface-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] transition-all duration-200 hover:border-primary-500/20 dark:hover:border-primary-400/10"
              >
                <div className="flex-shrink-0">
                  <span
                    className="block text-xs font-bold text-brand tracking-wider mb-1"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    STEP {s.step}
                  </span>
                  <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-white/[0.06] flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-fg-muted" />
                  </div>
                </div>
                <div>
                  <h3
                    className="text-[15px] font-semibold text-fg mb-1"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="text-sm text-fg-muted leading-relaxed"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-4 py-16 border-t border-surface-200/60 dark:border-white/[0.04]">
        <div className="max-w-xl mx-auto text-center">
          <h2
            className="text-2xl font-semibold text-fg tracking-tight mb-3"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Ready to simplify dinner?
          </h2>
          <p
            className="text-sm text-fg-muted mb-8"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Free to start. No credit card required.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-primary-foreground font-medium text-[15px] transition-all duration-200 hover:-translate-y-0.5"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              backgroundColor: 'var(--rs-accent)',
              boxShadow: '0 4px 14px rgba(29,158,117,0.25)',
            }}
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
