import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/stores/authStore'
import { 
  MessageSquare, 
  ChefHat, 
  ShoppingCart, 
  Users, 
  Sparkles, 
  ArrowRight,
  Play,
  Star
} from 'lucide-react'

const LandingPage = () => {
  useDocumentTitle()
  const navigate = useNavigate()
  const { user, isLoading, initialize } = useAuthStore()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    const checkAuth = async () => {
      if (!user && !isLoading) {
        // Initialize auth if not already done
        await initialize()
      }
    }
    checkAuth()
  }, [user, isLoading, initialize])

  useEffect(() => {
    if (user && !isLoading) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, isLoading, navigate])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Don't render landing page if user is authenticated (will redirect)
  if (user) {
    return null
  }

  const features = [
    {
      icon: MessageSquare,
      title: 'Conversational AI',
      description: 'Add and manage recipes through natural conversation with our intelligent chat interface.'
    },
    {
      icon: ChefHat,
      title: 'Smart Recipe Management',
      description: 'AI-powered recipe parsing, scaling, and personalized recommendations for your family.'
    },
    {
      icon: ShoppingCart,
      title: 'Automated Grocery Planning',
      description: 'Generate shopping lists automatically from your meal plans with smart substitutions.'
    },
    {
      icon: Users,
      title: 'Family Preference Learning',
      description: 'Our AI learns your family\'s tastes, allergies, and dietary preferences over time.'
    }
  ]

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Working Mom',
      content: 'MealPrep Agent has transformed how I plan meals for my family. The AI suggestions are spot-on!',
      rating: 5
    },
    {
      name: 'Mike Chen',
      role: 'Home Chef',
      content: 'The recipe scaling feature is incredible. No more math when cooking for different group sizes.',
      rating: 5
    },
    {
      name: 'Emily Rodriguez',
      role: 'Busy Parent',
      content: 'Finally, a meal planning app that actually learns what my kids will eat. Game changer!',
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 text-white/90 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered Meal Planning
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Your Intelligent
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">
                Kitchen Companion
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Transform how your family discovers, manages, and plans meals with AI that learns your preferences 
              and automates grocery planning through intelligent recipe analysis.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/signup"
                className="btn-primary text-lg px-8 py-4 flex items-center group"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <button 
                className="btn-secondary text-lg px-8 py-4 flex items-center"
                onClick={() => {
                  // Scroll to features section for demo
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need for intelligent meal planning
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Our AI-powered platform combines the best of recipe management, family preferences, 
              and automated grocery planning in one seamless experience.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card hover:shadow-lg transition-shadow duration-300 group">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How it works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Get started in minutes with our simple three-step process
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Add Your Recipes
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Upload recipes through chat, photos, or URLs. Our AI extracts all the details automatically.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Set Family Preferences
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Tell us about dietary restrictions, allergies, and what everyone loves or dislikes.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Get Smart Suggestions
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Receive personalized meal plans and automated grocery lists that everyone will love.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Loved by families everywhere
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              See what our users are saying about their experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="card">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4 italic">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to transform your meal planning?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of families who are already enjoying stress-free meal planning 
            with AI-powered recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center bg-white text-primary-600 font-semibold px-8 py-4 rounded-lg hover:bg-gray-50 transition-colors text-lg"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <button 
              className="inline-flex items-center border-2 border-white text-white font-semibold px-8 py-4 rounded-lg hover:bg-white hover:text-primary-600 transition-colors text-lg"
              onClick={() => {
                // Scroll to features section for demo
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              View Demo
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
