import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section */}
      <header className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Collaborate and Code in Real Time
          </h1>
          <p className="text-lg md:text-xl mb-8">
            Build projects together with a powerful code editor and seamless meeting integration.
          </p>
          <div className="space-x-4">
            {!user ? (
              <>
                <Link
                  to="/login"
                  className="inline-block px-6 py-3 bg-white text-blue-600 font-semibold rounded-md hover:bg-gray-200 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="inline-block px-6 py-3 bg-blue-800 text-white font-semibold rounded-md hover:bg-blue-900 transition-colors"
                >
                  Register
                </Link>
              </>
            ) : (
              <Link
                to="/projects"
                className="inline-block px-6 py-3 bg-blue-800 text-white font-semibold rounded-md hover:bg-blue-900 transition-colors"
              >
                Go to Projects
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Why Choose Our Platform?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-lg shadow-md text-center">
              <h3 className="text-xl font-semibold mb-4">Real-Time Code Editing</h3>
              <p className="text-gray-600">
                Collaborate on code with your team in real time, with syntax highlighting and cursor tracking.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg shadow-md text-center">
              <h3 className="text-xl font-semibold mb-4">Meeting Links</h3>
              <p className="text-gray-600">
                Admins can create secure, time-restricted meeting links to collaborate on projects.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg shadow-md text-center">
              <h3 className="text-xl font-semibold mb-4">Role-Based Access</h3>
              <p className="text-gray-600">
                Admins manage users and projects, while collaborators focus on coding and teamwork.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-blue-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Ready to Start Coding?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join our platform and start collaborating on your next project today!
          </p>
          {!user ? (
            <Link
              to="/register"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
          ) : (
            <Link
              to="/projects"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Projects
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p>© {new Date().getFullYear()} Real-Time Code Editor. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;