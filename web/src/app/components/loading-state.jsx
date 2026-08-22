export default function LoadingState({ message = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-gray-500">
      <div
        className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
        role="status"
        aria-label="Loading"
      />
      {message}
    </div>
  );
}
