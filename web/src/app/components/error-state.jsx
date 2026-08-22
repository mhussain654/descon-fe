export default function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-gray-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
