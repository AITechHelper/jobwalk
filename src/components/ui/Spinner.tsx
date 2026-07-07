// Consistent loading spinner used across the app's buttons and async states.
// Uses `border-current` so it inherits the surrounding text color.
export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${
        className || "h-4 w-4"
      }`}
    />
  );
}
