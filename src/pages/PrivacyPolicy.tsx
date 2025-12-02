import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/20 to-secondary-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
            Privacy Policy
          </h1>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                1. Introduction
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                MealPrep Agent ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our meal planning application.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                2. Information We Collect
              </h2>
              
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                2.1 Account Information
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                When you create an account, we collect:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Email address</li>
                <li>Name (first and last name)</li>
                <li>Authentication credentials (managed by Supabase Auth)</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                2.2 Content You Create
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We store the content you create in our application:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Recipes (titles, descriptions, ingredients, instructions, images)</li>
                <li>Chat conversations and messages</li>
                <li>Meal plans</li>
                <li>User preferences and settings</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                2.3 Usage Data
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We automatically collect certain information when you use our service:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Chat messages and conversation history</li>
                <li>Images you upload for recipe extraction</li>
                <li>Session identifiers</li>
                <li>Timestamps of your activities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                3. How We Use Your Information
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Provide and maintain our service</li>
                <li>Process your chat messages and provide AI-powered responses</li>
                <li>Extract recipes from text and images</li>
                <li>Search and retrieve your recipes using semantic search</li>
                <li>Personalize your experience</li>
                <li>Improve our service and develop new features</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                4. Third-Party Services and Data Processing
              </h2>
              
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                4.1 OpenRouter API
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We use OpenRouter to power our AI features. When you use our chat or recipe extraction features, we send the following to OpenRouter:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Your chat messages and conversation history</li>
                <li>Images you upload (for recipe extraction)</li>
                <li>Recipe context (when asking recipe-related questions)</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                <strong>We do NOT send:</strong> Your email, name, user ID, or other personally identifiable information to OpenRouter.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                OpenRouter may log requests for billing and analytics purposes. Please review <a href="https://openrouter.ai/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">OpenRouter's Privacy Policy</a> for more information.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                4.2 Supabase
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We use Supabase for authentication, database storage, and hosting. Your data is stored securely in Supabase's infrastructure. Please review <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Supabase's Privacy Policy</a> for more information.
              </p>

              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                4.3 n8n Workflow (RAG Search)
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                When you use recipe search features, we may send your search queries and user ID to our n8n workflow for semantic search processing. This data is used solely to provide search functionality and is not shared with other third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                5. Data Security
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We implement appropriate technical and organizational measures to protect your personal information:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li>Row Level Security (RLS) policies ensure you can only access your own data</li>
                <li>All API communications use HTTPS encryption</li>
                <li>API keys and sensitive credentials are stored server-side only</li>
                <li>Authentication is handled by Supabase Auth with industry-standard security</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                6. Your Rights (GDPR)
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you are located in the European Economic Area (EEA), you have certain data protection rights:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
                <li><strong>Right to Access:</strong> You can access your data through the application</li>
                <li><strong>Right to Rectification:</strong> You can update your profile and content at any time</li>
                <li><strong>Right to Erasure:</strong> You can delete your conversations and account data</li>
                <li><strong>Right to Data Portability:</strong> Contact us to export your data</li>
                <li><strong>Right to Object:</strong> You can opt-out of certain data processing</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                To exercise these rights, please contact us or use the deletion features in the application.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                7. Data Retention
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We retain your personal information for as long as your account is active or as needed to provide you services. You can delete your conversations and account at any time. When you delete your account, all associated data (conversations, messages, recipes) is permanently deleted.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                8. Children's Privacy
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                9. Changes to This Privacy Policy
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                10. Contact Us
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                <strong>Transcended Solutions LLC</strong><br />
                Email: [Your Contact Email]<br />
                [Your Address]
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

