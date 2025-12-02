import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-400/70 dark:border-slate-600/70 bg-gradient-to-br from-header-light via-slate-300/90 to-header-light dark:from-header-dark dark:via-slate-700/90 dark:to-header-dark shadow-lg flex-shrink-0 relative overflow-hidden">
      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-white/5 to-transparent dark:from-white/10 dark:via-white/2 pointer-events-none"></div>
      {/* Subtle texture pattern */}
      <div className="absolute inset-0 opacity-30 dark:opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:16px_16px] pointer-events-none"></div>
      {/* Subtle inner shadow for depth */}
      <div className="absolute inset-0 shadow-inner pointer-events-none"></div>
      <div className="container mx-auto px-4 py-1.5 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-gray-600 dark:text-gray-400 gap-1 sm:gap-0">
          <div>
            <p>
              © {currentYear} Transcended Solutions LLC. All rights reserved.
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              to="/privacy"
              className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

