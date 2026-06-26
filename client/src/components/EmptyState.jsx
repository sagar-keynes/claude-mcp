import { surfaceClass } from '../lib/ui'

const SUGGESTIONS = [
  'Show me performance for Backcountry over the last 30 days',
  'Which advertiser had the highest revenue last month?',
  'Compare sessions and revenue trends for my top brands',
  'What datasets are available in my account?',
]

export default function EmptyState({ onSelect, disabled = false }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-stone-100">
        How can I help with your marketing data?
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-7 text-gray-600 dark:text-stone-400">
        Ask about traffic, revenue, ad spend, ROAS, or brand performance. I can
        pull live data, explain trends, and show charts.
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className={`px-4 py-3 text-left text-sm leading-6 text-gray-700 dark:text-stone-300 transition hover:text-gray-900 dark:hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-50 ${surfaceClass} hover:border-gray-300 dark:hover:border-stone-600`}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
