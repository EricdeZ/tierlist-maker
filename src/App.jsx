// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Rankings from './pages/Rankings'
import Stats from './pages/Stats'
import { FEATURE_FLAGS } from './config/featureFlags'

function App() {
    // If navigation and home page are disabled, just show rankings directly
    if (!FEATURE_FLAGS.SHOW_NAVIGATION && !FEATURE_FLAGS.ENABLE_HOME_PAGE) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Rankings />
            </div>
        )
    }

    // Standard routing with layout
    return (
        <Router>
            <Layout>
                <Routes>
                    <>
                        {FEATURE_FLAGS.ENABLE_HOME_PAGE && (
                        <Route path="/" element={<Home />} />
                            )}
                        <Route path="/rankings" element={<Rankings />} />
                        <Route path="/stats" element={<Stats />} />
                        <Route path="*" element={<Stats />} />
                    </>
                </Routes>
            </Layout>
        </Router>
    )
}

export default App