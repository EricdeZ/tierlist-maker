import { Link } from 'react-router-dom'

const Home = () => {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-8">
                    Welcome to the Ranking System
                </h1>
                <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
                    A drag-and-drop interface for ranking players across different roles.
                    Organize your teams and create custom rankings with ease.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Drag & Drop Rankings
                        </h3>
                        <p className="text-gray-600 mb-4">
                            Easily move players between different role categories using intuitive drag and drop.
                        </p>
                        <Link
                            to="/rankings"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Start Ranking →
                        </Link>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Team Management
                        </h3>
                        <p className="text-gray-600 mb-4">
                            Organize players by teams with custom colors and export your rankings.
                        </p>
                        <button className="inline-flex items-center px-4 py-2 bg-gray-300 text-gray-700 rounded-lg cursor-not-allowed">
                            Coming Soon
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Home