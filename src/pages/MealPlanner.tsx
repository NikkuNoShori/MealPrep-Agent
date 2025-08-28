const MealPlanner = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meal Planner</h1>
        <p className="text-gray-600 dark:text-gray-300">Plan your family's meals with AI assistance</p>
      </div>
      
      <div className="card">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📅</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Meal Planning Coming Soon
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Our intelligent meal planning system is under development. You'll be able to create 
            personalized meal plans and generate shopping lists automatically.
          </p>
        </div>
      </div>
    </div>
  )
}

export default MealPlanner
